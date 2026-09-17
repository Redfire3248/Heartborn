import { TILE } from '../core/constants.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { ITEMS } from '../data/people.js';
import { rpgOf } from './rpg.js';

/*
 * Houses you can walk into. Every home (tent to arcology) has an outside look you choose, and an
 * inside you build in an isometric view: furniture, storage and stairs to the floors above.
 * - Storage furniture raises your village's storage limits AND holds items and gear you put in it.
 * - Stairs take you up a floor; the landing at the top of them takes you back down.
 */

/** Outside looks: a picture of its own when the art exists, otherwise a colour wash over the usual art. */
export const DESIGNS = [
  { name: 'Classic', tint: null },
  { name: 'Terracotta', tint: '#ff8a5a' },
  { name: 'Slate', tint: '#7fa8ff' },
  { name: 'Mossy', tint: '#8fe07a' },
  { name: 'Royal', tint: '#c9a0ff' },
];

/*
 * Furniture. w×d is the footprint in floor tiles, h the height (for drawing), color its fallback paint.
 * storage: extra storage for your village; slots: stacks of items/gear it can hold.
 */
export const FURNITURE = {
  // storage
  chest:        { name: 'Chest',          cat: 'storage', w: 1, d: 1, h: 40, color: '#9c6a3c', cost: { wood: 15 },              storage: 40,  slots: 8 },
  big_chest:    { name: 'Iron Chest',     cat: 'storage', w: 2, d: 1, h: 44, color: '#6f7480', cost: { wood: 20, iron: 10 },    storage: 120, slots: 16 },
  barrel:       { name: 'Barrel',         cat: 'storage', w: 1, d: 1, h: 46, color: '#8a5a32', cost: { wood: 12 },              storage: 30,  slots: 4 },
  crates:       { name: 'Crate Stack',    cat: 'storage', w: 1, d: 1, h: 54, color: '#b08850', cost: { wood: 18 },              storage: 50,  slots: 6 },
  shelf:        { name: 'Storage Shelf',  cat: 'storage', w: 1, d: 1, h: 84, color: '#7d5230', cost: { wood: 25 },              storage: 60,  slots: 10 },
  wardrobe:     { name: 'Wardrobe',       cat: 'storage', w: 1, d: 1, h: 90, color: '#6b4428', cost: { wood: 30 },              storage: 30,  slots: 12 },
  pantry:       { name: 'Pantry',         cat: 'storage', w: 2, d: 1, h: 80, color: '#a07848', cost: { wood: 30, stone: 10 },   storage: 90,  slots: 8 },
  weapon_rack:  { name: 'Weapon Rack',    cat: 'storage', w: 2, d: 1, h: 64, color: '#5a4030', cost: { wood: 20, iron: 8 },     storage: 20,  slots: 8 },
  vault:        { name: 'Vault',          cat: 'storage', w: 1, d: 1, h: 58, color: '#4c5260', cost: { stone: 60, iron: 40 },   storage: 300, slots: 30, era: 3 },
  // living
  bed:          { name: 'Bed',            cat: 'living',  w: 1, d: 2, h: 62, color: '#c94f4f', cost: { wood: 20 } },
  double_bed:   { name: 'Double Bed',     cat: 'living',  w: 2, d: 2, h: 68, color: '#4f78c9', cost: { wood: 35 } },
  cradle:       { name: 'Cradle',         cat: 'living',  w: 1, d: 1, h: 44, color: '#e0c090', cost: { wood: 10 } },
  sofa:         { name: 'Sofa',           cat: 'living',  w: 2, d: 1, h: 44, color: '#8a3f6a', cost: { wood: 20 } },
  armchair:     { name: 'Armchair',       cat: 'living',  w: 1, d: 1, h: 48, color: '#6a8a3f', cost: { wood: 12 } },
  table:        { name: 'Table',          cat: 'living',  w: 2, d: 1, h: 46, color: '#a0703c', cost: { wood: 15 } },
  round_table:  { name: 'Round Table',    cat: 'living',  w: 1, d: 1, h: 46, color: '#b07a40', cost: { wood: 10 } },
  chair:        { name: 'Chair',          cat: 'living',  w: 1, d: 1, h: 46, color: '#8a5a32', cost: { wood: 5 } },
  stool:        { name: 'Stool',          cat: 'living',  w: 1, d: 1, h: 26,  color: '#9c6a3c', cost: { wood: 3 } },
  desk:         { name: 'Desk',           cat: 'living',  w: 2, d: 1, h: 56, color: '#704a2a', cost: { wood: 20 } },
  crafting_table: { name: 'Crafting Table', cat: 'living', w: 1, d: 1, h: 46, color: '#9a6a3a', cost: { wood: 10 }, station: true },
  bookshelf:    { name: 'Bookshelf',      cat: 'living',  w: 1, d: 1, h: 88, color: '#5f3f24', cost: { wood: 25 } },
  bunk_bed:     { name: 'Bunk Bed',       cat: 'living',  w: 1, d: 2, h: 84, color: '#8a5a32', cost: { wood: 30 } },
  nightstand:   { name: 'Nightstand',     cat: 'living',  w: 1, d: 1, h: 36, color: '#7d5230', cost: { wood: 8 } },
  bench:        { name: 'Bench',          cat: 'living',  w: 2, d: 1, h: 42, color: '#9c6a3c', cost: { wood: 10 } },
  dresser:      { name: 'Dresser',        cat: 'storage', w: 2, d: 1, h: 52, color: '#6b4428', cost: { wood: 25 },              storage: 35,  slots: 8 },
  cabinet:      { name: 'Cabinet',        cat: 'storage', w: 1, d: 1, h: 76, color: '#5a4030', cost: { wood: 20, iron: 2 },     storage: 40,  slots: 8 },
  grandfather_clock: { name: 'Grandfather Clock', cat: 'decor', w: 1, d: 1, h: 96, color: '#5a3a1e', cost: { wood: 30, gold: 10 } },
  mirror:       { name: 'Standing Mirror',cat: 'decor',   w: 1, d: 1, h: 72, color: '#b0c8d8', cost: { wood: 10, iron: 5 } },
  banner_stand: { name: 'Banner Stand',   cat: 'decor',   w: 1, d: 1, h: 84, color: '#c03a3a', cost: { wood: 10, food: 10 } },
  rug:          { name: 'Rug',            cat: 'decor',   w: 2, d: 2, h: 2,  color: '#b0443c', cost: { food: 10 }, flat: true },
  round_rug:    { name: 'Round Rug',      cat: 'decor',   w: 2, d: 2, h: 2,  color: '#3c6ab0', cost: { food: 10 }, flat: true },
  // kitchen and bath
  stove:        { name: 'Stove',          cat: 'kitchen', w: 1, d: 1, h: 62, color: '#555a60', cost: { stone: 15, iron: 5 } },
  counter:      { name: 'Kitchen Counter',cat: 'kitchen', w: 2, d: 1, h: 58, color: '#c8b89a', cost: { wood: 15, stone: 5 } },
  sink:         { name: 'Wash Basin',     cat: 'kitchen', w: 1, d: 1, h: 52, color: '#9ab0c8', cost: { stone: 10 } },
  bathtub:      { name: 'Bathtub',        cat: 'kitchen', w: 2, d: 1, h: 58, color: '#e8eef4', cost: { stone: 20, iron: 5 } },
  cauldron:     { name: 'Cauldron',       cat: 'kitchen', w: 1, d: 1, h: 46, color: '#34343c', cost: { iron: 8 } },
  // decor
  fireplace:    { name: 'Fireplace',      cat: 'decor',   w: 2, d: 1, h: 72, color: '#7a6a60', cost: { stone: 30 }, glow: true },
  lamp:         { name: 'Floor Lamp',     cat: 'decor',   w: 1, d: 1, h: 70, color: '#d8b060', cost: { iron: 3 }, glow: true },
  candles:      { name: 'Candle Stand',   cat: 'decor',   w: 1, d: 1, h: 48, color: '#e8d8a0', cost: { wood: 3 }, glow: true },
  plant:        { name: 'Potted Plant',   cat: 'decor',   w: 1, d: 1, h: 48, color: '#4f9a4a', cost: { food: 5 } },
  flowers:      { name: 'Flower Vase',    cat: 'decor',   w: 1, d: 1, h: 34, color: '#e06a9a', cost: { food: 5 } },
  statue:       { name: 'Statue',         cat: 'decor',   w: 1, d: 1, h: 82, color: '#b8b8c0', cost: { stone: 40 } },
  armor_stand:  { name: 'Armour Stand',   cat: 'decor',   w: 1, d: 1, h: 82, color: '#8890a0', cost: { iron: 15 } },
  trophy:       { name: 'Trophy Head',    cat: 'decor',   w: 1, d: 1, h: 56, color: '#8a6a4a', cost: { food: 20 } },
  painting:     { name: 'Painting Easel', cat: 'decor',   w: 1, d: 1, h: 60, color: '#d8a040', cost: { wood: 10, gold: 5 } },
  piano:        { name: 'Piano',          cat: 'decor',   w: 2, d: 2, h: 70, color: '#26222a', cost: { wood: 40, gold: 20 }, era: 2 },
  globe:        { name: 'Globe',          cat: 'decor',   w: 1, d: 1, h: 46, color: '#4a8ac0', cost: { wood: 10, gold: 10 } },
  throne:       { name: 'Throne',         cat: 'decor',   w: 1, d: 1, h: 74, color: '#d8a830', cost: { gold: 60, gems: 5 } },
  // building blocks: walls and pillars to split a floor into rooms
  block_wood:   { name: 'Wooden Wall',    cat: 'blocks',  w: 1, d: 1, h: 72, color: '#9c6a3c', cost: { wood: 6 }, block: 'planks' },
  block_stone:  { name: 'Stone Wall',     cat: 'blocks',  w: 1, d: 1, h: 72, color: '#8a8a94', cost: { stone: 6 }, block: 'stones' },
  block_brick:  { name: 'Brick Wall',     cat: 'blocks',  w: 1, d: 1, h: 72, color: '#a8563c', cost: { stone: 8 }, block: 'bricks' },
  block_plaster:{ name: 'Plaster Wall',   cat: 'blocks',  w: 1, d: 1, h: 72, color: '#e0d4b8', cost: { stone: 4, wood: 2 }, block: 'plain' },
  half_wall:    { name: 'Half Wall',      cat: 'blocks',  w: 1, d: 1, h: 30, color: '#c8b08a', cost: { wood: 4 }, block: 'planks' },
  pillar:       { name: 'Pillar',         cat: 'blocks',  w: 1, d: 1, h: 80, color: '#d8d0c0', cost: { stone: 10 }, block: 'pillar' },
  glass_wall:   { name: 'Glass Wall',     cat: 'blocks',  w: 1, d: 1, h: 72, color: '#9fd4ff', cost: { stone: 4, iron: 2 }, block: 'glass' },
  archway:      { name: 'Archway',        cat: 'blocks',  w: 1, d: 1, h: 72, color: '#b8a888', cost: { stone: 12 }, block: 'arch' },
  railing:      { name: 'Railing',        cat: 'blocks',  w: 1, d: 1, h: 18, color: '#8a5a32', cost: { wood: 3 }, block: 'rail' },
  // getting around
  stairs:       { name: 'Stairs',         cat: 'stairs',  w: 1, d: 2, h: 90, color: '#8a6a4a', cost: { wood: 30 } },
};
export const LANDING = { name: 'Stairs down', w: 1, d: 1, h: 4, color: '#5a4430', flat: true };

