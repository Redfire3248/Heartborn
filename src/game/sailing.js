import { TILE, MAP_W, MAP_H } from '../core/constants.js';
import { clamp, chance, pick } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { damageCreature } from './creatures.js';

/*
 * Sailing: build boats at a Shipyard, then take the helm yourself.
 * W/S (or the arrows) set the speed, A/D steer, Space fires bombs. Pirates and sea serpents come for you;
 * sink them for treasure, and don't let them sink you. Sail to the edge of your waters to reach other lands.
 */

// better ships with every era: [era, sprite, name, cost, hull, top speed (tiles/s), guns]
export const BOATS = {
  rowboat: { era: 1, name: 'Rowboat', cost: { wood: 30 }, hull: 40, speed: 2.6, guns: 1, desc: 'Two oars and a crate of bombs. Quick and fragile.' },
  longship: { era: 2, name: 'Longship', cost: { wood: 90, iron: 5 }, hull: 90, speed: 3.2, guns: 1, desc: 'A raider’s ship with a striped sail.' },
  galleon: { era: 3, name: 'Galleon', cost: { wood: 180, iron: 30, gold: 40 }, hull: 170, speed: 3.0, guns: 2, desc: 'Rows of cannons fire two bombs at once.' },
  ironclad: { era: 4, name: 'Ironclad', cost: { iron: 140, coal: 60, wood: 60 }, hull: 280, speed: 3.6, guns: 3, desc: 'Armoured steam warship.' },
  battleship: { era: 5, name: 'Battleship', cost: { iron: 260, coal: 120, gold: 150 }, hull: 420, speed: 4.2, guns: 4, desc: 'Steel turrets. The sea is yours.' },
  energy_battleship: { era: 6, name: 'Energy Battleship', cost: { iron: 400, science: 300, gems: 30 }, hull: 650, speed: 5.0, guns: 5, desc: 'Hovering warship of the future.' },
};

const BOMB_RANGE = 9 * TILE;
const BOMB_SPEED = 11 * TILE;
const RELOAD = 0.9;
const PIRATE_HULL = [30, 60, 110, 180, 260, 360, 480];
const PIRATE_SPRITE = ['boats/pirate_ship', 'boats/pirate_ship', 'boats/pirate_ship', 'boats/pirate_ship', 'boats/patrol_boat', 'boats/destroyer', 'boats/hover_boat'];

export const fleetOf = g => (g.state.fleet ||= []);
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
  const spot = launchSpot(g);
  if (!spot) return { error: 'The shipyard has no open water' };
  g.sail = { boatId, type: boat.type, x: spot.x, y: spot.y, angle: spot.angle, speed: 0, reload: 0, shots: [], pirates: [], loot: [], nextPirateAt: 20, time: 0, sunk: 0, gold: 0, wake: [] };
  g.log(`The ${boat.name} sets sail!`, 'event');
  g.emit('change');
  return { ok: true };
}

