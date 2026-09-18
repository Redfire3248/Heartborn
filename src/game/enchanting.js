/*
 * Enchanting (at an Enchanting Table): spend gems and gold to put a random enchantment on a weapon, a piece of
 * armour or a tool (like Minecraft). Every enchant wipes what the item had and rolls a fresh set of one to three
 * enchantments: the dice pick which and how strong, and a good ritual (the minigame) makes more and higher ones
 * more likely. Every try on the same item costs a little more.
 *
 * Gear keeps its enchantments on the item (it.ench = { sharpness: 2 }); tools stack by kind, so a tool's
 * enchantments are kept per tool key (rpg.toolEnch[key]).
 */
import { dailyProgress } from './journal.js';
import { TILE } from '../core/constants.js';
import { rpgOf, CATALOG, RARITY } from './rpg.js';
import { TOOLS } from './tools.js';
import { luckOf } from './loot.js';

export const MAX_ENCHANTS = 3;

/** Every enchantment. `for`: which things take it; `max`: highest level; `trait`: the forge trait it gives. */
export const ENCHANTS = {
  sharpness:   { name: 'Sharpness',   for: ['weapon'], max: 5, color: '#e8e8ff', desc: l => `+${l * 8}% damage` },
  fire_aspect: { name: 'Fire Aspect', for: ['weapon'], max: 1, color: '#ff9a3a', trait: 'burn', desc: () => 'Sets foes on fire' },
  frostbite:   { name: 'Frostbite',   for: ['weapon'], max: 1, color: '#9fd4ff', trait: 'chill', desc: () => 'Chills foes, sometimes freezing them' },
  vampirism:   { name: 'Vampirism',   for: ['weapon'], max: 1, color: '#b06aff', trait: 'drain', desc: () => 'Heals you for part of the damage you deal' },
  looting:     { name: 'Looting',     for: ['weapon'], max: 1, color: '#ffd76a', trait: 'luck', desc: () => 'Foes drop extra gold' },
  swiftness:   { name: 'Swiftness',   for: ['weapon'], max: 1, color: '#9fffe0', trait: 'swift', desc: () => 'Sometimes strikes twice' },
  protection:  { name: 'Protection',  for: ['armor', 'helmet', 'shield'], max: 4, color: '#d9d4c7', desc: l => `+${l * 3}% armour` },
  vitality:    { name: 'Vitality',    for: ['armor', 'helmet'], max: 3, color: '#ff8a8a', desc: l => `+${l * 10} max health` },
  efficiency:  { name: 'Efficiency',  for: ['tool'], max: 5, color: '#7ee06a', desc: l => `${Math.ceil(l / 2)} fewer swings (at least 1)` },
  fortune:     { name: 'Fortune',     for: ['tool'], max: 3, color: '#ffd76a', desc: l => `+${l * 20}% from what you mine, chop or catch` },
};
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export const enchName = (key, lvl) => `${ENCHANTS[key]?.name || key}${ENCHANTS[key]?.max > 1 ? ` ${ROMAN[lvl] || lvl}` : ''}`;

/** What kind of thing a target is: 'weapon' | 'armor' | 'helmet' | 'shield' | 'tool' | null. */
export function targetKind(t) {
  if (!t) return null;
  if (t.tool) return TOOLS[t.tool] && !TOOLS[t.tool].utility ? 'tool' : null;
  const slot = t.item?.slot;
  return ['weapon', 'armor', 'helmet', 'shield'].includes(slot) ? slot : null;
}

/** The enchantments on a target: { key: level }. Targets are { item } for gear or { tool: key } for tools. */
export function enchantsOf(g, t) {
  if (t.tool) return ((rpgOf(g).toolEnch ||= {})[t.tool] ||= {});
  return (t.item.ench ||= {});
}

/** The same, but only to look: nothing is written into the save for items without enchantments. */
export const peekEnchants = (g, t) => (t.tool ? rpgOf(g).toolEnch?.[t.tool] : t.item.ench) || {};

/** Enchantments of a tool by key (for the mining code). */
export const toolEnchants = (g, key) => (key && rpgOf(g).toolEnch?.[key]) || {};

/** Forge traits that a weapon's enchantments give. */
export const enchantTraits = w => Object.entries(w?.ench || {}).map(([k]) => ENCHANTS[k]?.trait).filter(Boolean);

/** Cost to enchant: more with each try on the same thing, and more for rarer gear. */
export function enchantCost(g, t) {
  const tries = t.tool ? (rpgOf(g).toolEnchTries?.[t.tool] || 0) : (t.item.enchTries || 0);
  const rarity = t.item?.rarity || (t.tool ? Math.floor((TOOLS[t.tool].power || 1) / 3) : 0);
  return { gems: 3 + tries * 3 + rarity * 2, gold: 25 + tries * 25 + rarity * 15 };
}

export const canPay = (g, cost) => Object.entries(cost).every(([k, n]) => (g.state.resources[k] || 0) >= n);

/** Everything you could enchant: equipped gear, gear in your bag, and your tools. */
export function enchantables(g) {
  const r = rpgOf(g);
  const list = [];
  for (const [slot, it] of Object.entries(r.gear || {})) if (it && targetKind({ item: it })) list.push({ item: it, where: `Worn (${slot})` });
  for (const it of r.bag || []) if (targetKind({ item: it })) list.push({ item: it, where: 'In your bag' });
  for (const key of Object.keys(r.tools || {})) if (targetKind({ tool: key })) list.push({ tool: key, where: 'Tool' });
  return list;
}

