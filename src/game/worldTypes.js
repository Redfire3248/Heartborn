/*
 * Every world is different, like Minecraft: its seed decides the land (terrain, trees, ores), which animals
 * roam, which monsters come out, which bosses guard its dungeons and which loot turns up most.
 * Nothing needs saving: the same seed always makes the same kind of world.
 */

export const THEMES = {
  meadow: {
    name: 'Green Meadows', desc: 'Rolling hills, forests and rivers', color: '#6fbf5a', icon: 'nature/tree_oak', weight: 3,
    wild: ['deer', 'rabbit', 'rabbit', 'boar'], night: ['wolf'], dungeon: [], bosses: ['cave_troll', 'slime_king'],
    loot: ['sword', 'longsword', 'bow', 'hand_axe', 'spear'], mats: ['iron', 'steel'],
  },
  frozen: {
    name: 'Frozen Wastes', desc: 'Snowfields, pines and ice caves', color: '#9fd4ff', icon: 'nature/tree_snowy_pine', weight: 1,
    wild: ['rabbit', 'deer', 'wolf'], night: ['wolf', 'bear', 'ghost'], dungeon: ['ghost', 'skeleton'], bosses: ['stone_golem', 'lich'],
    loot: ['frost_sword', 'ice_staff', 'estoc', 'longbow', 'great_axe'], mats: ['ice', 'diamond', 'steel'],
  },
  volcanic: {
    name: 'Volcanic Isles', desc: 'Ash, obsidian and rivers of lava', color: '#ff7a3a', icon: 'effects/flame', weight: 1,
    wild: ['boar', 'snake'], night: ['fire_imp', 'goblin'], dungeon: ['fire_imp', 'fire_imp'], bosses: ['cave_troll', 'stone_golem'],
    loot: ['flame_sword', 'fire_staff', 'maul', 'war_pick', 'double_axe'], mats: ['lava', 'obsidian'],
  },
  desert: {
    name: 'Endless Desert', desc: 'Dunes, cacti and buried treasure', color: '#e8c070', icon: 'nature/cactus', weight: 1,
    wild: ['snake', 'boar', 'rabbit'], night: ['bandit', 'skeleton', 'snake'], dungeon: ['bandit', 'skeleton_archer'], bosses: ['lich', 'spider_queen'],
    loot: ['scimitar', 'kukri', 'revolver', 'shotgun', 'boomerang'], mats: ['gold', 'bronze', 'copper'],
  },
  haunted: {
    name: 'Haunted Marsh', desc: 'Bogs, dead trees and restless dead', color: '#8a7ab0', icon: 'nature/tree_dead', weight: 1,
    wild: ['snake', 'rabbit'], night: ['ghost', 'skeleton', 'zombie'], dungeon: ['zombie', 'ghost'], bosses: ['lich', 'slime_king'],
    loot: ['shadow_blade', 'necro_staff', 'bone_wand', 'scythe', 'whip'], mats: ['bone', 'obsidian'],
  },
  jungle: {
    name: 'Wild Jungle', desc: 'Thick jungle, swamps and giant spiders', color: '#3faf5a', icon: 'nature/tree_palm', weight: 1,
    wild: ['boar', 'deer', 'snake'], night: ['giant_spider', 'goblin'], dungeon: ['cave_spider', 'giant_spider'], bosses: ['spider_queen', 'forest_spirit'],
    loot: ['machete', 'druid_staff', 'twin_daggers', 'harpoon', 'blunderbuss'], mats: ['bamboo', 'coral', 'bronze'],
  },
  crystal: {
    name: 'Crystal Highlands', desc: 'Mountains full of ore and glowing crystals', color: '#c08aff', icon: 'nature/crystal_cluster', weight: 1,
    wild: ['deer', 'rabbit'], night: ['ghost', 'dark_mage'], dungeon: ['dark_mage', 'bat'], bosses: ['forest_spirit', 'stone_golem'],
    loot: ['crystal_orb', 'spellbook', 'lightning_wand', 'thunder_sword', 'rapier'], mats: ['crystal', 'celestial', 'diamond'],
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

/** The theme of a game (a dungeon uses the world above it). */
export const gameTheme = g => THEMES[themeOf(g.state.worldSeed ?? g.state.seed)] || THEMES.meadow;
