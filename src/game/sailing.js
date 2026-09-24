import { TILE, MAP_W, MAP_H } from '../core/constants.js';
import { clamp, chance, pick } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { SEA_MONSTERS, seaTier, pickMonster, spawnMonster, updateMonsters, damageMonster } from './seaMonsters.js';
import { damageCreature } from './creatures.js';
import { World, T } from './world.js';
import { Game } from './game.js';
import { SAVE_VERSION, DAY_LENGTH } from '../core/constants.js';
import { DEFAULT_LAWS } from '../data/laws.js';

/*
 * Sailing: build boats at a Shipyard, then take the helm yourself.
 * W/S (or the arrows) set the speed, A/D steer, Space fires bombs. Pirates and sea serpents come for you;
 * sink them for treasure, and don't let them sink you. Sail to the edge of your waters to reach other lands.
 */

// better ships with every era: [era, sprite, name, cost, hull, top speed (tiles/s), guns]
export const BOATS = {
  raft:      { era: 1, name: 'Raft', cost: { wood: 15 }, hull: 30, speed: 2.2, guns: 0, seats: 1, carries: 2, art: 'boats2/raft', desc: 'Lashed logs. It floats, and that is all it does.' },
  rowboat:   { era: 1, name: 'Rowboat', cost: { wood: 30 }, hull: 45, speed: 2.8, guns: 1, seats: 1, carries: 4, art: 'boats2/rowboat', desc: 'One pair of oars and a crate of bombs. Quick and fragile.' },
  skiff:     { era: 1, name: 'Fishing Skiff', cost: { wood: 45, iron: 2 }, hull: 65, speed: 2.9, guns: 1, seats: 2, carries: 6, art: 'boats2/skiff', desc: 'Room for a friend at the bow.' },
  longboat:  { era: 2, name: 'Longboat', cost: { wood: 90, iron: 8 }, hull: 110, speed: 3.2, guns: 1, seats: 4, carries: 12, art: 'boats2/longboat', desc: 'Four benches. Bring the crew and their bows.' },
  sloop:     { era: 2, name: 'Sloop', cost: { wood: 130, iron: 20, gold: 15 }, hull: 150, speed: 3.6, guns: 2, seats: 3, carries: 16, art: 'boats2/sloop', desc: 'A single sail and a wheel. Fast and handy.' },
  cog:       { era: 3, name: 'Merchant Cog', cost: { wood: 180, iron: 30 }, hull: 210, speed: 2.8, guns: 1, seats: 4, carries: 30, art: 'boats2/cog', desc: 'Broad and slow, but it carries everything.' },
  galley:    { era: 3, name: 'War Galley', cost: { wood: 200, iron: 60, gold: 40 }, hull: 260, speed: 3.2, guns: 3, seats: 4, carries: 25, art: 'boats2/galley', desc: 'Cannons down both sides and a ram at the bow.' },
  cutter:    { era: 4, name: 'Corsair Cutter', cost: { wood: 160, iron: 90, gold: 90 }, hull: 300, speed: 4.2, guns: 3, seats: 3, carries: 20, art: 'boats2/cutter', desc: 'Black hull, red trim, a swivel gun at the bow.' },
};

/** The art for a boat, falling back to the old fleet sprites for a ship built before the new ones existed. */
export const boatArt = type => BOATS[type]?.art || `boats/${type}`;

const BOMB_RANGE = 9 * TILE;
const BOMB_SPEED = 11 * TILE;
export const RELOAD = 0.9;

export const fleetOf = g => (g.state.fleet ||= []);

/** Boats in port and seaworthy (not sunk, not away carrying an invasion). */
export const shipsInPort = g => fleetOf(g).filter(b => b.hull > 0 && !(b.awayUntil > Date.now()) && g.sail?.boatId !== b.id);
/** How many soldiers the fleet in port can carry, and how much their guns add to an attack. */
export function seaLift(g) {
  const ships = shipsInPort(g);
  return { ships, capacity: ships.reduce((n, b) => n + (BOATS[b.type].carries || 0), 0), guns: ships.reduce((n, b) => n + BOATS[b.type].guns, 0) };
}
export const hasShipyard = g => g.hasBuilding('shipyard');