// every piece takes exactly one floor tile
for (const f of Object.values(FURNITURE)) { f.w = 1; f.d = 1; }
export const FURNITURE_CATS = [['storage', 'Storage'], ['living', 'Living'], ['kitchen', 'Kitchen & Bath'], ['decor', 'Decor'], ['blocks', 'Walls & Blocks'], ['floors', 'Floors'], ['walls', 'Wallpaper'], ['stairs', 'Stairs']];

/** Floor tiles you paint tile by tile (art: interior/floor_<key>). */
export const FLOORINGS = {
  planks:      { name: 'Oak Planks',      a: '#9a6e48', b: '#8e6440', cost: {} },
  dark_planks: { name: 'Dark Planks',     a: '#6a4a30', b: '#5e4028', cost: { wood: 2 } },
  stone:       { name: 'Stone Slabs',     a: '#8e8e96', b: '#84848c', cost: { stone: 2 } },
  cobble:      { name: 'Cobblestone',     a: '#7a7670', b: '#6c6862', cost: { stone: 1 } },
  marble:      { name: 'Marble',          a: '#e8e4dc', b: '#d8d2c8', cost: { stone: 3, gold: 1 } },
  checker:     { name: 'Checkered Tiles', a: '#f0ece4', b: '#303038', cost: { stone: 2 } },
  white_tiles: { name: 'Bathroom Tiles',  a: '#dfe8ee', b: '#c8d6e0', cost: { stone: 2 } },
  carpet_red:  { name: 'Red Carpet',      a: '#a83a3a', b: '#9c3434', cost: { food: 2 } },
  carpet_blue: { name: 'Blue Carpet',     a: '#3a5aa8', b: '#34529c', cost: { food: 2 } },
};

