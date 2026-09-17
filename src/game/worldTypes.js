/*
 * Every world is different, like Minecraft: its seed decides the land (terrain, trees, ores), which animals
 * roam, which monsters come out, which bosses guard its dungeons and which loot turns up most.
 * Nothing needs saving: the same seed always makes the same kind of world.
 */

import { makeNoise } from '../core/noise.js';

export const THEMES = {
  meadow: {
    name: 'Green Meadows', desc: 'Rolling hills, forests and rivers', color: '#6fbf5a', icon: 'nature/tree_oak', weight: 3,
    wild: ['deer', 'rabbit', 'rabbit', 'boar'], night: ['wolf'], dungeon: [], bosses: ['cave_troll', 'slime_king'],
    loot: ['sword', 'longsword', 'bow', 'hand_axe', 'spear'], mats: ['iron', 'steel'], ores: ['copper_ore', 'copper_ore', 'coal_ore', 'iron_ore', 'titanium_ore'],
  },
  frozen: {
    name: 'Frozen Wastes', desc: 'Snowfields, pines and ice caves', color: '#9fd4ff', icon: 'nature/tree_snowy_pine', weight: 1,
    wild: ['rabbit', 'deer', 'wolf'], night: ['wolf', 'bear', 'ghost'], dungeon: ['ghost', 'skeleton'], bosses: ['stone_golem', 'lich'],
    loot: ['frost_sword', 'ice_staff', 'estoc', 'longbow', 'great_axe'], mats: ['ice', 'diamond', 'steel'], ores: ['silver_ore', 'silver_ore', 'frostite_ore', 'iron_ore', 'cobalt_ore', 'cobalt_ore'],
  },
  volcanic: {
    name: 'Volcanic Isles', desc: 'Ash, obsidian and rivers of lava', color: '#ff7a3a', icon: 'effects/flame', weight: 1,
    wild: ['boar', 'snake'], night: ['fire_imp', 'goblin'], dungeon: ['fire_imp', 'fire_imp'], bosses: ['cave_troll', 'stone_golem'],
    loot: ['flame_sword', 'fire_staff', 'maul', 'war_pick', 'double_axe'], mats: ['lava', 'obsidian'], ores: ['obsidian_ore', 'obsidian_ore', 'magmite_ore', 'coal_ore', 'titanium_ore'],
  },
  desert: {
    name: 'Endless Desert', desc: 'Dunes, cacti and buried treasure', color: '#e8c070', icon: 'nature/cactus', weight: 1,
    wild: ['snake', 'boar', 'rabbit'], night: ['bandit', 'skeleton', 'snake'], dungeon: ['bandit', 'skeleton_archer'], bosses: ['lich', 'spider_queen'],
    loot: ['scimitar', 'kukri', 'revolver', 'shotgun', 'boomerang'], mats: ['gold', 'bronze', 'copper'], ores: ['gold_ore', 'copper_ore', 'copper_ore', 'sunstone_ore'],
  },
  haunted: {
    name: 'Haunted Marsh', desc: 'Bogs, dead trees and restless dead', color: '#8a7ab0', icon: 'nature/tree_dead', weight: 1,
    wild: ['snake', 'rabbit'], night: ['ghost', 'skeleton', 'zombie'], dungeon: ['zombie', 'ghost'], bosses: ['lich', 'slime_king'],
    loot: ['shadow_blade', 'necro_staff', 'bone_wand', 'scythe', 'whip'], mats: ['bone', 'obsidian'], ores: ['silver_ore', 'coal_ore', 'moonstone_ore', 'moonstone_ore'],
  },
  jungle: {
    name: 'Wild Jungle', desc: 'Thick jungle, swamps and giant spiders', color: '#3faf5a', icon: 'nature/tree_palm', weight: 1,
    wild: ['boar', 'deer', 'snake'], night: ['giant_spider', 'goblin'], dungeon: ['cave_spider', 'giant_spider'], bosses: ['spider_queen', 'forest_spirit'],
    loot: ['machete', 'druid_staff', 'twin_daggers', 'harpoon', 'blunderbuss'], mats: ['bamboo', 'coral', 'bronze'], ores: ['copper_ore', 'gem_ore', 'gold_ore', 'jade_ore', 'jade_ore'],
  },
  crystal: {
    name: 'Crystal Highlands', desc: 'Mountains full of ore and glowing crystals', color: '#c08aff', icon: 'nature/crystal_cluster', weight: 1,
    wild: ['deer', 'rabbit'], night: ['ghost', 'dark_mage'], dungeon: ['dark_mage', 'bat'], bosses: ['forest_spirit', 'stone_golem'],
    loot: ['crystal_orb', 'spellbook', 'lightning_wand', 'thunder_sword', 'rapier'], mats: ['crystal', 'celestial', 'diamond'], ores: ['mythril_ore', 'silver_ore', 'gem_ore', 'crystal_cluster', 'voidstone_ore'],
  },
};

