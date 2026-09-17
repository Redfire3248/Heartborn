import { TILE } from '../core/constants.js';
import { rpgOf, discover } from './rpg.js';
import { TILES } from './world.js';
import { gameTheme } from './worldTypes.js';

const TILE_NAMES = TILES.map(k => k.replace('tile_', ''));

/*
 * Your tools. They sit in your hotbar (keys 1-9): the one you hold is what your swing uses.
 * Tools you do not hold still count for passive bonuses (hammer, lantern, bucket, backpack).
 * - Axes chop trees, Pickaxes mine rocks and ore, Sickles gather berries and crops: better tools take fewer
 *   swings and give more.
 * - Shovels dig the bare ground for stone, clay and now and then buried treasure.
 * - Fishing Rods catch fish when you swing at the water. Hammers build faster.
 * - Lantern and Torch light up dungeons; Bucket, Watering Can and Backpack help your gathering.
 */

const MATERIALS = {
  wood:     { name: 'Wooden',   power: 1 },
  stone:    { name: 'Stone',    power: 2 },
  copper:   { name: 'Copper',   power: 3 },
  bronze:   { name: 'Bronze',   power: 4 },
  iron:     { name: 'Iron',     power: 5 },
  steel:    { name: 'Steel',    power: 6 },
  gold:     { name: 'Golden',   power: 7 },
  diamond:  { name: 'Diamond',  power: 8 },
  obsidian: { name: 'Obsidian', power: 9 },
  mythril:  { name: 'Mythril',  power: 10 },
  bamboo:   { name: 'Bamboo',   power: 2 },
  crystal:  { name: 'Crystal',  power: 9 },
  // mythic and special (art from the Armory sheet)
  ice:       { name: 'Ice',       power: 10, armory: true },
  lava:      { name: 'Lava',      power: 11, armory: true },
  celestial: { name: 'Celestial', power: 12, armory: true },
  void:      { name: 'Void',      power: 13, armory: true },
  bone:      { name: 'Bone',      power: 4,  armory: true },
  carbon:    { name: 'Carbon',    power: 6,  armory: true },
  coral:     { name: 'Coral',     power: 7,  armory: true },
  dragon:    { name: 'Dragon',    power: 11, armory: true },
  star:      { name: 'Starlight', power: 12, armory: true },
};

export const TOOL_KINDS = {
  pickaxe:      { name: 'Pickaxe',      does: 'Mines rocks and ore',                 fallback: 'items/pickaxe', mats: ['wood', 'stone', 'copper', 'bronze', 'iron', 'steel', 'gold', 'diamond', 'obsidian', 'mythril', 'ice', 'lava', 'celestial', 'void'] },
  axe:          { name: 'Axe',          does: 'Chops trees',                         fallback: 'items/axe',     mats: ['wood', 'stone', 'copper', 'bronze', 'iron', 'steel', 'gold', 'diamond', 'obsidian', 'mythril', 'lava', 'celestial'] },
  shovel:       { name: 'Shovel',       does: 'Digs the ground for stone and treasure', fallback: 'items/hoe',  mats: ['wood', 'stone', 'iron', 'gold', 'diamond', 'crystal', 'lava', 'celestial', 'void'] },
  hoe:          { name: 'Hoe',          does: 'More from crops you pick',            fallback: 'items/hoe',     mats: ['wood', 'stone', 'iron', 'gold', 'diamond', 'celestial'] },
  hammer:       { name: 'Hammer',       does: 'Builds faster',                       fallback: 'items/hammer',  mats: ['wood', 'stone', 'iron', 'gold', 'diamond', 'celestial'] },
  fishing_rod:  { name: 'Fishing Rod',  does: 'Swing at water to catch fish',        fallback: 'items/spear', mats: ['wood', 'bamboo', 'iron', 'gold', 'crystal', 'bone', 'carbon', 'coral', 'lava', 'dragon', 'star'] },
  sickle:       { name: 'Sickle',       does: 'Gathers berries and crops faster',    fallback: 'items/hoe',     mats: ['wood', 'stone', 'iron', 'gold', 'diamond', 'celestial'] },
};