/** Wallpapers for a whole floor's back walls (art: interior/wall_<key>). */
export const WALLPAPERS = {
  plaster:  { name: 'Plaster',        color: null,      pattern: 'plain', cost: {} },
  wood:     { name: 'Wood Panels',    color: '#8a5a32', pattern: 'planks', cost: { wood: 20 } },
  log:      { name: 'Log Cabin',      color: '#7a4e2a', pattern: 'logs',   cost: { wood: 30 } },
  stone:    { name: 'Stone',          color: '#8a8a94', pattern: 'stones', cost: { stone: 20 } },
  brick:    { name: 'Brick',          color: '#a8563c', pattern: 'bricks', cost: { stone: 25 } },
  red:      { name: 'Red Wallpaper',  color: '#9c3a44', pattern: 'stripes', cost: { gold: 5 } },
  green:    { name: 'Green Wallpaper',color: '#4a7a4a', pattern: 'stripes', cost: { gold: 5 } },
  blue:     { name: 'Blue Wallpaper', color: '#3e5a8e', pattern: 'stripes', cost: { gold: 5 } },
  royal:    { name: 'Royal Damask',   color: '#5a3a7a', pattern: 'damask', cost: { gold: 20 } },
};

/** Paint one floor tile. Costs the flooring's price (nothing if it already is that). */
export function setFloorTile(g, b, floor, x, y, key) {
  const def = FLOORINGS[key];
  const { w, d } = houseShape(b);
  if (!def || x < 0 || y < 0 || x >= w || y >= d) return { ok: false, why: 'Not here' };
  const f = interiorOf(b).floors[floor];
  f.tiles ||= {};
  const id = `${x},${y}`;
  if ((f.tiles[id] || 'planks') === key) return { ok: true, same: true };
  if (!Object.entries(def.cost).every(([k, n]) => (g.state.resources[k] || 0) >= n)) return { ok: false, why: 'Not enough resources' };
  for (const [k, n] of Object.entries(def.cost)) g.state.resources[k] -= n;
  if (key === 'planks') delete f.tiles[id]; else f.tiles[id] = key;
  return { ok: true };
}