export function buildBoat(g, type) {
  const def = BOATS[type];
  if (!def) return { error: 'Unknown boat' };
  if (!hasShipyard(g)) return { error: 'Build a Shipyard first' };
  if (def.era > g.state.era) return { error: `Needs the ${['Primitive', 'Village', 'Town', 'Kingdom', 'Industrial', 'Atomic', 'Future'][def.era]} era` };
  if (!g.spend(def.cost)) return { error: 'Not enough resources' };
  const boat = { id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`, type, hull: def.hull, name: `${def.name} ${fleetOf(g).filter(b => b.type === type).length + 1}` };
  fleetOf(g).push(boat);
  g.log(`The shipyard launches a ${def.name}.`, 'good');
  g.emit('change');
  return { ok: true, boat };
}

/** The water tile next to the shipyard where boats set out. */
function launchSpot(g) {
  const yard = g.builtBuildings().find(b => b.type === 'shipyard');
  if (!yard) return null;
  const size = yard.size || 2;
  const cx = yard.tx + size / 2, cy = yard.ty + size / 2;
  const openness = (x, y, r) => { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (g.world.isWater(x + dx, y + dy)) n++; return n; };
  // close to the shipyard, but in open water rather than a narrow inlet
  let best = null, bestScore = -Infinity;
  for (let y = Math.floor(cy) - 6; y <= Math.ceil(cy) + 6; y++) for (let x = Math.floor(cx) - 6; x <= Math.ceil(cx) + 6; x++) {
    if (!g.world.isWater(x, y)) continue;
    const score = openness(x, y, 2) * 2 - Math.hypot(x - cx, y - cy) * 3;
    if (score > bestScore) { bestScore = score; best = { tx: x, ty: y }; }
  }
  if (!best) return null;
  // face the open sea: towards where most water lies
  let ax = 0, ay = 0;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if ((dx || dy) && g.world.isWater(best.tx + dx, best.ty + dy)) { ax += dx; ay += dy; }
  return { x: (best.tx + 0.5) * TILE, y: (best.ty + 0.5) * TILE, angle: Math.atan2(ay, ax) };
}

export function setSail(g, boatId) {
  if (g.sail) return { error: 'Already at sea' };
  const boat = fleetOf(g).find(b => b.id === boatId);
  if (!boat) return { error: 'No such boat' };
  if (boat.hull <= 0) return { error: 'This boat needs repairs' };
  if (boat.awayUntil > Date.now()) return { error: 'This boat is away carrying an invasion' };
  const spot = launchSpot(g);
  if (!spot) return { error: 'The shipyard has no open water' };
  g.hero = null;   // the ruler goes aboard
  g.sail = { boatId, type: boat.type, x: spot.x, y: spot.y, angle: spot.angle, speed: 0, reload: 0, shots: [], monsters: [], loot: [], nextRiseAt: 14, time: 0, sunk: 0, gold: 0, wake: [], others: new Map(), seats: [], seatReload: [] };
  g.log(`The ${boat.name} sets sail!`, 'event');
  g.emit('change');
  return { ok: true };
}

export function returnToPort(g) {
  const s = g.sail;
  if (!s) return;
  const boat = fleetOf(g).find(b => b.id === s.boatId);
  g.log(`The ${boat?.name || 'boat'} returns to port${s.sunk ? ` after sinking ${s.sunk} ship${s.sunk === 1 ? '' : 's'}` : ''}${s.gold ? ` with ${s.gold} gold of treasure` : ''}.`, 'good');
  if (s.arena) g.seaNet?.leave();
  g.sail = null;
  g.emit('change');
}

/** Repair a damaged boat at the shipyard. */
export function repairBoat(g, boatId) {
  const boat = fleetOf(g).find(b => b.id === boatId);
  if (!boat) return { error: 'No such boat' };
  const def = BOATS[boat.type];
  const missing = def.hull - boat.hull;
  if (missing <= 0) return { error: 'Already in top shape' };
  const cost = { wood: Math.ceil(missing * 0.6) };
  if (!g.spend(cost)) return { error: `Needs ${cost.wood} wood` };
  boat.hull = def.hull;
  g.emit('change');
  return { ok: true, cost };
}

const seaWorld = g => (g.sail?.arena && g.sail.seaGame ? g.sail.seaGame.world : g.world);
const waterAt = (g, x, y) => seaWorld(g).isWater(Math.floor(x / TILE), Math.floor(y / TILE));

export function fire(g) {
  const s = g.sail;
  if (!s || s.reload > 0) return false;
  const def = BOATS[s.type];
  const bombs = Math.floor(g.state.resources.bombs || 0);
  // bombs from the stores hit hard; without any, the crew throw rocks
  const heavy = bombs >= 1;
  if (heavy) g.state.resources.bombs -= 1;
  for (let i = 0; i < def.guns; i++) {
    const spread = (i - (def.guns - 1) / 2) * 0.12;
    const a = s.angle + spread;
    const shot = { x: s.x + Math.cos(a) * TILE * 0.7, y: s.y + Math.sin(a) * TILE * 0.7, vx: Math.cos(a) * BOMB_SPEED, vy: Math.sin(a) * BOMB_SPEED, left: BOMB_RANGE, dmg: heavy ? 30 : 8, heavy, mine: true };
    s.shots.push(shot);
    if (s.arena) g.seaNet?.shot(shot);
  }
  s.reload = RELOAD;
  return true;
}

/*
 * Seats. The helm is yours; everyone else aboard sits and shoots. A seat holds a player who came aboard from the
 * shore or from the Open Sea, and each one reloads on its own, so four bows put out far more than one set of guns.
 * A seat with nobody in it is left empty rather than removed, so the boat always has the same shape.
 */

/** Everyone aboard, the helm first. */
export const crewOf = g => (g.sail?.seats || []);
export const seatsFree = g => Math.max(0, (BOATS[g.sail?.type]?.seats || 1) - 1 - crewOf(g).length);

/** Someone climbs aboard. Returns why not, when there is no room. */
export function boardBoat(g, who) {
  const s = g.sail;
  if (!s) return { error: 'No boat at sea' };
  if (!who?.uid) return { error: 'Nobody to bring aboard' };
  if (crewOf(g).some(c => c.uid === who.uid)) return { error: 'Already aboard' };
  if (seatsFree(g) <= 0) return { error: 'Every seat is taken' };
  s.seats.push({ uid: who.uid, name: who.name || 'Someone', reload: 0, aim: s.angle });
  g.announce?.(`${who.name || 'Someone'} climbs aboard`);
  g.emit?.('change');
  return { ok: true };
}

export function leaveSeat(g, uid) {
  const s = g.sail;
  if (!s) return false;
  const before = s.seats.length;
  s.seats = s.seats.filter(c => c.uid !== uid);
  if (s.seats.length !== before) g.emit?.('change');
  return s.seats.length !== before;
}

/** A passenger looses a shot: lighter than a cannon, but there is no reloading the hold for it. */
export function seatFire(g, uid, angle) {
  const s = g.sail;
  const seat = s?.seats.find(c => c.uid === uid);
  if (!seat || seat.reload > 0) return false;
  seat.reload = 0.75;
  seat.aim = angle;
  const sp = TILE * 13;
  s.shots.push({
    x: s.x + Math.cos(angle) * TILE * 0.6, y: s.y + Math.sin(angle) * TILE * 0.6,
    vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, left: BOMB_RANGE * 0.85,
    dmg: 12, heavy: false, mine: true, sprite: 'combat/arrow', arrow: true,
  });
  return true;
}

/**
 * Every passenger shoots for themselves. Anyone at a seat who is not being driven by a real player looses at the
 * nearest monster on their own, so a crewed boat is never dead weight.
 */
function updateSeats(g, s, dt) {
  for (const seat of s.seats) {
    seat.reload = Math.max(0, seat.reload - dt);
    if (seat.manual || seat.reload > 0) continue;
    let best = null, bd = TILE * 11;
    for (const m of s.monsters) {
      if (m.under) continue;
      const d = Math.hypot(m.x - s.x, m.y - s.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) seatFire(g, seat.uid, Math.atan2(best.y - s.y, best.x - s.x));
  }
}

/** controls: { throttle: -1..1, turn: -1..1, fire: bool } */
export function updateSailing(g, dt, controls = {}) {
  const s = g.sail;
  if (!s) return;
  const def = BOATS[s.type];
  const boat = fleetOf(g).find(b => b.id === s.boatId);
  if (!boat) { g.sail = null; return; }
  s.time += dt;
  s.reload = Math.max(0, s.reload - dt);

  // steering: turning is easier while moving
  const top = def.speed * TILE;
  const target = clamp(controls.throttle || 0, -0.4, 1) * top;
  s.speed += (target - s.speed) * Math.min(1, dt * 1.6);
  s.angle += (controls.turn || 0) * dt * (1.2 + Math.abs(s.speed) / top);
  const nx = s.x + Math.cos(s.angle) * s.speed * dt, ny = s.y + Math.sin(s.angle) * s.speed * dt;
  if (waterAt(g, nx, ny) && nx > TILE && ny > TILE && nx < (MAP_W - 1) * TILE && ny < (MAP_H - 1) * TILE) { s.x = nx; s.y = ny; }
  else { s.speed *= -0.3; s.bump = 0.3; }   // ran aground: bounce off the shore
  s.atEdge = s.x < TILE * 3 || s.y < TILE * 3 || s.x > (MAP_W - 3) * TILE || s.y > (MAP_H - 3) * TILE;
  if (Math.abs(s.speed) > TILE && chance(dt * 12)) s.wake.push({ x: s.x - Math.cos(s.angle) * TILE * 0.6, y: s.y - Math.sin(s.angle) * TILE * 0.6, life: 1.2 });
  for (const w of s.wake) w.life -= dt;
  s.wake = s.wake.filter(w => w.life > 0);
  if (controls.fire) fire(g);
  s.seats ||= [];
  updateSeats(g, s, dt);   // everyone else aboard looses at whatever is closest
  if (s.arena) {
    for (const o of s.others.values()) { o.x += (o.tx - o.x) * Math.min(1, dt * 6); o.y += (o.ty - o.y) * Math.min(1, dt * 6); const d = Math.atan2(Math.sin(o.ta - o.a), Math.cos(o.ta - o.a)); o.a += d * Math.min(1, dt * 6); }
    g.seaNet?.publish(s, boat);
  }

  // the sea rises: the further out and the longer you stay, the worse what comes up
  s.monsters ||= [];
  if (s.time >= s.nextRiseAt) {
    const tier = seaTier(g, s);
    const cap = 3 + Math.floor(tier * 0.8);
    if (s.monsters.length < cap) {
      const key = pickMonster(tier);
      const def = SEA_MONSTERS[key];
      const n = def.pack || 1;
      for (let i = 0; i < n; i++) spawnMonster(g, s, key, (x, y) => waterAt(g, x, y));
      if (def.boss) g.fx.shake = Math.max(g.fx.shake || 0, 2.5);
    }
    s.nextRiseAt = s.time + Math.max(6, 20 - seaTier(g, s) * 2) + Math.random() * 8;
  }

  // they hunt you their own way, and what they throw lands in the water with everything else
  updateMonsters(g, s, dt, {
    waterAt: (x, y) => waterAt(g, x, y),
    hit: (dmg) => {
      boat.hull -= dmg;
      g.fx.shake = Math.max(g.fx.shake || 0, 0.9);
      g.puff({ x: s.x, y: s.y }, 'boats/big_splash', 5, 18);
    },
    shoot: (m, a, def) => s.shots.push({
      x: m.x, y: m.y, vx: Math.cos(a) * TILE * (def.shotSpeed || 7), vy: Math.sin(a) * TILE * (def.shotSpeed || 7),
      left: BOMB_RANGE, dmg: def.dmg, heavy: true, mine: false, sprite: def.shot,
    }),
  });

  // bombs fly, hit or splash
  for (const b of s.shots) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.left -= Math.hypot(b.vx, b.vy) * dt;
    if (b.mine) {
      const m = s.monsters.find(m => Math.hypot(m.x - b.x, m.y - b.y) < TILE * (0.7 + (SEA_MONSTERS[m.t]?.size || 1) * 0.5) && !m.under);
      if (m) { damageMonster(g, s, m, b.dmg); b.left = -1; g.puff({ x: b.x, y: b.y }, 'effects/explosion', 6, 20); g.fx.shake = 0.4; continue; }
      if (s.arena) {
        const o = [...s.others.values()].find(o => Math.hypot(o.x - b.x, o.y - b.y) < TILE * 0.9);
        if (o) { b.left = -1; g.puff({ x: o.x, y: o.y }, 'effects/explosion', 6, 20); continue; }
      }
      const c = s.arena ? null : g.state.creatures.find(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - b.x, c.y - b.y) < TILE * 0.9);
      if (c) { damageCreature(g, c, b.dmg); b.left = -1; g.puff(c, 'effects/explosion', 5, 16); continue; }
    } else if (Math.hypot(s.x - b.x, s.y - b.y) < TILE * 0.8) {
      boat.hull -= b.dmg;
      if (b.from) s.lastHitBy = b.from;   // another player's bomb
      b.left = -1;
      g.puff({ x: s.x, y: s.y }, 'effects/explosion', 6, 20);
      g.fx.shake = 0.8;
      continue;
    }
    if (b.left <= 0 && !b.arrow) g.puff({ x: b.x, y: b.y }, 'boats/big_splash', 2, 8);
  }
  s.shots = s.shots.filter(b => b.left > 0);

  // sail over treasure to collect it
  for (const l of s.loot) {
    l.life -= dt;
    if (Math.hypot(l.x - s.x, l.y - s.y) < TILE) {
      g.addResource('gold', l.gold);
      s.gold += l.gold;
      if (chance(0.3)) g.addResource('gems', 1 + Math.floor(Math.random() * 3));
      g.float(l.x, l.y - TILE, `+${l.gold} gold`, '#ffd76a');
      l.life = 0;
    }
  }
  s.loot = s.loot.filter(l => l.life > 0);

  // sunk!
  if (boat.hull <= 0) {
    g.puff({ x: s.x, y: s.y }, 'boats/sinking_ship', 1, 2);
    g.puff({ x: s.x, y: s.y }, 'boats/debris', 4, 20);
    g.state.fleet = fleetOf(g).filter(b => b !== boat);
    if (s.arena && s.lastHitBy) g.seaNet?.sunk(s.lastHitBy, boat);
    if (s.arena) g.seaNet?.leave();
    g.log(`The ${boat.name} was sunk! The crew swim home, but the ship is lost.`, 'bad', { x: s.x, y: s.y });
    g.announce(`The ${boat.name} sank`);
    g.sail = null;
    g.emit('change');
  }
}

// ------------------------------------------------------------------ the Open Sea (shared with other players)

const OPEN_SEA_SEED = 424242;
let openSeaWorld = null;

/** The same ocean for everyone: deep water, shallows and a scatter of rocky islets. */
function oceanWorld() {
  if (openSeaWorld) return openSeaWorld;
  const w = new World(OPEN_SEA_SEED);
  w.tiles.fill(T.deep_water);
  let seed = OPEN_SEA_SEED;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 14; i++) {
    const cx = 10 + rnd() * (w.w - 20), cy = 10 + rnd() * (w.h - 20), r = 1.5 + rnd() * 3;
    for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++) {
      if (!w.inBounds(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < r * 0.55) w.tiles[y * w.w + x] = T.stone_path ?? T.sand;
      else if (d < r) w.tiles[y * w.w + x] = T.sand;
      else if (d < r + 2.5 && w.tiles[y * w.w + x] === T.deep_water) w.tiles[y * w.w + x] = T.water;
    }
  }
  w.version++;
  openSeaWorld = w;
  return w;
}

/** A view-only game that draws the Open Sea (the real village keeps running at home). */
export function makeSeaGame(home) {
  const world = oceanWorld();
  const state = {
    version: SAVE_VERSION, seed: OPEN_SEA_SEED, createdAt: 0, updatedAt: 0,
    owner: { uid: 'sea', name: 'The Open Sea', villageName: 'The Open Sea' },
    time: home.state.time, center: { x: world.w * TILE / 2, y: world.h * TILE / 2 },
    resources: {}, karma: 0, era: home.state.era, villagers: [], buildings: [], objects: [], creatures: [],
    stats: {}, log: [], modifiers: [], incoming: [], battles: {}, laws: { ...DEFAULT_LAWS }, lawChangedAt: {},
    nextEventAt: Infinity, lastDay: 0, shieldUntil: 0, camera: { x: 0, y: 0, zoom: 2 }, fleet: home.state.fleet,
  };
  const g = new Game(state);
  g.world = world;
  g.offline = true;
  g.visiting = false;
  g.newDay = () => {};
  g.update = () => {};           // nothing lives here; the time of day follows home
  g.fx = home.fx;                // explosions and splashes from home show up at sea
  Object.defineProperty(g, 'sail', { get: () => home.sail });
  Object.defineProperty(g, 'darkness', { get: () => home.darkness });
  return g;
}

/** Sail out of your waters onto the Open Sea, where other players' ships are. */
export function enterOpenSea(g, spawnAngle = 0) {
  const s = g.sail;
  if (!s || s.arena) return null;
  const seaGame = makeSeaGame(g);
  const w = seaGame.world;
  // arrive on the side of the ocean that faces your island on the World Map
  let x = w.w / 2 + Math.cos(spawnAngle) * w.w * 0.38, y = w.h / 2 + Math.sin(spawnAngle) * w.h * 0.38;
  for (let r = 0; r < 20 && !w.isWater(Math.floor(x), Math.floor(y)); r++) { x += (w.w / 2 - x) * 0.1; y += (w.h / 2 - y) * 0.1; }
  Object.assign(s, { arena: true, seaGame, x: x * TILE, y: y * TILE, angle: spawnAngle + Math.PI, speed: 0, shots: [], monsters: [], loot: [], wake: [], others: new Map(), nextRiseAt: s.time + 12, atEdge: false });
  g.log('You sail out onto the Open Sea. Other rulers\' ships may be out here...', 'event');
  return seaGame;
}

/** Network updates about other ships (called by the multiplayer layer). */
export function seaUpdate(g, uid, data) {
  const s = g.sail;
  if (!s?.arena) return;
  if (!data) { s.others.delete(uid); return; }
  const o = s.others.get(uid);
  if (o) Object.assign(o, { tx: data.x, ty: data.y, ta: data.a, hull: data.hull, max: data.max, type: data.type, name: data.name, village: data.village });
  else s.others.set(uid, { uid, x: data.x, y: data.y, a: data.a, tx: data.x, ty: data.y, ta: data.a, hull: data.hull, max: data.max, type: data.type, name: data.name, village: data.village });
}

/** A bomb fired by another player: it flies here too, and may hit us. */
export function seaIncomingShot(g, shot) {
  const s = g.sail;
  if (!s?.arena) return;
  const age = Math.max(0, (Date.now() - (shot.ts || Date.now())) / 1000);
  const x = shot.x + shot.vx * age, y = shot.y + shot.vy * age;
  const left = BOMB_RANGE - Math.hypot(shot.vx, shot.vy) * age;
  if (left <= 0) return;
  s.shots.push({ x, y, vx: shot.vx, vy: shot.vy, left, dmg: shot.dmg, heavy: true, mine: false, from: shot.from });
}