export function returnToPort(g) {
  const s = g.sail;
  if (!s) return;
  const boat = fleetOf(g).find(b => b.id === s.boatId);
  g.log(`The ${boat?.name || 'boat'} returns to port${s.sunk ? ` after sinking ${s.sunk} pirate${s.sunk === 1 ? '' : 's'}` : ''}${s.gold ? ` with ${s.gold} gold of treasure` : ''}.`, 'good');
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

const waterAt = (g, x, y) => g.world.isWater(Math.floor(x / TILE), Math.floor(y / TILE));

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
    s.shots.push({ x: s.x + Math.cos(a) * TILE * 0.7, y: s.y + Math.sin(a) * TILE * 0.7, vx: Math.cos(a) * BOMB_SPEED, vy: Math.sin(a) * BOMB_SPEED, left: BOMB_RANGE, dmg: heavy ? 30 : 8, heavy, mine: true });
  }
  s.reload = RELOAD;
  return true;
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

  // pirates show up after a while, tougher in later eras
  if (s.time >= s.nextPirateAt && s.pirates.length < 2 + Math.floor(g.state.era / 2)) {
    // look all around for open water to come from (near the island, most directions are land)
    let spawned = false;
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < 16 && !spawned; k++) {
      const a = a0 + (k / 16) * Math.PI * 2;
      for (let r = 8; r < 18; r++) {
        const px = s.x + Math.cos(a) * r * TILE, py = s.y + Math.sin(a) * r * TILE;
        if (px < TILE || py < TILE || px > (MAP_W - 1) * TILE || py > (MAP_H - 1) * TILE || !waterAt(g, px, py)) continue;
        const era = Math.min(6, g.state.era);
        s.pirates.push({ id: Math.random(), x: px, y: py, angle: a + Math.PI, hull: PIRATE_HULL[era], max: PIRATE_HULL[era], reload: 2, sprite: PIRATE_SPRITE[era] });
        g.log(chance(0.5) ? 'Pirates on the horizon!' : 'Black sails! Pirates are coming!', 'bad');
        spawned = true;
        break;
      }
    }
    s.nextPirateAt = s.time + (spawned ? 25 + Math.random() * 25 : 3);
  }

  // pirates chase the player and fire when close
  for (const p of s.pirates) {
    const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx) + (d < 4 * TILE ? Math.PI / 2 : 0);   // circle when close
    const diff = Math.atan2(Math.sin(want - p.angle), Math.cos(want - p.angle));
    p.angle += clamp(diff, -dt * 1.4, dt * 1.4);
    const sp = TILE * (1.6 + g.state.era * 0.25);
    const px = p.x + Math.cos(p.angle) * sp * dt, py = p.y + Math.sin(p.angle) * sp * dt;
    if (waterAt(g, px, py)) { p.x = px; p.y = py; } else p.angle += dt * 2;
    p.reload -= dt;
    if (p.reload <= 0 && d < 8 * TILE) {
      p.reload = 2.2 + Math.random();
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.25;
      s.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * BOMB_SPEED * 0.8, vy: Math.sin(a) * BOMB_SPEED * 0.8, left: BOMB_RANGE, dmg: 8 + g.state.era * 5, heavy: true, mine: false });
    }
  }

  // bombs fly, hit or splash
  for (const b of s.shots) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.left -= Math.hypot(b.vx, b.vy) * dt;
    if (b.mine) {
      const p = s.pirates.find(p => Math.hypot(p.x - b.x, p.y - b.y) < TILE * 0.9);
      if (p) { p.hull -= b.dmg; b.left = -1; g.puff(p, 'effects/explosion', 6, 20); g.fx.shake = 0.4; continue; }
      const c = g.state.creatures.find(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - b.x, c.y - b.y) < TILE * 0.9);
      if (c) { damageCreature(g, c, b.dmg); b.left = -1; g.puff(c, 'effects/explosion', 5, 16); continue; }
    } else if (Math.hypot(s.x - b.x, s.y - b.y) < TILE * 0.8) {
      boat.hull -= b.dmg;
      b.left = -1;
      g.puff({ x: s.x, y: s.y }, 'effects/explosion', 6, 20);
      g.fx.shake = 0.8;
      continue;
    }
    if (b.left <= 0) g.puff({ x: b.x, y: b.y }, 'boats/big_splash', 2, 8);
  }
  s.shots = s.shots.filter(b => b.left > 0);

  // sunk pirates leave treasure behind
  for (const p of s.pirates.filter(p => p.hull <= 0)) {
    s.sunk++;
    g.puff(p, 'boats/sinking_ship', 1, 2);
    g.puff(p, 'effects/explosion', 10, 30);
    s.loot.push({ x: p.x, y: p.y, gold: 20 + g.state.era * 25 + Math.floor(Math.random() * 30), life: 60 });
    g.float(p.x, p.y - TILE, 'Pirates sunk!', '#ffd76a');
    g.log('A pirate ship goes down!', 'good', p);
  }
  s.pirates = s.pirates.filter(p => p.hull > 0);

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
    g.log(`The ${boat.name} was sunk! The crew swim home, but the ship is lost.`, 'bad', { x: s.x, y: s.y });
    g.announce(`The ${boat.name} sank`);
    g.sail = null;
    g.emit('change');
  }
}