/** A random enchantment for this target: which one (new or an upgrade) and what level. `score` 0..1 helps. */
export function rollEnchant(g, t, score = 0.5) {
  const kind = targetKind(t);
  const have = enchantsOf(g, t);
  let pool = Object.entries(ENCHANTS).filter(([k, e]) => e.for.includes(kind) && (have[k] || 0) < e.max).map(([k]) => k);
  if (Object.keys(have).length >= MAX_ENCHANTS) pool = pool.filter(k => have[k]);   // full: only upgrades
  if (!pool.length) return null;
  const key = pool[Math.floor(Math.random() * pool.length)];
  const e = ENCHANTS[key];
  // level: mostly I, sometimes II or III; a great ritual and luck push it higher
  const push = (score * 0.35 + luckOf(g) * 0.5) * 0.2;
  const x = Math.random() - push;
  let lvl = x < 0.03 ? 4 : x < 0.12 ? 3 : x < 0.4 ? 2 : 1;   // about 3% IV, 9% III, 28% II, the rest I (a great ritual nudges it up)
  lvl = Math.max((have[key] || 0) + 1, Math.min(e.max, lvl));   // an upgrade always goes up at least one
  return { key, level: Math.min(e.max, lvl) };
}

/** A fresh set of enchantments for this target (1 to 3 different ones), ignoring what it has now. */
export function rollEnchantSet(g, t, score = 0.5) {
  const kind = targetKind(t);
  const pool = Object.entries(ENCHANTS).filter(([, e]) => e.for.includes(kind)).map(([k]) => k);
  if (!pool.length) return [];
  const push = score * 0.12 + luckOf(g) * 0.3;   // about 60% one, 28% two, 12-18% three
  const x = Math.random() - push;
  const count = Math.min(pool.length, MAX_ENCHANTS, x < 0.12 ? 3 : x < 0.45 ? 2 : 1);   // mostly one, sometimes two, rarely three
  const set = [];
  const left = [...pool];
  for (let i = 0; i < count; i++) {
    const key = left.splice(Math.floor(Math.random() * left.length), 1)[0];
    set.push(rollLevel(g, key, score));
  }
  return set;
}

/** A level for one enchantment: about 3% IV, 9% III, 28% II, the rest I (a great ritual nudges it up). */
function rollLevel(g, key, score) {
  const e = ENCHANTS[key];
  const push = (score * 0.35 + luckOf(g) * 0.5) * 0.2;
  const x = Math.random() - push;
  const lvl = x < 0.03 ? 4 : x < 0.12 ? 3 : x < 0.4 ? 2 : 1;
  return { key, level: Math.max(1, Math.min(e.max, lvl)) };
}

/**
 * Enchant it: pay, roll and apply. Returns { ok, key, level, upgraded } or { ok: false, why }.
 * `force` = { key, level } sets an exact enchantment (admin, free).
 */
export function enchant(g, t, { score = 0.5, force = null } = {}) {
  const kind = targetKind(t);
  if (!kind) return { ok: false, why: 'That cannot be enchanted' };
  const have = enchantsOf(g, t);
  if (force) {
    const e = ENCHANTS[force.key];
    if (!e) return { ok: false, why: 'Unknown enchantment' };
    const level = Math.max(1, Math.min(force.level || e.max, e.max));
    const upgraded = !!have[force.key];
    have[force.key] = level;
    g.emit('change');
    return { ok: true, key: force.key, level, upgraded };
  }
  const cost = enchantCost(g, t);
  if (!canPay(g, cost)) return { ok: false, why: `Needs ${cost.gems} gems and ${cost.gold} gold` };
  const set = rollEnchantSet(g, t, score);
  if (!set.length) return { ok: false, why: 'That cannot be enchanted' };
  for (const [k, n] of Object.entries(cost)) g.state.resources[k] -= n;
  if (t.tool) { const tries = (rpgOf(g).toolEnchTries ||= {}); tries[t.tool] = (tries[t.tool] || 0) + 1; } else t.item.enchTries = (t.item.enchTries || 0) + 1;
  const lost = { ...have };
  for (const k of Object.keys(have)) delete have[k];   // the old enchantments are gone
  for (const e of set) have[e.key] = e.level;
  const rr = rpgOf(g); rr.enchanted = (rr.enchanted || 0) + 1;
  dailyProgress(g, 'enchant');
  g.emit('change');
  return { ok: true, set, lost, key: set[0].key, level: set[0].level };
}

/** Name and icon for a target (for menus). */
export function targetInfo(t) {
  if (t.tool) { const tl = TOOLS[t.tool]; return { name: tl.name, icon: tl.icon, fallbackIcon: tl.fallbackIcon, color: '#9fe0ff' }; }
  return { name: t.item.name, icon: t.item.icon, gear: t.item, color: RARITY[t.item.rarity]?.color || '#fff' };
}

/** Is the hero next to an Enchanting Table (or using one inside a house)? */
export function atEnchantTable(g, hero = null) {
  if (g.enchantTableHere) return true;
  const v = hero || g.state.villagers?.find(x => x.id === g.hero?.id);
  if (!v) return false;
  return (g.state.buildings || []).some(b => b.type === 'enchanting_table' && b.built !== false && Math.hypot((b.tx + 0.5) * TILE - v.x, (b.ty + 0.5) * TILE - v.y) < TILE * 3.5);
}