/** The kind of world a seed makes (the same seed always gives the same answer). */
export function themeOf(seed) {
  const keys = Object.keys(THEMES);
  const total = keys.reduce((n, k) => n + THEMES[k].weight, 0);
  let z = (Number(seed) | 0) ^ 0x9e3779b9;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); z ^= z >>> 16;
  let x = (z >>> 0) / 4294967296 * total;
  for (const k of keys) { x -= THEMES[k].weight; if (x < 0) return k; }
  return 'meadow';
}

export const themeInfo = seed => ({ id: themeOf(seed), ...THEMES[themeOf(seed)] });

export const BIOME_KEYS = Object.keys(THEMES);
export const LEGACY_SIZE = 96;   // worlds made before biomes: one type for the whole island

/**
 * A map of biomes, like Minecraft: temperature, wetness and height vary slowly across the land, and together they
 * decide each place's biome. Every map uses its whole range (percentiles), so every world gets a good mix.
 * The land around the start is always meadow; the seed's featured biome (themeOf) is a little bigger than the rest.
 */
export function makeBiomes(seed, w, h) {
  const field = (noise, f) => {
    const a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = noise(x * f, y * f, 3);
    const sorted = Float32Array.from(a).sort();
    const out = new Float32Array(w * h);
    for (let i = 0; i < a.length; i++) {
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < a[i]) lo = mid + 1; else hi = mid; }
      out[i] = lo / sorted.length;
    }
    return out;
  };
  const T = field(makeNoise(seed + 911), 0.018), M = field(makeNoise(seed + 912), 0.022), E = field(makeNoise(seed + 913), 0.03);
  const feat = themeOf(seed), k = key => (key === feat ? 0.07 : 0);
  const out = new Uint8Array(w * h);
  const idx = Object.fromEntries(BIOME_KEYS.map((b, i) => [b, i]));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = T[i], m = M[i], e = E[i];
    let b = 'meadow';
    if (Math.hypot(x - w / 2, y - h / 2) < Math.max(12, w * 0.1)) b = 'meadow';
    else if (t < 0.2 + k('frozen')) b = 'frozen';
    else if (t > 0.72 - k('volcanic') && e > 0.7 - k('volcanic')) b = 'volcanic';
    else if (t > 0.72 - k('desert') && m < 0.45 + k('desert')) b = 'desert';
    else if (t > 0.62 - k('jungle') && m > 0.62 - k('jungle')) b = 'jungle';
    else if (m > 0.78 - k('haunted')) b = 'haunted';
    else if (e > 0.8 - k('crystal')) b = 'crystal';
    out[i] = idx[b];
  }
  return out;
}

/** The biome at a tile (null off the map). */
export const biomeAt = (world, tx, ty) => {
  const x = Math.floor(tx), y = Math.floor(ty);
  if (!world?.biomes || x < 0 || y < 0 || x >= world.w || y >= world.h) return null;
  return BIOME_KEYS[world.biomes[y * world.w + x]];
};

/** The biome a game is in right now: where your hero stands (a dungeon uses the biome you entered it from). */
export const gameTheme = g => {
  const s = g.state;
  if (s.worldBiome && THEMES[s.worldBiome]) return THEMES[s.worldBiome];
  const hero = g.hero && s.villagers?.find(v => v.id === g.hero.id);
  const here = hero && biomeAt(g.world, hero.x / 32, hero.y / 32);
  return THEMES[here || themeOf(s.worldSeed ?? s.seed)] || THEMES.meadow;
};

/** The biome key under your hero. */
export const heroBiome = g => {
  const hero = g.hero && g.state.villagers?.find(v => v.id === g.hero.id);
  return hero ? biomeAt(g.world, hero.x / 32, hero.y / 32) : null;
};
