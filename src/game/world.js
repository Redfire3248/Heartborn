import { MAP_W, MAP_H, TILE } from '../core/constants.js';
import { makeNoise } from '../core/noise.js';
import { makeRng, weighted } from '../core/rng.js';
import { OBJECTS } from '../data/objects.js';
import { themeOf, makeBiomes, BIOME_KEYS, LEGACY_SIZE, THEMES } from './worldTypes.js';

export const TILES = [
  'tile_deep_water', 'tile_water', 'tile_sand', 'tile_grass', 'tile_grass_flowers', 'tile_dirt',
  'tile_swamp', 'tile_cave_floor', 'tile_snow', 'tile_lava', 'tile_stone_path', 'tile_tilled_soil',
];
export const T = Object.fromEntries(TILES.map((k, i) => [k.replace('tile_', ''), i]));
const BLOCKED = new Set([T.deep_water, T.water, T.lava]);

export class World {
  constructor(seed, size = MAP_W) {
    this.seed = seed;
    this.w = size;
    this.h = size;
    this.tiles = new Uint8Array(this.w * this.h);
    this.objGrid = new Map();   // tile index -> object
    this.version = 0;           // bumps when tiles change so the renderer can redraw
    generateTiles(this);
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  tile(tx, ty) { return this.inBounds(tx, ty) ? this.tiles[ty * this.w + tx] : T.deep_water; }
  setTile(tx, ty, t) { if (this.inBounds(tx, ty)) { this.tiles[ty * this.w + tx] = t; this.version++; } }
  walkableTile(tx, ty) { return this.inBounds(tx, ty) && !BLOCKED.has(this.tile(tx, ty)); }
  walkable(x, y) { return this.walkableTile(Math.floor(x / TILE), Math.floor(y / TILE)); }
  isWater(tx, ty) { const t = this.tile(tx, ty); return t === T.water || t === T.deep_water; }

  nearWater(tx, ty, size = 1) {
    for (let y = ty - 1; y <= ty + size; y++) for (let x = tx - 1; x <= tx + size; x++) {
      if (this.isWater(x, y)) return true;
    }
    return false;
  }

  indexObjects(objects) {
    this.objGrid.clear();
    for (const o of objects) this.objGrid.set(o.y * this.w + o.x, o);
  }
  objectAt(tx, ty) { return this.objGrid.get(ty * this.w + tx) || null; }
  addObject(objects, o) { objects.push(o); this.objGrid.set(o.y * this.w + o.x, o); }
  removeObject(objects, o) {
    const i = objects.indexOf(o);
    if (i >= 0) objects.splice(i, 1);
    if (this.objGrid.get(o.y * this.w + o.x) === o) this.objGrid.delete(o.y * this.w + o.x);
  }

  /** Straight walk possible without crossing blocked tiles? */
  clearLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / 10);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /** A* over tiles. Returns world-space waypoints (tile centres) or null. */
  findPath(x0, y0, x1, y1, maxNodes = 5000) {
    if (this.clearLine(x0, y0, x1, y1)) return [{ x: x1, y: y1 }];
    const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE);
    let gx = Math.floor(x1 / TILE), gy = Math.floor(y1 / TILE);
    if (!this.walkableTile(gx, gy)) {
      const alt = this.nearestWalkable(gx, gy);
      if (!alt) return null;
      [gx, gy] = alt;
    }
    const W = this.w;
    const start = sy * W + sx, goal = gy * W + gx;
    const g = new Map([[start, 0]]);
    const came = new Map();
    const open = [{ i: start, f: 0 }];
    const closed = new Set();
    let expanded = 0;
    while (open.length && expanded++ < maxNodes) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const { i } = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (i === goal) break;
      if (closed.has(i)) continue;
      closed.add(i);
      const cx = i % W, cy = (i - cx) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.walkableTile(nx, ny)) continue;
        if (dx && dy && (!this.walkableTile(cx + dx, cy) || !this.walkableTile(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        const cost = g.get(i) + (dx && dy ? 1.414 : 1);
        if (cost < (g.get(ni) ?? Infinity)) {
          g.set(ni, cost);
          came.set(ni, i);
          open.push({ i: ni, f: cost + Math.hypot(gx - nx, gy - ny) });
        }
      }
    }
    if (!came.has(goal)) return null;
    const path = [];
    for (let i = goal; i !== start; i = came.get(i)) {
      const px = i % W;
      path.push({ x: px * TILE + TILE / 2, y: ((i - px) / W) * TILE + TILE / 2 });
    }
    path.reverse();
    path[path.length - 1] = { x: x1, y: y1 };
    return path;
  }

  nearestWalkable(tx, ty, radius = 6) {
    for (let r = 1; r <= radius; r++) {
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (this.walkableTile(x, y)) return [x, y];
      }
    }
    return null;
  }
}

