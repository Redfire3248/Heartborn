/*
 * The Market Stall: a small shop you build. Each day it has three new offers (a tool a little better than yours,
 * a stack of potions and a piece of gear whose rarity is rolled), and it buys your ores and materials for gold.
 */
import { TILE, DAY_LENGTH } from '../core/constants.js';
import { rpgOf, makeGear, takeGear, CATALOG, RARITY } from './rpg.js';
import { TOOLS, toolsOf, giveTool } from './tools.js';
import { giveItem, CONSUMABLES } from './consumables.js';
import { MATERIALS, MATERIAL_KEYS } from './forging.js';

const GEAR_PRICE = [60, 160, 380, 900, 2200];
const POTIONS = [['potion', 25], ['mana_potion', 30], ['speed_potion', 35], ['strength_potion', 45], ['antidote', 20], ['golden_apple', 70], ['invisibility_potion', 90], ['med_kit', 60]];
/** What the stall pays for one of each material, by its rarity (Common .. Mythic). */
const SELL_PRICE = [2, 5, 12, 28, 70];

const today = g => Math.floor(g.state.time / DAY_LENGTH);

/** The best power among your tools of a kind (0 if none). */
const bestPower = (g, kind) => Math.max(0, ...Object.keys(toolsOf(g)).filter(k => TOOLS[k]?.kind === kind).map(k => TOOLS[k].power || 0));

function rollOffers(g) {
  const offers = [];
  // a tool: one or two tiers above your best of a random kind
  const kinds = ['pickaxe', 'axe', 'shovel', 'fishing_rod', 'hammer'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const want = bestPower(g, kind) + 1 + (Math.random() < 0.3 ? 1 : 0);
  const pick = Object.entries(TOOLS).filter(([, t]) => t.kind === kind && t.mat && !t.utility).sort((a, b) => Math.abs(a[1].power - want) - Math.abs(b[1].power - want))[0];
  if (pick) offers.push({ id: 'tool', type: 'tool', key: pick[0], price: { gold: Math.round(12 * pick[1].power * pick[1].power) } });
  // potions
  const [pk, each] = POTIONS[Math.floor(Math.random() * POTIONS.length)];
  const n = 2 + Math.floor(Math.random() * 3);
  offers.push({ id: 'potions', type: 'potion', key: pk, count: n, price: { gold: each * n } });
  // gear: rarity rolled (half common, a few legendary)
  const x = Math.random();
  const rarity = x < 0.45 ? 0 : x < 0.75 ? 1 : x < 0.92 ? 2 : x < 0.985 ? 3 : 4;
  const slots = ['weapon', 'armor', 'helmet', 'shield'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const options = Object.entries(CATALOG[slot]).filter(([, d]) => !d.noLoot && !d.admin && d.icon !== null && (d.minRarity || 0) <= rarity);
  if (options.length) {
    const [base] = options[Math.floor(Math.random() * options.length)];
    const item = makeGear(g, base, rarity);
    if (item) offers.push({ id: 'gear', type: 'gear', item, price: rarity >= 3 ? { gold: GEAR_PRICE[rarity], gems: 10 * (rarity - 2) } : { gold: GEAR_PRICE[rarity] } });
  }
  return offers;
}

/** Today's shop (new offers every day). */
export function shopOf(g, { reroll = false } = {}) {
  const s = (g.state.shop ||= {});
  if (reroll || s.day !== today(g) || !Array.isArray(s.offers)) { s.day = today(g); s.offers = rollOffers(g); s.bought = []; }
  return s;
}

export const canAfford = (g, price) => Object.entries(price).every(([k, n]) => (g.state.resources[k] || 0) >= n);

/** Buy an offer. Returns { ok, why, name }. */
export function buy(g, id, hero = null) {
  const s = shopOf(g);
  const o = s.offers.find(x => x.id === id);
  if (!o) return { ok: false, why: 'Not for sale' };
  if (s.bought.includes(id)) return { ok: false, why: 'Sold out until tomorrow' };
  if (!canAfford(g, o.price)) return { ok: false, why: 'Not enough gold' };
  for (const [k, n] of Object.entries(o.price)) g.state.resources[k] -= n;
  s.bought.push(id);
  let name = '';
  if (o.type === 'tool') { giveTool(g, o.key, 1); name = TOOLS[o.key].name; }
  else if (o.type === 'potion') { if (o.key === 'potion') rpgOf(g).potions = (rpgOf(g).potions || 0) + o.count; else giveItem(g, o.key, o.count); name = `${o.count} x ${offerName(o)}`; }
  else if (o.type === 'gear') { takeGear(g, o.item, hero); name = o.item.name; }
  g.emit('change');
  return { ok: true, name };
}

export const offerName = o => (o.type === 'tool' ? TOOLS[o.key]?.name : o.type === 'gear' ? o.item.name : o.key === 'potion' ? 'Health Potion' : CONSUMABLES[o.key]?.name || o.key);

/** What the stall pays for one of a material. */
export const sellPrice = k => SELL_PRICE[Math.min(4, MATERIALS[k]?.rarity || 0)];
const CURRENCY = new Set(['gold', 'gems']);   // money is not something the stall buys
export const sellable = g => MATERIAL_KEYS.filter(k => !CURRENCY.has(k) && (g.state.resources[k] || 0) >= 1);

/** Sell `n` of a material for gold. */
export function sell(g, k, n = 1) {
  if (!MATERIAL_KEYS.includes(k) || CURRENCY.has(k)) return { ok: false, why: 'The stall does not buy that' };
  n = Math.min(n, Math.floor(g.state.resources[k] || 0));
  if (n <= 0) return { ok: false, why: 'You have none' };
  const gold = sellPrice(k) * n;
  g.state.resources[k] -= n;
  g.state.resources.gold = (g.state.resources.gold || 0) + gold;
  g.emit('change');
  return { ok: true, gold, n };
}

/** Is the hero next to a Market Stall? */
export function atStall(g, hero = null) {
  const v = hero || g.state.villagers?.find(x => x.id === g.hero?.id);
  if (!v) return false;
  return (g.state.buildings || []).some(b => b.type === 'market_stall' && b.built !== false && Math.hypot((b.tx + 0.5) * TILE - v.x, (b.ty + 0.5) * TILE - v.y) < TILE * 3.5);
}

void RARITY;