export const floorTileAt = (b, floor, x, y) => interiorOf(b).floors[floor]?.tiles?.[`${x},${y}`] || 'planks';

/** Change the wallpaper of a whole floor. */
export function setWallpaper(g, b, floor, key) {
  const def = WALLPAPERS[key];
  if (!def) return { ok: false, why: 'Unknown wallpaper' };
  const f = interiorOf(b).floors[floor];
  if ((f.wall || 'plaster') === key) return { ok: true, same: true };
  if (!Object.entries(def.cost).every(([k, n]) => (g.state.resources[k] || 0) >= n)) return { ok: false, why: 'Not enough resources' };
  for (const [k, n] of Object.entries(def.cost)) g.state.resources[k] -= n;
  f.wall = key;
  g.emit('change');
  return { ok: true };
}

export const isHome = b => !!BUILDINGS[b?.type]?.housing && !!b.built;

/** Room size and number of floors grow with the building. */
export function houseShape(b) {
  const s = sizeOf(b);
  return { w: [0, 6, 8, 10, 12][Math.min(4, s)] || 12, d: [0, 6, 8, 10, 12][Math.min(4, s)] || 12, floors: s >= 3 ? 3 : s >= 2 ? 2 : 1 };
}

export function interiorOf(b) {
  const shape = houseShape(b);
  const it = (b.interior ||= { floors: [] });
  while (it.floors.length < shape.floors) it.floors.push({ items: [] });
  return it;
}

