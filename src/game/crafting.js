import { TILE } from '../core/constants.js';
import { CATALOG, RARITY, BLADE_SPECIALS, makeGear, takeGear, rpgOf, slotOf } from './rpg.js';
import { TOOLS, TOOL_KINDS, giveTool } from './tools.js';
import { CONSUMABLES, giveItem } from './consumables.js';

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
  ice: { gems: 30, stone: 60, iron: 20 },
  lava: { coal: 80, gems: 20, iron: 30 },
  celestial: { gold: 60, gems: 40, iron: 30 },
  void: { gems: 60, coal: 60, gold: 40 },
  bone: { food: 30, stone: 10 },
  carbon: { coal: 30, iron: 10 },
  coral: { gems: 12, food: 20 },
  dragon: { gold: 60, gems: 30 },
  star: { gems: 40, gold: 40 },
};
const KIND_SCALE = { pickaxe: 1, axe: 1, shovel: 0.8, hoe: 0.7, hammer: 0.8, fishing_rod: 0.7, sickle: 0.7 };
const UTILITY_COST = {
  lantern: { iron: 8, coal: 6 }, torch: { wood: 4, coal: 2 }, bucket: { wood: 12 }, watering_can: { iron: 10 }, backpack: { food: 30, wood: 10 },
  fishing_net: { wood: 10, food: 20 }, tackle_box: { iron: 10, wood: 8 }, bait_worm: { food: 10 }, grappling_hook: { iron: 25, wood: 10 },
  compass: { iron: 8, gold: 10 }, spyglass: { gold: 15, gems: 3 }, magnet: { iron: 30 }, lockpick: { iron: 12, gold: 5 },
  drill: { iron: 60, coal: 40, gems: 10 }, chainsaw: { iron: 50, coal: 50 },
};

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
  const cost = t.utility || UTILITY_COST[key] ? UTILITY_COST[key] : round(Object.fromEntries(Object.entries(MATERIAL_COST[t.mat] || { wood: 10 }).map(([k, n]) => [k, n * (KIND_SCALE[t.kind] || 1)])));
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
// the Armory: every normal weapon can be forged (admin weapons never)
for (const [base, def] of Object.entries(CATALOG.weapon)) {
  if (!def.icon?.startsWith('armory/') || def.admin || RECIPES.some(r => r.id === `gear:${base}`)) continue;
  const tier = def.minRarity || 0, magic = def.shot && def.shot.kind !== 'bullet' && def.shot.kind !== 'rock' && def.shot.kind !== 'thrown';
  const cost = { iron: Math.round(def.dmg * (def.shot?.count || 1) * 0.7), wood: 6 };
  if (def.shot?.kind === 'bullet') cost.coal = Math.round(def.dmg * 0.4);
  if (magic) { cost.gems = 4 + tier * 6; delete cost.iron; cost.gold = Math.round(def.dmg * 0.6); }
  if (tier >= 1) cost.gold = (cost.gold || 0) + 8 * tier;
  if (tier >= 2) cost.gems = (cost.gems || 0) + 8;
  const sp = BLADE_SPECIALS[base];
  RECIPES.push({ id: `gear:${base}`, cat: 'weapons', name: `${tier ? RARITY[tier].name + ' ' : ''}${def.name}`, icon: def.icon, cost, makes: { gear: base, rarity: tier }, rarity: tier,
    desc: sp ? `${sp.name}: ${sp.desc}` : `${def.dmg}${def.shot?.count > 1 ? ` x${def.shot.count}` : ''} damage${def.ranged ? `, range ${def.range}` : ''}` });
}
// consumables
const ITEM_COST = { mana_potion: { food: 20, gems: 1 }, speed_potion: { food: 25, gold: 5 }, strength_potion: { food: 25, iron: 5 }, invisibility_potion: { food: 30, gems: 3 }, antidote: { food: 15 },
  bomb: { coal: 10, iron: 4 }, dynamite: { coal: 25, iron: 6 }, med_kit: { food: 40 }, golden_apple: { food: 30, gold: 20 }, ammo_box: { iron: 15, coal: 15 } };
for (const [key, c] of Object.entries(CONSUMABLES)) RECIPES.push({ id: `item:${key}`, cat: 'potions', name: c.name, icon: c.icon, cost: ITEM_COST[key], makes: { item: key }, desc: c.does });

RECIPES.push({ id: 'potion:health', cat: 'potions', name: 'Health Potion', icon: 'gear/health_potion', cost: { food: 25 }, makes: { potion: 1 }, desc: 'Heals 45% of your health (E to drink)' });
RECIPES.push({ id: 'potion:health5', cat: 'potions', name: '5 Health Potions', icon: 'gear/health_potion', cost: { food: 110 }, makes: { potion: 5 }, desc: 'A batch of five, a little cheaper' });

export const CRAFT_CATS = [['tools', 'Tools'], ['weapons', 'Weapons'], ['armour', 'Armour & Shields'], ['potions', 'Potions & Items']];

export const canAfford = (g, recipe) => Object.entries(recipe.cost).every(([k, n]) => (g.state.resources[k] || 0) >= n);

/** Like Minecraft: a few basics by hand, everything else at a Crafting Table. */
const HAND = new Set(['tool:pickaxe_wood', 'tool:axe_wood', 'tool:shovel_wood', 'tool:hoe_wood', 'tool:sickle_wood', 'tool:hammer_wood', 'tool:fishing_rod_wood', 'tool:torch', 'potion:health']);
export const needsTable = recipe => !HAND.has(recipe.id);

/** Is a Crafting Table in reach: one built outside within a few steps, or one in the house you are in? */
export function atTable(g, hero = null) {
  if (g.craftTableHere) return true;   // set while you are inside a house that has one
  const v = hero || g.state.villagers?.find(x => x.id === g.hero?.id);
  if (!v) return false;
  return (g.state.buildings || []).some(b => b.type === 'crafting_table' && b.built !== false && Math.hypot((b.tx + 0.5) * TILE - v.x, (b.ty + 0.5) * TILE - v.y) < TILE * 3.5);
}

/** How many of this tool you already carry (tools stack). */
export const ownsTool = () => false;

export const canCraft = (g, recipe, hero = null) => canAfford(g, recipe) && (!needsTable(recipe) || atTable(g, hero)) && !ownsTool(g, recipe);

/** Make it: pay the cost and hand it over. */
export function craft(g, id, hero = null) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe) return { ok: false, why: 'Unknown recipe' };
  if (needsTable(recipe) && !atTable(g, hero)) return { ok: false, why: 'You need to be at a Crafting Table' };
  if (!canAfford(g, recipe)) return { ok: false, why: 'Not enough resources' };
  for (const [k, n] of Object.entries(recipe.cost)) g.state.resources[k] -= n;
  const m = recipe.makes;
  let made = recipe.name;
  if (m.tool) giveTool(g, m.tool);
  else if (m.gear) { const it = makeGear(g, m.gear, m.rarity); takeGear(g, it, hero); made = it.name; }
  else if (m.potion) rpgOf(g).potions = (rpgOf(g).potions || 0) + m.potion;
  else if (m.item) giveItem(g, m.item);
  const r = rpgOf(g);
  r.crafted = (r.crafted || 0) + 1;
  if (hero) g.float(hero.x, hero.y - TILE * 1.5, `Crafted ${made}`, '#9fe0ff');
  g.emit('change');
  return { ok: true, made };
}