/** Single utility tools (no tiers). */
export const UTILITY = {
  lantern:      { name: 'Lantern',      does: 'Lights up dungeons around you',       fallback: 'effects/flame' },
  torch:        { name: 'Torch',        does: 'A little more light in dungeons',     fallback: 'effects/flame' },
  bucket:       { name: 'Bucket',       does: 'Catch more fish',                     fallback: 'items/relic' },
  watering_can: { name: 'Watering Can', does: 'More from crops you pick',            fallback: 'items/relic' },
  backpack:     { name: 'Backpack',     does: '+25% from everything you gather',     fallback: 'items/relic' },
  fishing_net:  { name: 'Fishing Net',  does: '50% more fish from every catch',      armory: true },
  tackle_box:   { name: 'Tackle Box',   does: '20% more fish, and rare catches',      armory: true },
  bait_worm:    { name: 'Bait Worm',    does: 'Fish bite sooner (one cast fewer)',    armory: true },
  grappling_hook: { name: 'Grappling Hook', does: 'Your dash goes 60% further',      armory: true },
  compass:      { name: 'Compass',      does: 'Points to the nearest treasure chest or cave', armory: true },
  spyglass:     { name: 'Spyglass',     does: 'See further in the dark (more dungeon light)', armory: true },
  magnet:       { name: 'Magnet',       does: 'Pulls hearts, potions and dropped loot to you', armory: true },
  lockpick:     { name: 'Lockpick',     does: 'Opens a dungeon boss door without the key', armory: true },
};

/** Every tool there is, by key (e.g. pickaxe_iron, lantern). */
export const TOOLS = {};
for (const [kind, k] of Object.entries(TOOL_KINDS)) {
  for (const m of k.mats) TOOLS[`${kind}_${m}`] = { kind, mat: m, name: `${MATERIALS[m].name} ${k.name}`, power: MATERIALS[m].power, does: k.does, icon: MATERIALS[m].armory || (kind === 'shovel' && m === 'crystal') ? `armory/${kind}_${m}` : `tools/${kind}_${m}`, fallbackIcon: k.fallback, mythic: MATERIALS[m].power > 10 };
}
for (const [key, u] of Object.entries(UTILITY)) TOOLS[key] = { kind: key, name: u.name, power: 1, does: u.does, icon: u.armory ? `armory/${key}` : `tools/${key}`, fallbackIcon: u.fallback || 'items/relic', utility: true };
// power tools
TOOLS.drill = { kind: 'pickaxe', name: 'Drill', power: 12, does: 'Mines anything in a blink', icon: 'armory/drill', fallbackIcon: 'items/pickaxe', mythic: true };
TOOLS.chainsaw = { kind: 'axe', name: 'Chainsaw', power: 12, does: 'Fells any tree in a blink', icon: 'armory/chainsaw', fallbackIcon: 'items/axe', mythic: true };

export const STARTER_TOOLS = ['pickaxe_wood', 'axe_wood', 'shovel_wood', 'fishing_rod_wood'];

/** Your tools as { key: count }. Everyone starts with a wooden pickaxe, axe and shovel. */
export function toolsOf(g) {
  const r = rpgOf(g);
  if (!r.tools) { r.tools = {}; for (const k of STARTER_TOOLS) r.tools[k] = 1; }
  return r.tools;
}

export function giveTool(g, key, n = 1) {
  if (!TOOLS[key]) return false;
  discover(g, 'tool', key);
  const t = toolsOf(g);
  const isNew = !t[key];
  t[key] = (t[key] || 0) + n;
  if (isNew) addToHotbar(g, key);
  g.emit?.('change');
  return true;
}

export function dropTool(g, key, n = 1) {
  const t = toolsOf(g);
  if (!t[key]) return false;
  t[key] = Math.max(0, t[key] - n);
  if (!t[key]) { delete t[key]; const bar = hotbarOf(g); const i = bar.indexOf(key); if (i >= 0) bar[i] = null; }
  g.emit?.('change');
  return true;
}