const footprint = (it, def = FURNITURE[it.type] || LANDING) => (it.rot ? { w: def.d, d: def.w } : { w: def.w, d: def.d });

/** The piece covering a floor tile, if any. */
export function itemAt(b, floor, x, y) {
  for (const it of interiorOf(b).floors[floor]?.items || []) {
    const f = footprint(it);
    if (x >= it.x && y >= it.y && x < it.x + f.w && y < it.y + f.d) return it;
  }
  return null;
}

/** Who built this house (houses from before this was recorded belong to the world's owner). */
export const builderOf = (g, b) => b.builtBy || g.state.owner?.name || 'Unknown';

/** Can this piece go here? Returns { ok } or { ok: false, why }. */
export function canPlace(g, b, floor, type, x, y, rot = 0, ignore = null) {
  const def = FURNITURE[type];
  if (!def) return { ok: false, why: 'Unknown furniture' };
  const shape = houseShape(b);
  const f = rot ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
  if (x < 0 || y < 0 || x + f.w > shape.w || y + f.d > shape.d) return { ok: false, why: 'Does not fit here' };
  if (def.era && (g.state.era || 0) < def.era) return { ok: false, why: 'Not in this era yet' };
  const floors = interiorOf(b).floors;
  const blocked = (fl) => {
    for (let yy = y; yy < y + f.d; yy++) for (let xx = x; xx < x + f.w; xx++) {
      const o = itemAt(b, fl, xx, yy);
      if (!o || o === ignore || (ignore && o.stairOf === ignore.id)) continue;
      // rugs lie under things, and things stand on rugs
      if (fl === floor && (def.flat || (FURNITURE[o.type]?.flat))) continue;
      return true;
    }
    return false;
  };
  if (blocked(floor)) return { ok: false, why: 'Something is in the way' };
  if (type === 'stairs') {
    if (floor + 1 >= floors.length) return { ok: false, why: 'This is the top floor' };
    if (blocked(floor + 1)) return { ok: false, why: 'Clear the space above first' };
  }
  return { ok: true };
}

