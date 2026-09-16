import { TILE } from '../core/constants.js';
import { CATALOG, RARITY, BLADE_SPECIALS, makeGear, takeGear, rpgOf, slotOf } from './rpg.js';
import { TOOLS, TOOL_KINDS, giveTool } from './tools.js';

/*
 * Crafting: turn wood, stone, coal, iron, gold, gems and food into tools, weapons, armour and potions.
 * Better materials cost rarer resources; a few legendary blades carry their special abilities.
 * Crafting is instant and can be done anywhere (the Craft menu, key C).
 */

/** What one tool of each material costs (fishing rods and small tools cost less). */
const MATERIAL_COST = {
  wood: { wood: 10 },
  stone: { wood: 6, stone: 12 },
  copper: { wood: 6, stone: 10, coal: 6 },
  bronze: { wood: 6, coal: 10, iron: 6 },
  iron: { wood: 8, iron: 14 },
  steel: { iron: 20, coal: 14 },
  gold: { iron: 10, gold: 25 },
  diamond: { iron: 14, gems: 10 },
  obsidian: { stone: 60, coal: 30, gems: 14 },
  mythril: { gold: 50, iron: 30, gems: 24 },
  bamboo: { wood: 14, food: 4 },
  crystal: { gems: 20, gold: 20 },
};
const KIND_SCALE = { pickaxe: 1, axe: 1, shovel: 0.8, hoe: 0.7, hammer: 0.8, fishing_rod: 0.7, sickle: 0.7 };
const UTILITY_COST = { lantern: { iron: 8, coal: 6 }, torch: { wood: 4, coal: 2 }, bucket: { wood: 12 }, watering_can: { iron: 10 }, backpack: { food: 30, wood: 10 } };

/** Gear you can craft: [base, rarity, cost]. */
const GEAR_RECIPES = [
  // weapons
  ['sword', 0, { wood: 6, iron: 10 }], ['short_sword', 0, { wood: 4, iron: 6 }], ['dagger', 0, { iron: 5 }], ['hand_axe', 0, { wood: 8, iron: 6 }],
  ['mace', 0, { iron: 14 }], ['spear', 0, { wood: 12, iron: 4 }], ['bow', 0, { wood: 20 }], ['broadsword', 1, { wood: 6, iron: 22 }],
  ['katana', 1, { iron: 24, coal: 10 }], ['rapier', 1, { iron: 18, gold: 6 }], ['twin_daggers', 1, { iron: 14, gold: 4 }], ['scimitar', 1, { iron: 20, gold: 8 }],
  ['cutlass', 1, { iron: 16, gold: 10 }], ['crossbow', 1, { wood: 20, iron: 16 }], ['greatsword', 2, { iron: 36, coal: 16 }], ['scythe', 2, { iron: 30, wood: 20 }],
  ['flame_sword', 2, { iron: 40, coal: 40, gems: 10 }], ['frost_sword', 2, { iron: 40, gems: 16 }], ['thunder_sword', 2, { iron: 40, gold: 30, gems: 12 }],
  ['shadow_blade', 2, { iron: 30, coal: 30, gems: 18 }], ['holy_sword', 3, { gold: 80, gems: 40, iron: 40 }],
  // shields
  ['buckler', 0, { wood: 10, iron: 4 }], ['round', 0, { wood: 16 }], ['kite', 1, { iron: 20 }], ['tower', 1, { iron: 40, stone: 20 }],
  // armour and helmets
  ['padded', 0, { food: 20 }], ['leather', 0, { food: 30 }], ['chain', 1, { iron: 30 }], ['plate', 2, { iron: 60, coal: 20 }],
  ['leather_cap', 0, { food: 15 }], ['iron_helmet', 0, { iron: 16 }], ['knight_helmet', 1, { iron: 30, gold: 10 }],
  // trinkets
  ['boots', 0, { food: 20, wood: 5 }], ['ring', 1, { gold: 20 }], ['amulet', 1, { gold: 30, gems: 5 }],
];

const round = cost => Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, Math.max(1, Math.round(n))]));

/** Every recipe: { id, cat, name, icon, fallbackIcon, cost, makes, desc }. */
export const RECIPES = [];
for (const [key, t] of Object.entries(TOOLS)) {
  const cost = t.utility ? UTILITY_COST[key] : round(Object.fromEntries(Object.entries(MATERIAL_COST[t.mat] || { wood: 10 }).map(([k, n]) => [k, n * (KIND_SCALE[t.kind] || 1)])));
  if (!cost) continue;
  RECIPES.push({ id: `tool:${key}`, cat: 'tools', name: t.name, icon: t.icon, fallbackIcon: t.fallbackIcon, cost, makes: { tool: key }, desc: t.does, power: t.power });
}
for (const [base, rarity, cost] of GEAR_RECIPES) {
  const slot = slotOf(base);
  if (!slot) continue;
  const def = CATALOG[slot][base];
  const sp = BLADE_SPECIALS[base];
  const r = Math.max(rarity, def.minRarity || 0);
  RECIPES.push({
    id: `gear:${base}`, cat: slot === 'weapon' ? 'weapons' : 'armour', name: `${r ? RARITY[r].name + ' ' : ''}${def.name}`, icon: def.icon, fallbackIcon: def.fallbackIcon, cost,
    makes: { gear: base, rarity: r }, rarity: r,
    desc: sp ? `${sp.name}: ${sp.desc}` : def.dmg ? `${def.dmg} damage${def.ranged ? `, ranged ${def.range} tiles` : ''}` : def.block ? `Blocks ${Math.round(def.block * 100)}%` : def.armor ? `${Math.round(def.armor * 100)}% armour` : Object.keys(def.bonus || {}).map(k => `+${k}`).join(', '),
  });
}
RECIPES.push({ id: 'potion:health', cat: 'potions', name: 'Health Potion', icon: 'gear/health_potion', cost: { food: 25 }, makes: { potion: 1 }, desc: 'Heals 45% of your health (E to drink)' });
RECIPES.push({ id: 'potion:health5', cat: 'potions', name: '5 Health Potions', icon: 'gear/health_potion', cost: { food: 110 }, makes: { potion: 5 }, desc: 'A batch of five, a little cheaper' });

export const CRAFT_CATS = [['tools', 'Tools'], ['weapons', 'Weapons'], ['armour', 'Armour & Shields'], ['potions', 'Potions']];

export const canCraft = (g, recipe) => Object.entries(recipe.cost).every(([k, n]) => (g.state.resources[k] || 0) >= n);

/** Make it: pay the cost and hand it over. */
export function craft(g, id, hero = null) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe) return { ok: false, why: 'Unknown recipe' };
  if (!canCraft(g, recipe)) return { ok: false, why: 'Not enough resources' };
  for (const [k, n] of Object.entries(recipe.cost)) g.state.resources[k] -= n;
  const m = recipe.makes;
  let made = recipe.name;
  if (m.tool) giveTool(g, m.tool);
  else if (m.gear) { const it = makeGear(g, m.gear, m.rarity); takeGear(g, it, hero); made = it.name; }
  else if (m.potion) rpgOf(g).potions = (rpgOf(g).potions || 0) + m.potion;
  const r = rpgOf(g);
  r.crafted = (r.crafted || 0) + 1;
  if (hero) g.float(hero.x, hero.y - TILE * 1.5, `Crafted ${made}`, '#9fe0ff');
  g.emit('change');
  return { ok: true, made };
}
