import { TILE, SAVE_VERSION } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';
import { DEFAULT_LAWS } from '../data/laws.js';
import { T } from './world.js';
import { Game } from './game.js';
import { updateCreature, updateEnemyShots } from './creatures.js';
import { startLead, damageHero, knockOutHero, heroOf } from './hero.js';
import { rpgOf, gainXp } from './rpg.js';
import { hasTool } from './tools.js';
import { gameTheme } from './worldTypes.js';
export { entrancesOf, entranceNear } from './treasure.js';

/*
 * Dungeons: caves in the wilds around your land. Strike an entrance to go down.
 * Each floor is a new maze of rooms and corridors in the dark, lit by torches and the glow around you:
 * monsters in every room, spike traps, a chest or two, and a key somewhere that opens the boss door.
 * Slay the boss for its chest and the stairs down to a deeper, harder floor. Stairs up lead home.
 * Your realm keeps living while you are below; gold, gear and potions you find are yours.
 */

const W = 64, H = 64;
const WALL = T.deep_water;      // blocked tiles (drawn as rock walls by the renderer)
const FLOOR = T.cave_floor;

const POOLS = [
  ['slime', 'rat', 'bat', 'cave_spider', 'skeleton'],
  ['skeleton', 'skeleton_archer', 'goblin', 'zombie', 'bat', 'cave_spider'],
  ['skeleton_archer', 'dark_mage', 'zombie', 'fire_imp', 'mimic', 'ghost'],
  ['dark_mage', 'fire_imp', 'zombie', 'mimic', 'skeleton_archer', 'bandit'],
];
const BOSSES = ['cave_troll', 'slime_king', 'spider_queen', 'forest_spirit', 'stone_golem', 'lich'];

