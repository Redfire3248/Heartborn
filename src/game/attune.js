/*
 * Ore attunement: the rare metal in your pack does something even before you forge it.
 *
 * The Forge turns a material into a weapon trait. This is the other half — hold enough of one of the rarer ores and
 * it works on you directly: Frostite slows what hits you, Magmite burns what touches you, Voidstone feeds your
 * skills. Only your single deepest hoard counts, so it is a choice, not a shopping list, and it costs nothing to
 * try: stop carrying the ore and the effect goes with it.
 */
import { MATERIALS } from './forging.js';
import { TILE } from '../core/constants.js';

/** How much of an ore you must be carrying, and what it does while you are. */
export const ATTUNEMENTS = {
  frostite: { need: 30, name: 'Frostbound', color: '#9fd4ff', desc: 'Anything that strikes you is chilled and slowed for 2 seconds.' },
  magmite: { need: 30, name: 'Emberbound', color: '#ff9a3a', desc: 'Anything that strikes you catches fire.' },
  mythril: { need: 30, name: 'Mythril-light', color: '#9fffe0', desc: 'You move 8% faster and your dash costs a third less.' },
  titanium: { need: 30, name: 'Ironbound', color: '#c8a070', desc: 'Every blow that reaches you is cut by a further 8%.' },
  moonstone: { need: 25, name: 'Moonbound', color: '#b06aff', desc: 'Your weapon skill comes back 20% sooner.' },
  sunstone: { need: 25, name: 'Sunbound', color: '#ffd76a', desc: 'You deal 15% more damage in daylight.' },
  jade: { need: 40, name: 'Jadebound', color: '#7aff9a', desc: 'You heal 1 health a second out of combat.' },
  cobalt: { need: 40, name: 'Cobaltbound', color: '#9fd4ff', desc: 'Your stamina comes back half again as fast.' },
  obsidian: { need: 40, name: 'Obsidianbound', color: '#ff8a7a', desc: '+5% chance of a critical hit.' },
  voidstone: { need: 15, name: 'Voidbound', color: '#c08aff', desc: 'Your weapon skill hits 25% harder and reaches further.' },
};

export const ATTUNE_KEYS = Object.keys(ATTUNEMENTS);

/**
 * Which one you are attuned to right now: the rarest ore you are carrying enough of. Returns null when nothing
 * qualifies, so every caller can treat "no attunement" as the ordinary case.
 */
export function attunement(g) {
  const res = g?.state?.resources;
  if (!res) return null;
  let best = null, bestRarity = -1;
  for (const k of ATTUNE_KEYS) {
    const a = ATTUNEMENTS[k];
    if ((res[k] || 0) < a.need) continue;
    const rarity = MATERIALS[k]?.rarity ?? 0;
    if (rarity > bestRarity) { bestRarity = rarity; best = k; }
  }
  return best;
}

export const attunedTo = (g, key) => attunement(g) === key;

/** Everything the attunements change, in one place, so no caller has to know the list. */
export const attuneSpeed = g => (attunedTo(g, 'mythril') ? 1.08 : 1);
export const attuneArmor = g => (attunedTo(g, 'titanium') ? 0.08 : 0);
export const attuneCrit = g => (attunedTo(g, 'obsidian') ? 0.05 : 0);
export const attuneDashCost = g => (attunedTo(g, 'mythril') ? 0.66 : 1);
export const attuneCooldown = g => (attunedTo(g, 'moonstone') ? 0.8 : 1);
export const attuneAbilityPower = g => (attunedTo(g, 'voidstone') ? 1.25 : 1);
export const attuneStamina = g => (attunedTo(g, 'cobalt') ? 1.5 : 1);
export const attuneDamage = g => (attunedTo(g, 'sunstone') && !g.dungeon && !g.isNight ? 1.15 : 1);

/** Something hit you: Frostite and Magmite answer back. */
export function attuneOnHurt(g, from) {
  if (!from || !('hp' in from)) return;
  const a = attunement(g);
  if (a === 'frostite') {
    from._chill = { k: 0.45, until: g.state.time + 2 };
    g.spark?.(from.x, from.y - TILE * 0.5, '#9fd4ff', 6, { speed: 70 });
  } else if (a === 'magmite') {
    from._burn = { dps: Math.max(6, from._burn?.dps || 0), until: g.state.time + 3, by: g.hero?.id };
    g.spark?.(from.x, from.y - TILE * 0.5, '#ff9a3a', 6, { speed: 70 });
  }
}

/** Ticked with the hero: the quiet healing of Jade. */
export function attuneTick(g, v, st, dt) {
  if (!attunedTo(g, 'jade') || !v || v.hp >= st.maxHp) return;
  if ((g.hero?.sinceHit ?? 99) < 5) return;
  v.hp = Math.min(st.maxHp, v.hp + dt);
}