const canAfford = (g, cost) => Object.entries(cost || {}).every(([k, n]) => (g.state.resources[k] || 0) >= n);
const newId = () => `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function placeFurniture(g, b, floor, type, x, y, rot = 0) {
  const def = FURNITURE[type];
  const check = canPlace(g, b, floor, type, x, y, rot);
  if (!check.ok) return check;
  if (!canAfford(g, def.cost)) return { ok: false, why: 'Not enough resources' };
  for (const [k, n] of Object.entries(def.cost || {})) g.state.resources[k] -= n;
  const it = { id: newId(), type, x, y, rot: rot ? 1 : 0 };
  if (def.slots) it.store = { items: {}, gear: [] };
  const floors = interiorOf(b).floors;
  floors[floor].items.push(it);
  if (type === 'stairs') floors[floor + 1].items.push({ id: newId(), type: 'landing', x, y, rot: it.rot, stairOf: it.id });
  if (def.storage) g.recalc();
  g.emit('change');
  return { ok: true, item: it };
}

/** Pick it up again: full refund, and whatever was stored in it goes back to you. */
export function removeFurniture(g, b, floor, it, hero = null) {
  if (it.type === 'landing') return { ok: false, why: 'Remove the stairs from the floor below' };
  const def = FURNITURE[it.type];
  const floors = interiorOf(b).floors;
  if (it.type === 'stairs' && floors[floor + 1]?.items.some(o => o.type !== 'landing' && o.type === 'stairs')) {
    // stairs further up are fine; they simply stay
  }
  floors[floor].items = floors[floor].items.filter(o => o !== it);
  if (it.type === 'stairs' && floors[floor + 1]) floors[floor + 1].items = floors[floor + 1].items.filter(o => o.stairOf !== it.id);
  for (const [k, n] of Object.entries(def?.cost || {})) g.state.resources[k] = (g.state.resources[k] || 0) + n;
  if (it.store) emptyInto(g, it, hero);
  if (def?.storage) g.recalc();
  g.emit('change');
  return { ok: true };
}

/** Move or turn a piece that is already placed. */
export function moveFurniture(g, b, floor, it, x, y, rot = it.rot) {
  if (it.type === 'landing') return { ok: false, why: 'Move the stairs from the floor below' };
  const check = canPlace(g, b, floor, it.type, x, y, rot, it);
  if (!check.ok) return check;
  Object.assign(it, { x, y, rot: rot ? 1 : 0 });
  if (it.type === 'stairs') {
    const landing = interiorOf(b).floors[floor + 1]?.items.find(o => o.stairOf === it.id);
    if (landing) Object.assign(landing, { x, y, rot: it.rot });
  }
  g.emit('change');
  return { ok: true };
}

/** Storage from every chest, shelf and vault in every home. */
export function interiorStorage(state) {
  let n = 0;
  for (const b of state.buildings || []) {
    if (!b.interior || !b.built) continue;
    for (const f of b.interior.floors) for (const it of f.items) n += FURNITURE[it.type]?.storage || 0;
  }
  return n;
}

// ------------------------------------------------------------------ what storage holds

const slotsUsed = it => Object.keys(it.store.items).length + it.store.gear.length;
export const slotsLeft = it => (FURNITURE[it.type]?.slots || 0) - slotsUsed(it);

/** Put an item from your pack into storage (count of them). */
export function storeItem(g, it, hero, key, count = 1) {
  const pack = hero?.inv?.pack;
  if (!pack || !it.store) return { ok: false, why: 'Nothing to store' };
  const have = pack[key] || 0;
  const n = Math.min(have, count);
  if (n <= 0) return { ok: false, why: 'You do not have that' };
  if (!it.store.items[key] && slotsLeft(it) <= 0) return { ok: false, why: 'It is full' };
  pack[key] = have - n;
  if (!pack[key]) delete pack[key];
  it.store.items[key] = (it.store.items[key] || 0) + n;
  g.emit('change');
  return { ok: true };
}

export function takeItem(g, it, hero, key, count = 1) {
  const n = Math.min(it.store?.items[key] || 0, count);
  if (!n || !hero) return { ok: false, why: 'Nothing to take' };
  it.store.items[key] -= n;
  if (!it.store.items[key]) delete it.store.items[key];
  hero.inv ||= { pack: {}, coins: 0 };
  hero.inv.pack ||= {};
  hero.inv.pack[key] = (hero.inv.pack[key] || 0) + n;
  g.emit('change');
  return { ok: true };
}

/** Gear from your bag into storage, and back. */
export function storeGear(g, it, gearId) {
  const r = rpgOf(g);
  const gear = r.bag.find(x => x.id === gearId);
  if (!gear || !it.store) return { ok: false, why: 'Not in your bag' };
  if (slotsLeft(it) <= 0) return { ok: false, why: 'It is full' };
  r.bag = r.bag.filter(x => x !== gear);
  it.store.gear.push(gear);
  g.emit('change');
  return { ok: true };
}

export function takeGear(g, it, gearId) {
  const gear = it.store?.gear.find(x => x.id === gearId);
  if (!gear) return { ok: false, why: 'Not in here' };
  it.store.gear = it.store.gear.filter(x => x !== gear);
  rpgOf(g).bag.push(gear);
  g.emit('change');
  return { ok: true };
}

function emptyInto(g, it, hero) {
  for (const [k, n] of Object.entries(it.store.items)) {
    if (hero) takeItem(g, it, hero, k, n);
  }
  for (const gear of [...it.store.gear]) takeGear(g, it, gear.id);
}

export const itemLabel = key => ITEMS[key]?.label || key;

// ------------------------------------------------------------------ the door

/** The spot just in front of a home's door (bottom middle of the building). */
export function doorOf(g, b) {
  const s = sizeOf(b);
  return { x: (b.tx + s / 2) * TILE, y: (b.ty + s) * TILE + TILE * 0.35 };
}

/** A home whose door you are standing at, if any. */
export function homeDoorNear(g, x, y, reach = TILE * 0.8) {
  for (const b of g.state.buildings) {
    if (!isHome(b)) continue;
    const d = doorOf(g, b);
    if (Math.abs(d.x - x) < reach && Math.abs(d.y - y) < reach) return b;
  }
  return null;
}