// ------------------------------------------------------------------ the maze

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Rooms joined by corridors; the boss room sits behind locked doors. Returns null if the layout is bad. */
export function generateFloor(seed, depth) {
  const r = rng(seed);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const tiles = new Uint8Array(W * H).fill(WALL);
  const rooms = [];
  const overlaps = (a, m = 2) => rooms.some(b => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y);
  const boss = { x: ri(4, W - 18), y: ri(4, H - 16), w: 13, h: 11, boss: true };
  rooms.push(boss);
  const want = Math.min(10, 6 + depth);
  for (let i = 0; i < 300 && rooms.length < want + 1; i++) {
    const room = { x: 0, y: 0, w: ri(6, 10), h: ri(5, 8) };
    room.x = ri(2, W - room.w - 3); room.y = ri(3, H - room.h - 3);
    if (!overlaps(room)) rooms.push(room);
  }
  if (rooms.length < 5) return null;
  const cx = a => a.x + (a.w >> 1), cy = a => a.y + (a.h >> 1);
  const dist = (a, b) => Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
  const others = rooms.filter(a => !a.boss);
  // start far from the boss, then walk from room to nearest room; the last one leads to the boss
  const start = others.reduce((a, b) => (dist(b, boss) > dist(a, boss) ? b : a));
  const chain = [start];
  const left = new Set(others.filter(a => a !== start));
  while (left.size) {
    const last = chain[chain.length - 1];
    const next = [...left].reduce((a, b) => (dist(last, b) < dist(last, a) ? b : a));
    chain.push(next); left.delete(next);
  }
  const set = (x, y, t) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) tiles[y * W + x] = t; };
  for (const a of rooms) for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) set(x, y, FLOOR);
  const inBoss = (x, y, m = 1) => x >= boss.x - m && x < boss.x + boss.w + m && y >= boss.y - m && y < boss.y + boss.h + m;
  const carve = (a, b, avoidBoss) => {
    const paths = [[cx(a), cy(a), cx(b), cy(a), cx(b), cy(b)], [cx(a), cy(a), cx(a), cy(b), cx(b), cy(b)]];
    const cells = p => {
      const out = [];
      for (let k = 0; k < 2; k++) {
        const [x0, y0, x1, y1] = [p[k * 2], p[k * 2 + 1], p[k * 2 + 2], p[k * 2 + 3]];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) {
          const x = x0 + Math.sign(x1 - x0) * i, y = y0 + Math.sign(y1 - y0) * i;
          out.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);   // two tiles wide
        }
      }
      return out;
    };
    let pick = cells(paths[r() < 0.5 ? 0 : 1]);
    if (avoidBoss) {
      const clean = paths.map(cells).find(c => !c.some(([x, y]) => inBoss(x, y, 2)));
      if (!clean) return false;
      pick = clean;
    }
    for (const [x, y] of pick) set(x, y, FLOOR);
    return true;
  };
  for (let i = 1; i < chain.length; i++) if (!carve(chain[i - 1], chain[i], true)) return null;
  // the way into the boss room comes in straight through one wall (never running along it), so it has one door
  {
    const last = chain[chain.length - 1];
    const dx = cx(boss) - cx(last), dy = cy(boss) - cy(last);
    const path = Math.abs(dx) > Math.abs(dy)
      ? [cx(last), cy(last), cx(last), cy(boss), cx(boss), cy(boss)]    // down or up first, then straight in from the side
      : [cx(last), cy(last), cx(boss), cy(last), cx(boss), cy(boss)];   // across first, then straight in from above or below
    for (let k = 0; k < 2; k++) {
      const [x0, y0, x1, y1] = [path[k * 2], path[k * 2 + 1], path[k * 2 + 2], path[k * 2 + 3]];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = x0 + Math.sign(x1 - x0) * i, y = y0 + Math.sign(y1 - y0) * i;
        if (k === 0 && inBoss(x, y, 1)) continue;   // the first leg keeps away from the boss room
        set(x, y, FLOOR); set(x + 1, y, FLOOR); set(x, y + 1, FLOOR); set(x + 1, y + 1, FLOOR);
      }
    }
  }
  // the doors: every open tile on the ring right around the boss room
  const doors = [];
  for (let y = boss.y - 1; y <= boss.y + boss.h; y++) for (let x = boss.x - 1; x <= boss.x + boss.w; x++) {
    if (inBoss(x, y, 0) || tiles[y * W + x] !== FLOOR) continue;
    doors.push({ x, y });
    tiles[y * W + x] = WALL;
  }
  if (!doors.length || doors.length > 3) return null;   // one clear doorway, not a wall of doors
  // everything but the boss room must be reachable from the start with the doors shut
  const seen = new Uint8Array(W * H);
  const q = [cy(start) * W + cx(start)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * W + x + dx;
      if (!seen[j] && tiles[j] === FLOOR) { seen[j] = 1; q.push(j); }
    }
  }
  if (others.some(a => !seen[cy(a) * W + cx(a)])) return null;
  if (!doors.some(d => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(d.y + dy) * W + d.x + dx]))) return null;
  return { tiles, rooms: chain, boss, start, doors, r };
}

// ------------------------------------------------------------------ a floor to play