export const hasTool = (g, key) => (toolsOf(g)[key] || 0) > 0;

/** The best tool of a kind you own (or null). */
export function bestTool(g, kind) {
  let best = null;
  for (const key of Object.keys(toolsOf(g))) {
    const t = TOOLS[key];
    if (t?.kind === kind && (!best || t.power > TOOLS[best].power)) best = key;
  }
  return best;
}

const TOOL_FOR_WORK = { chop: 'axe', mine: 'pickaxe', gather: 'sickle', cut: 'sickle' };

/** How a job goes with your tools: swings needed and how much more you get. */
export function workWith(g, work, baseHits, held = null) {
  const kind = TOOL_FOR_WORK[work];
  const key = held ? (TOOLS[held]?.kind === kind || (work === 'gather' && TOOLS[held]?.kind === 'hoe') ? held : null) : bestTool(g, kind);
  const power = key ? TOOLS[key].power : 0;
  const byHand = work === 'gather' || work === 'cut';   // plants come away by hand too, a sickle is just faster
  let hits = key ? Math.max(1, baseHits + 1 - Math.floor((power + 1) / 3)) : baseHits + (byHand ? 1 : 2);
  let yieldMult = key ? 1 + power * 0.12 : byHand ? 1 : 0.6;
  if (work === 'gather') {
    const hoe = bestTool(g, 'hoe');
    if (hoe) yieldMult += TOOLS[hoe].power * 0.06;
    if (hasTool(g, 'watering_can')) yieldMult += 0.2;
    hits = Math.max(1, hits);
  }
  if (hasTool(g, 'backpack')) yieldMult += 0.25;
  return { key, hits, yieldMult };
}

/** The weakest pickaxe that can mine an ore of this tier, by name (tier = pickaxe power needed). */
export function pickaxeFor(tier) {
  const names = { 1: 'Wooden', 2: 'Stone', 3: 'Copper', 4: 'Bronze', 5: 'Iron', 6: 'Steel', 7: 'Golden', 8: 'Diamond', 9: 'Obsidian', 10: 'Mythril' };
  return `${names[tier] || 'better'} Pickaxe`;
}

/** Can this pickaxe (tool key or null) mine an ore that needs this tier? */
export const canMine = (key, tier = 0) => !tier || (!!key && TOOLS[key]?.kind === 'pickaxe' && TOOLS[key].power >= tier);

/** Hammers build faster (solo construction). */
export const buildMult = g => { const k = bestTool(g, 'hammer'); return k ? 1 + TOOLS[k].power * 0.15 : 1; };

/** Extra dungeon light (in tiles). */
export const lightBonus = g => (hasTool(g, 'lantern') ? 2.5 : hasTool(g, 'torch') ? 1.2 : 0) + (hasTool(g, 'spyglass') ? 1.5 : 0);

/** How far your own light reaches (tiles): a torch or lantern in your hand lights up a big circle. */
export function heroLight(g, inDungeon) {
  const held = heldSlot(g);
  const inHand = held === 'lantern' ? 6 : held === 'torch' ? 5 : 0;
  const carried = hasTool(g, 'lantern') ? 2.5 : hasTool(g, 'torch') ? 1.5 : 0;
  return Math.max(inHand, (inDungeon ? 5 : 1.1) + carried);
}

/** Show the tool in your hands for a moment. */
export function flashTool(g, key) {
  if (g.hero && key) g.hero.toolFlash = { key, t: 0.45 };
}