function generateTiles(world) {
  const { w, h, seed } = world;
  world.biomes = w === LEGACY_SIZE ? new Uint8Array(w * h).fill(BIOME_KEYS.indexOf(themeOf(seed))) : makeBiomes(seed, w, h);
  const height = makeNoise(seed);
  const moist = makeNoise(seed + 101);
  const detail = makeNoise(seed + 202);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5, ny = y / h - 0.5;
      const d = Math.min(1, Math.hypot(nx, ny) * 2);
      let e = height(x * 0.055, y * 0.055, 5) * 0.95 + 0.3 - Math.pow(d, 2.6) * 0.85;
      // the heart of the island stays gentle meadow so every village starts fair
      if (d < 0.32) e = Math.min(e, 0.6 + Math.max(0, d - 0.18) * 0.8);
      const m = moist(x * 0.07, y * 0.07, 3);
      const dt = detail(x * 0.3, y * 0.3, 2);
      let t;
      if (e < 0.29) t = T.deep_water;
      else if (e < 0.36) t = T.water;
      else if (e < 0.40) t = T.sand;
      else if (e > 0.86 && m < 0.4) t = T.lava;
      else if (e > 0.76) t = T.snow;
      else if (e > 0.68) t = T.cave_floor;
      else if (m > 0.64 && e < 0.5) t = T.swamp;
      else if (m < 0.34) t = dt > 0.55 ? T.sand : T.dirt;
      else t = dt > 0.72 ? T.grass_flowers : T.grass;
      // the biome reshapes the land
      const theme = BIOME_KEYS[world.biomes[y * w + x]];
      const land = t !== T.deep_water && t !== T.water;
      switch (theme) {
        case 'frozen': if (land && t !== T.lava && (t !== T.sand || dt > 0.4)) t = e > 0.72 ? T.cave_floor : T.snow; if (t === T.lava) t = T.snow; break;
        case 'volcanic': if (t === T.grass || t === T.grass_flowers) t = m < 0.55 ? T.dirt : t; if (t === T.snow) t = T.cave_floor; if (land && e > 0.7 && dt > 0.62) t = T.lava; break;
        case 'desert': if (t === T.grass || t === T.grass_flowers) t = dt > 0.35 ? T.sand : T.dirt; if (t === T.swamp || t === T.snow) t = T.sand; break;
        case 'haunted': if ((t === T.grass || t === T.grass_flowers) && m > 0.42) t = T.swamp; if (t === T.grass_flowers) t = T.dirt; if (t === T.snow) t = T.dirt; break;
        case 'jungle': if (t === T.dirt || (t === T.sand && dt < 0.5)) t = T.grass; if (t === T.snow) t = T.grass; if (land && m > 0.58 && e < 0.55) t = T.swamp; break;
        case 'crystal': if (land && e > 0.56 && t !== T.lava) t = T.cave_floor; if (t === T.lava) t = T.cave_floor; break;
      }
      world.tiles[y * w + x] = t;
    }
  }
  // guarantee a green start around the centre
  const cx = w >> 1, cy = h >> 1;
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    if (Math.hypot(x - cx, y - cy) <= 4.5) {
      const t = world.tiles[y * w + x];
      if (t !== T.grass && t !== T.grass_flowers) world.tiles[y * w + x] = T.grass;
    }
  }
}