/** Build a playable floor below `home` with a copy of your hero in it. */
export function makeDungeonGame(home, { depth = 1, entrance = null, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0 } = {}) {
  let layout = null;
  for (let i = 0; i < 40 && !layout; i++) layout = generateFloor(seed + i * 7919, depth);
  const { tiles, rooms, boss, start, doors, r } = layout;
  const center = { x: (start.x + start.w / 2) * TILE, y: (start.y + start.h / 2) * TILE };
  const state = {
    version: SAVE_VERSION, seed, createdAt: 0, updatedAt: 0,
    owner: home.state.owner, time: home.state.time, center,
    resources: home.state.resources, rpg: rpgOf(home), era: home.state.era, karma: 0, worldSeed: home.state.worldSeed ?? home.state.seed,
    villagers: [], buildings: [], objects: [], creatures: [], chests: [], groundItems: [],
    stats: {}, log: [], modifiers: [], incoming: [], battles: {}, laws: { ...DEFAULT_LAWS }, lawChangedAt: {},
    nextEventAt: Infinity, lastDay: Infinity, shieldUntil: 0, camera: { x: 0, y: 0, zoom: 2.4 }, autoPick: false,
  };
  const g = new Game(state);
  g.world.w = W; g.world.h = H; g.world.tiles = tiles; g.world.objGrid = new Map(); g.world.version++;
  g.newDay = () => {};
  g.triggerRandomEvent = () => {};
  g.log = () => {};                                 // monster chatter stays down here
  g.announce = text => home.announce(text);
  g.addResource = (res, n) => home.addResource(res, n);
  Object.defineProperty(g, 'isNight', { get: () => true });
  Object.defineProperty(g, 'darkness', { get: () => 1 });
  const emit = g.emit.bind(g);
  g.emit = (name, data) => { emit(name, data); if (name === 'change') home.emit('change'); };   // loot and level-ups refresh the screens
  Object.defineProperty(g, 'center', { get: () => center });

  const rc = a => ({ x: (a.x + a.w / 2) * TILE, y: (a.y + a.h / 2) * TILE });
  const spot = (a, pad = 1) => ({ x: (a.x + pad + r() * (a.w - pad * 2)) * TILE, y: (a.y + pad + r() * (a.h - pad * 2)) * TILE });
  const d = g.dungeon = {
    depth, entrance, home, boss, doors, hasKey: false, open: false, bossId: null, cleared: false,
    exit: rc(start), stairsDown: null, traps: [], torches: [], props: [], key: null, leftExit: false, event: null,
    seen: new Uint8Array(W * H),   // the dungeon map: tiles you have been near
  };
  // decoration: bones and skulls on the floor, cobwebs in corners, pillars, crystals, cages and chains
  const FLOOR_PROPS = ['bones', 'skull_pile', 'rubble', 'puddle', 'floor_grate', 'broken_barrel', 'glow_crystal', 'pillar', 'cage', 'chains'];
  for (const a of [...rooms, boss]) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const p = spot(a, 1); d.props.push({ kind: FLOOR_PROPS[Math.floor(r() * FLOOR_PROPS.length)], x: p.x, y: p.y }); }
    d.webs = d.webs || [];
    d.webs.push({ tx: a.x, ty: a.y - 1, flip: false });
    if (r() < 0.5) d.webs.push({ tx: a.x + a.w - 1, ty: a.y - 1, flip: true });
  }
  d.props.push({ kind: 'altar', x: (boss.x + boss.w / 2) * TILE, y: (boss.y + 1.2) * TILE });

  // torches on the top wall of every room
  for (const a of [...rooms, boss]) {
    for (let x = a.x + 1; x < a.x + a.w - 1; x += 4 + Math.floor(r() * 2)) d.torches.push({ x: (x + 0.5) * TILE, y: a.y * TILE, kind: a === boss ? 'gold_sconce' : r() < 0.12 ? 'soul_torch' : r() < 0.08 ? 'wall_torch_unlit' : 'wall_torch' });
  }
  // fire on the floor: braziers, candles and skull candles (they light the room too)
  for (const a of rooms) if (r() < 0.45) { const p = spot(a, 1); d.props.push({ kind: ['lights/brazier', 'lights/candles', 'lights/skull_candle'][Math.floor(r() * 3)], x: p.x, y: p.y, light: true }); }
  d.props.push({ kind: 'lights/brazier', x: (boss.x + boss.w / 2 - 2) * TILE, y: (boss.y + 1.4) * TILE, light: true }, { kind: 'lights/brazier', x: (boss.x + boss.w / 2 + 2) * TILE, y: (boss.y + 1.4) * TILE, light: true });
  const theme = gameTheme(home);
  const pool = [...POOLS[Math.min(POOLS.length - 1, depth - 1)], ...theme.dungeon];
  const toughness = 1 + (depth - 1) * 0.4;
  const middle = rooms.slice(1);
  // the key waits in the room farthest along the way
  const keyRoom = middle[middle.length - 1] || start;
  d.key = rc(keyRoom);
  middle.forEach((a, i) => {
    const n = 1 + Math.floor(a.w * a.h / 22) + Math.floor(depth / 2);
    for (let k = 0; k < n; k++) {
      const p = spot(a);
      const c = g.spawnCreature(pool[Math.floor(r() * pool.length)], p.x, p.y, { hpMult: toughness });
      if (c) c.dmgMult = 1 + (depth - 1) * 0.25;
    }
    if (a === keyRoom || r() < 0.35) { const p = spot(a, 1.5); state.chests.push({ id: `dch${i}`, x: p.x, y: p.y, tier: a === keyRoom || r() < 0.3 ? 1 : 0 }); }
    for (let k = 0, t = Math.floor(r() * 3) + (depth > 1 ? 1 : 0); k < t; k++) {
      const p = spot(a, 1);
      d.traps.push({ tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), offset: r() * 2.4, cd: 0 });
    }
  });
  const bc = rc(boss);
  const order = [...theme.bosses, ...BOSSES.filter(b => !theme.bosses.includes(b))];   // this world's own bosses come first
  const bossType = depth % 5 === 0 ? 'ashen_knight' : order[(depth - 1) % order.length];   // every fifth floor: the Ashen Knight
  const bossMonster = g.spawnCreature(bossType, bc.x, bc.y, { hpMult: 0.7 + (depth - 1) * 0.5, dungeonBoss: true, scale: 1.15 });
  if (bossMonster) { bossMonster.dmgMult = 0.8 + (depth - 1) * 0.25; d.bossId = bossMonster.id; }
  for (let k = 0; k < 1 + Math.floor(depth / 2); k++) { const p = spot(boss, 2); g.spawnCreature(pool[0], p.x, p.y, { hpMult: toughness }); }

  // you: a copy of your hero (hp and position are handed back when you leave; gear, gold and your pack are shared)
  const v = heroOf(home) || home.state.villagers.find(x => x.ruling) || home.state.villagers[0];
  if (v) {
    const copy = { ...JSON.parse(JSON.stringify({ ...v, inv: null, _task: null })), inv: v.inv, away: null };
    copy.x = d.exit.x; copy.y = d.exit.y + TILE * 2;
    state.villagers.push(copy);
    startLead(g, copy);
    if (home.hero) Object.assign(g.hero, { kills: home.hero.kills || 0, finds: home.hero.finds || 0, chopped: home.hero.chopped || 0 });
    g.hero.bountyAt = Infinity;
    g.hero.iframes = 1;
    d.homeHeroId = v.id;
  }

  const update = g.update.bind(g);
  g.update = dt => { if (!home.paused && !home.pendingEvent) update(dt); };   // an event at home pauses the dungeon too
  g.step = dt => {
    state.time += dt;
    for (const c of [...state.creatures]) updateCreature(g, c, dt);
    updateEnemyShots(g, dt);
    updateDungeon(g, dt);
  };
  return g;
}