/** Dig the bare ground with your best shovel. Returns true if you dug. */
export function dig(g, v, key = bestTool(g, 'shovel')) {
  if (!key) return false;
  const tile = TILE_NAMES?.[g.world.tile(Math.floor(v.x / TILE), Math.floor(v.y / TILE))];
  if (tile && !DIGGABLE.has(tile)) return false;   // no digging through paths, cave floors or water
  const t = TOOLS[key];
  const h = g.hero;
  h._digs = (h._digs || 0) + 1;
  flashTool(g, key);
  g.puff({ x: v.x + Math.cos(h.facing || 0) * 14, y: v.y + Math.sin(h.facing || 0) * 10 }, 'effects/dust', 3, 8);
  if (h._digs < Math.max(1, 4 - Math.floor(t.power / 3))) return true;
  h._digs = 0;
  const bonus = hasTool(g, 'backpack') ? 1.25 : 1;
  const got = [];
  const add = (res, n) => { n = Math.max(1, Math.round(n * bonus)); got.push(`+${g.addResource(res, n) ?? n} ${res}`); };
  // the ground hides old coins, nuggets, gems and the odd lost tool; most holes are just dirt
  const luck = t.power;
  if (Math.random() < 0.28 + luck * 0.02) add('gold', 2 + Math.random() * (3 + luck));
  if (Math.random() < 0.12 + luck * 0.01) add('food', 1 + Math.random() * 2);   // roots and tubers
  if (Math.random() < 0.03 + luck * 0.006) add('gems', 1);
  // now and then something buried: a little iron or coal (tools are crafted, never dug up)
  if (Math.random() < 0.05 + t.power * 0.004) add(Math.random() < 0.5 ? 'iron' : 'coal', 1 + Math.random() * 3);
  g.float(v.x, v.y - TILE * 1.3, got.length ? got.join('  ') : 'Just dirt', got.length ? '#e0c090' : '#a89a88');
  return true;
}

/** Swing at water with a rod: fish. Returns true if there was water to fish in. */
export function fish(g, v, key = bestTool(g, 'fishing_rod')) {
  if (!key) return false;
  const a = g.hero?.facing || 0;
  const wx = Math.floor((v.x + Math.cos(a) * TILE * 1.2) / TILE), wy = Math.floor((v.y + Math.sin(a) * TILE * 1.2) / TILE);
  let water = g.world.isWater(wx, wy);
  if (!water) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.world.isWater(Math.floor(v.x / TILE) + dx, Math.floor(v.y / TILE) + dy)) water = true;
  if (!water) return false;
  const t = TOOLS[key];
  flashTool(g, key);
  const h = g.hero;
  h._casts = (h._casts || 0) + 1;
  g.puff({ x: (wx + 0.5) * TILE, y: (wy + 0.5) * TILE }, 'effects/splash', 3, 8);
  if (h._casts < Math.max(1, 4 - Math.floor(t.power / 3) - (hasTool(g, 'bait_worm') ? 1 : 0))) return true;
  h._casts = 0;
  const n = Math.round((2 + Math.random() * (2 + t.power)) * (hasTool(g, 'bucket') ? 1.4 : 1) * (hasTool(g, 'backpack') ? 1.25 : 1) * (hasTool(g, 'fishing_net') ? 1.5 : 1) * (hasTool(g, 'tackle_box') ? 1.2 : 1));
  if (hasTool(g, 'tackle_box') && Math.random() < 0.08) { const gems = g.addResource('gems', 1); g.float(v.x, v.y - TILE * 1.8, `A gem in its belly! +${gems ?? 1} gem`, '#b8a0ff'); }
  g.float(v.x, v.y - TILE * 1.3, `Caught fish! +${g.addResource('food', n) ?? n} food`, '#8fd4ff');
  return true;
}