let nextObjId = 1;
export const newObjId = () => `o${Date.now().toString(36)}${(nextObjId++).toString(36)}`;

/** Initial objects + creatures for a brand-new world. */
export function populateWorld(world) {
  const r = makeRng(world.seed + 7);
  let theme = themeOf(world.seed);
  const forest = makeNoise(world.seed + 303);
  const objects = [];
  const creatures = [];
  const cx = world.w >> 1, cy = world.h >> 1;

  const place = (t, x, y) => {
    if (world.objectAt(x, y)) return;
    const def = OBJECTS[t];
    world.addObject(objects, { id: newObjId(), t, x, y, charges: def.charges || 0 });
  };

  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      if (Math.hypot(x - cx, y - cy) < 5) continue;
      const tile = world.tile(x, y);
      theme = BIOME_KEYS[world.biomes[y * world.w + x]] || 'meadow';
      const f = forest(x * 0.08, y * 0.08, 3);
      const roll = r();
      const choose = table => { const it = weighted(table, r); if (it.t) place(it.t, x, y); };

      if (tile === T.grass || tile === T.grass_flowers) {
        const treeChance = (f > 0.56 ? 0.32 : 0.025) * (theme === 'jungle' ? 2.2 : theme === 'haunted' ? 0.6 : 1);
        if (roll < treeChance) choose(theme === 'jungle' ? [{ t: 'tree_palm', weight: 45 }, { t: 'tree_apple', weight: 30 }, { t: 'tree_oak', weight: 25 }]
          : theme === 'haunted' ? [{ t: 'tree_dead', weight: 80 }, { t: 'tree_pine', weight: 20 }]
            : [{ t: 'tree_oak', weight: 60 }, { t: 'tree_pine', weight: 25 }, { t: 'tree_apple', weight: 15 }]);
        else if (roll < treeChance + 0.07) choose([
          { t: 'berry_bush', weight: 22 }, { t: 'tall_grass', weight: 25 }, { t: 'flowers', weight: 18 },
          { t: 'rock', weight: 8 }, { t: 'mushroom', weight: f > 0.56 ? 14 : 3 }, { t: 'fallen_log', weight: 6 },
          { t: 'pumpkin', weight: 3 }, { t: 'carrot', weight: 4 }, { t: 'wheat', weight: 5 },
        ]);
      } else if (tile === T.dirt) {
        if (roll < (theme === 'volcanic' ? 0.12 : 0.06)) choose(theme === 'volcanic'
          ? [{ t: 'rock', weight: 40 }, { t: 'coal_ore', weight: 30 }, { t: 'iron_ore', weight: 15 }, { t: 'gold_ore', weight: 8 }, { t: 'tree_dead', weight: 7 }]
          : [{ t: 'tree_dead', weight: 40 }, { t: 'rock', weight: 45 }, { t: 'coal_ore', weight: 10 }, { t: 'fallen_log', weight: 5 }]);
      } else if (tile === T.sand) {
        if (roll < (theme === 'desert' ? 0.08 : 0.05)) place(world.nearWater(x, y) ? 'tree_palm' : theme === 'desert' && roll < 0.012 ? 'gold_ore' : 'cactus', x, y);
      } else if (tile === T.swamp) {
        if (roll < 0.14) choose([{ t: 'reeds', weight: 50 }, { t: 'mushroom', weight: 25 }, { t: 'tree_dead', weight: 15 }, { t: 'berry_bush', weight: 10 }]);
      } else if (tile === T.cave_floor) {
        if (roll < 0.22) choose(theme === 'crystal' ? [
          { t: 'rock', weight: 30 }, { t: 'iron_ore', weight: 15 }, { t: 'gold_ore', weight: 12 }, { t: 'gem_ore', weight: 20 }, { t: 'crystal_cluster', weight: 18 }, { t: 'coal_ore', weight: 5 },
        ] : [
          { t: 'rock', weight: 50 }, { t: 'coal_ore', weight: 18 }, { t: 'iron_ore', weight: 15 },
          { t: 'gold_ore', weight: 7 }, { t: 'gem_ore', weight: 5 }, { t: 'crystal_cluster', weight: 2 },
        ]);
      } else if (tile === T.snow) {
        if (roll < 0.1) choose([{ t: 'tree_snowy_pine', weight: 75 }, { t: 'rock', weight: 15 }, { t: 'crystal_cluster', weight: 3 }, { t: 'iron_ore', weight: 7 }]);
      }
      // every biome has its own ores in its rocky ground
      const wild = theme === 'volcanic' || theme === 'frozen' || theme === 'crystal';   // harsh biomes: ore pokes out anywhere
      const rocky = tile === T.cave_floor || tile === T.dirt || tile === T.snow || (tile === T.sand && theme === 'desert') || (wild && tile !== T.water && tile !== T.deep_water && tile !== T.lava);
      if (rocky && !world.objectAt(x, y) && r() < (tile === T.cave_floor ? 0.07 : 0.025)) {
        const ores = THEMES[theme]?.ores || ['copper_ore'];
        place(ores[Math.floor(r() * ores.length)], x, y);
      }
      if (tile === T.water && roll < 0.02) {
        // fish live in shallow water
        creatures.push(makeCreature('fish', x, y));
      }
    }
  }

  // a little rocky outcrop near home: stone, coal, copper and iron, so the first tools are close by
  {
    const a0 = r() * Math.PI * 2;
    const ox = Math.round(cx + Math.cos(a0) * 9), oy = Math.round(cy + Math.sin(a0) * 9);
    const pieces = ['rock', 'rock', 'rock', 'rock', 'rock', 'coal_ore', 'coal_ore', 'copper_ore', 'copper_ore', 'iron_ore', 'iron_ore'];
    let placed = 0;
    for (let tries = 0; tries < 120 && placed < pieces.length; tries++) {
      const x = ox + Math.round((r() - 0.5) * 7), y = oy + Math.round((r() - 0.5) * 7);
      if (!world.walkableTile?.(x, y) || world.objectAt(x, y) || Math.hypot(x - cx, y - cy) < 5) continue;
      place(pieces[placed++], x, y);
    }
  }

  // a few ruins far from home to explore
  let ruins = 0;
  for (let tries = 0; tries < 400 && ruins < 5; tries++) {
    const x = Math.floor(r() * world.w), y = Math.floor(r() * world.h);
    const t = world.tile(x, y);
    if (Math.hypot(x - cx, y - cy) > 18 && (t === T.grass || t === T.dirt || t === T.sand) && !world.objectAt(x, y)) {
      place('ruins', x, y); ruins++;
    }
  }

  const spawnOn = (type, n, okTile, minDist = 8) => {
    for (let tries = 0, made = 0; tries < n * 60 && made < n; tries++) {
      const x = Math.floor(r() * world.w), y = Math.floor(r() * world.h);
      if (okTile(world.tile(x, y)) && Math.hypot(x - cx, y - cy) >= minDist) {
        creatures.push(makeCreature(type, x, y)); made++;
      }
    }
  };
  const green = t => t === T.grass || t === T.grass_flowers || t === T.snow || t === T.swamp;
  spawnOn('deer', 8, green);
  spawnOn('rabbit', 10, green, 5);
  spawnOn('boar', 4, t => green(t) || t === T.dirt, 12);
  spawnOn('chicken', 3, green, 6);
  spawnOn('cow', 3, green, 8);
  spawnOn('sheep', 3, green, 8);
  spawnOn('pig', 2, green, 8);
  spawnOn('horse', 2, green, 12);
  spawnOn('snake', 3, t => t === T.swamp || t === T.sand, 14);
  spawnOn('wolf', 3, t => green(t) || t === T.snow, 24);
  spawnOn('bear', 2, t => green(t) || t === T.snow, 26);

  return { objects, creatures, start: { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 } };
}

let nextCreatureId = 1;
export function makeCreature(t, tx, ty, world = null) {
  return {
    id: `c${Date.now().toString(36)}${(nextCreatureId++).toString(36)}`,
    t, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, hp: null, // hp filled from def on first update
  };
}