/** Stairs, the key, the boss door, spike traps and the boss. Sets `dungeon.event` for the HUD to act on. */
export function updateDungeon(g, dt) {
  const d = g.dungeon;
  const v = heroOf(g);
  if (!d || !v) return;
  const near = (p, r) => Math.hypot(p.x - v.x, p.y - v.y) < r;
  // reveal the map around you
  if (d.seen) {
    const hx = Math.floor(v.x / TILE), hy = Math.floor(v.y / TILE), R = 7;
    for (let y = Math.max(0, hy - R); y <= Math.min(H - 1, hy + R); y++) for (let x = Math.max(0, hx - R); x <= Math.min(W - 1, hx + R); x++) {
      if ((x - hx) ** 2 + (y - hy) ** 2 <= R * R) d.seen[y * W + x] = 1;
    }
  }
  if (!d.leftExit && !near(d.exit, TILE * 1.6)) d.leftExit = true;
  if (d.leftExit && near(d.exit, TILE * 0.7)) d.event ||= 'exit';
  if (d.stairsDown && near(d.stairsDown, TILE * 0.7)) d.event ||= 'down';

  if (d.key && near(d.key, TILE * 0.8)) {
    d.key = null; d.hasKey = true;
    g.float(v.x, v.y - TILE * 1.4, 'Boss key!', '#ffd76a');
    g.anim('combat/hit', v.x, v.y - 8, { size: 22, dur: 0.3 });
    g.announce?.('You found the boss key');
  }
  if (!d.open && d.doors.some(p => near({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }, TILE * 1.6))) {
    if (d.hasKey || hasTool(g, 'lockpick')) { if (!d.hasKey) g.float(v.x, v.y - TILE * 1.4, 'Picked the lock!', '#ffd76a'); openDoors(g); }
    else if (!d._lockedMsg || g.state.time > d._lockedMsg) { d._lockedMsg = g.state.time + 3; g.float(v.x, v.y - TILE * 1.4, 'Locked: find the key', '#ff9f7a'); }
  }

  // spikes pop up and down; stepping on raised spikes hurts
  const h = g.hero;
  const tx = Math.floor(v.x / TILE), ty = Math.floor(v.y / TILE);
  for (const t of d.traps) {
    t.cd = Math.max(0, t.cd - dt);
    if (!trapUp(g, t) || t.tx !== tx || t.ty !== ty || t.cd > 0 || h.dash) continue;
    t.cd = 0.9;
    const dmg = damageHero(g, v, 6 + d.depth * 3, null);
    if (dmg > 0) { v.hp -= dmg; g.float(v.x, v.y - TILE * 1.2, `-${Math.round(dmg)}`, '#ff6b6b'); if (v.hp <= 0) knockOutHero(g, v); }
  }

  if (!d.cleared && d.bossId && !g.state.creatures.some(c => c.id === d.bossId)) {
    d.cleared = true;
    const b = d.boss;
    d.stairsDown = { x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2 + 2) * TILE };
    const r = rpgOf(g);
    r.deepest = Math.max(r.deepest || 0, d.depth);
    g.addResource('gold', 40 * d.depth);
    gainXp(g, 60 * d.depth, v);
    g.announce?.(`Floor ${d.depth} cleared! Stairs lead deeper`);
    g.float(v.x, v.y - TILE * 1.6, `Floor cleared! +${40 * d.depth} gold`, '#ffd76a');
    g.fx.shake = 1.5;
  }
}