/** A random tool for chests and loot (better ones deeper and later). */
export function rollTool(g, luck = 0) {
  const era = g.state.era || 0;
  const maxPower = Math.min(10, 2 + era + luck + Math.floor(Math.random() * 3));
  const pool = Object.keys(TOOLS).filter(k => TOOLS[k].power <= maxPower);
  const mats = gameTheme(g).mats;   // this world's materials turn up more
  const fav = Object.keys(TOOLS).filter(k => mats.includes(TOOLS[k].mat) && TOOLS[k].power <= maxPower + 3);
  if (fav.length && Math.random() < 0.4) return fav[Math.floor(Math.random() * fav.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

export const toolIconKey = key => TOOLS[key]?.icon;

// ------------------------------------------------------------------ the hotbar

export const HOTBAR_SIZE = 9;
/** What each work kind is done with. */
export const WORK_OF_KIND = { axe: ['chop'], pickaxe: ['mine'], sickle: ['gather', 'cut'], hoe: ['gather'] };
/** What a weapon or bare hands can work: picking and cutting plants. */
export const HAND_WORK = ['gather', 'cut'];
/** Ground you can dig in. */
const DIGGABLE = new Set(['grass', 'grass_flowers', 'dirt', 'sand', 'snow', 'swamp', 'tilled_soil']);

/**
 * Nine slots: 'weapon' (your equipped weapon), 'potion' (your health potions) or a tool key.
 * The selected slot is what you hold and what a swing does.
 */
export function hotbarOf(g) {
  const r = rpgOf(g);
  if (!Array.isArray(r.hotbar)) {
    toolsOf(g);
    r.hotbar = Array(HOTBAR_SIZE).fill(null);
    const first = ['weapon', bestTool(g, 'pickaxe'), bestTool(g, 'axe'), bestTool(g, 'shovel'), bestTool(g, 'fishing_rod'), 'potion'].filter(Boolean);
    first.forEach((k, i) => { r.hotbar[i] = k; });
    for (const k of Object.keys(r.tools)) {
      if (r.hotbar.includes(k) || (!TOOLS[k]?.utility && r.hotbar.some(o => TOOLS[o] && TOOLS[o].kind === TOOLS[k]?.kind))) continue;   // one of each kind (the best)
      const i = r.hotbar.indexOf(null);
      if (i >= 0) r.hotbar[i] = k;
    }
  }
  r.hotSel = Math.max(0, Math.min(HOTBAR_SIZE - 1, r.hotSel || 0));
  return r.hotbar;
}

export const heldSlot = g => hotbarOf(g)[rpgOf(g).hotSel] || null;

export function selectSlot(g, i) {
  hotbarOf(g);
  rpgOf(g).hotSel = Math.max(0, Math.min(HOTBAR_SIZE - 1, i));
  g.emit?.('change');
}

/** Consumables (item:key) take a free slot the first time you get them. */
export function addItemToHotbar(g, value) {
  const bar = hotbarOf(g);
  if (bar.includes(value)) return;
  const free = bar.indexOf(null);
  if (free >= 0) bar[free] = value;
}

/** A new tool goes into your hotbar: it replaces a weaker one of the same kind, or takes a free slot. */
export function addToHotbar(g, key) {
  const bar = hotbarOf(g);
  if (bar.includes(key)) return;
  const t = TOOLS[key];
  const weaker = bar.findIndex(k => TOOLS[k] && !t.utility && TOOLS[k].kind === t.kind && TOOLS[k].power < t.power);
  if (weaker >= 0) { bar[weaker] = key; return; }
  if (bar.some(k => TOOLS[k] && !t.utility && TOOLS[k].kind === t.kind)) return;   // you already carry a better one there
  const free = bar.indexOf(null);
  if (free >= 0) bar[free] = key;
}

/** Swap two hotbar slots (the selection follows the item you moved). */
export function swapSlots(g, i, j) {
  const bar = hotbarOf(g);
  if (i === j || i < 0 || j < 0 || i >= HOTBAR_SIZE || j >= HOTBAR_SIZE) return;
  [bar[i], bar[j]] = [bar[j], bar[i]];
  const r = rpgOf(g);
  if (r.hotSel === i) r.hotSel = j; else if (r.hotSel === j) r.hotSel = i;
  g.emit?.('change');
}

/** Put something into a slot (it leaves any other slot it was in). */
export function setSlot(g, i, value) {
  const bar = hotbarOf(g);
  const was = bar.indexOf(value);
  if (was >= 0 && value) bar[was] = bar[i];
  bar[i] = value;
  g.emit?.('change');
}