export const trapUp = (g, t) => ((g.state.time + t.offset) % 2.4) > 1.5;

function openDoors(g) {
  const d = g.dungeon;
  d.open = true;
  for (const p of d.doors) {
    g.world.tiles[p.y * g.world.w + p.x] = FLOOR;
    g.anim('combat/poof', (p.x + 0.5) * TILE, (p.y + 0.5) * TILE, { size: TILE * 1.2, dur: 0.4 });
  }
  g.world.version++;
  g.fx.shake = 1;
  g.announce?.('The boss door opens...');
}

/** Hand your hero back to your land (after leaving or being knocked out). */
export function returnFromDungeon(home, dg, { knockedOut = false } = {}) {
  const d = dg.dungeon;
  const copy = heroOf(dg) || dg.state.villagers[0];
  const v = home.state.villagers.find(x => x.id === d.homeHeroId);
  if (v) {
    v.away = null;
    if (copy) v.hp = Math.max(1, copy.hp);
    const e = d.entrance;
    if (e && !knockedOut) { v.x = e.x; v.y = e.y + TILE * 1.4; }
    else { v.x = home.center.x + 20; v.y = home.center.y + 20; }
    startLead(home, v);
    if (home.hero && dg.hero) Object.assign(home.hero, { kills: dg.hero.kills, finds: dg.hero.finds, iframes: 1.5 });
  }
}

/** Take your hero off the surface while you are below. */
export function leaveSurface(home, dg) {
  const v = home.state.villagers.find(x => x.id === dg.dungeon.homeHeroId);
  home.hero = null;
  if (v) { v.away = { until: Date.now() + 120_000, dungeon: true }; v._task = null; }
}

export const bossOf = g => g.dungeon?.bossId ? g.state.creatures.find(c => c.id === g.dungeon.bossId) || null : null;
export { CREATURES };
