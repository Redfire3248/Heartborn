import { chance, pick } from '../core/rng.js';

/*
 * Professions: most people have ONE trade they work in (plus gathering food and resting).
 * A few are "Jack of all trades" and can take any job. Households pass their trade on:
 * children usually follow a parent, and families who arrive together often share a trade.
 */

export const PROFESSIONS = {
  gather: 'Gatherer', chop: 'Woodcutter', mine: 'Miner', farm: 'Farmer', fish: 'Fisher', hunt: 'Hunter',
  build: 'Builder', smith: 'Smith', warrior: 'Soldier', scout: 'Scout', spy: 'Spy', explore: 'Explorer',
};
// how common each trade is for newcomers
const WEIGHTS = { gather: 16, chop: 14, mine: 12, farm: 14, fish: 6, hunt: 8, build: 12, smith: 6, warrior: 5, scout: 3, spy: 1, explore: 3 };
const CALLING_TRADE = { soldier: 'warrior', farmer: 'farm', crafter: 'smith', hunter: 'hunt', scholar: 'build', priest: 'gather', leader: 'build' };

export const VERSATILE = 'versatile';
export const isVersatile = v => !!v.traits?.includes(VERSATILE) || !!v.robot;

function randomTrade() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(WEIGHTS)) if ((r -= w) < 0) return k;
  return 'gather';
}

const makeVersatile = v => { if (!isVersatile(v)) v.traits = [...(v.traits || []), VERSATILE]; };

/** Give someone a trade if they don't have one yet (new villagers and old saves). */
export function ensureProfession(v, { versatileChance = 0.18 } = {}) {
  if (v.profession && PROFESSIONS[v.profession]) return v.profession;
  v.profession = PROFESSIONS[v.job] ? v.job : v.job === 'recruit' ? 'warrior' : randomTrade();
  if (chance(versatileChance)) makeVersatile(v);
  return v.profession;
}

/** A newborn's trade: usually a parent's, sometimes their own path. */
export function inheritProfession(child, mom, dad) {
  const parents = [mom, dad].filter(Boolean);
  const followParent = parents.length && chance(0.7);
  child.profession = followParent ? pick(parents).profession || randomTrade() : randomTrade();
  const versatileParents = parents.filter(isVersatile).length;
  if (chance(0.1 + versatileParents * 0.15)) makeVersatile(child);
}

/** Families who arrive together: most share the first member's trade. */
export function shareHousehold(members) {
  const [first, ...rest] = members;
  if (!first) return;
  ensureProfession(first);
  for (const m of rest) if (chance(0.65)) m.profession = first.profession;
}

/** A child's calling decides their trade (Leaders learn a bit of everything). */
export function professionFromCalling(v) {
  if (!v.calling || !CALLING_TRADE[v.calling]) return;
  v.profession = CALLING_TRADE[v.calling];
  if (v.calling === 'leader') makeVersatile(v);
}

// anyone can rest or forage for food; spies are recruited and trained at a Spy Den, not born to it
const ALWAYS = new Set(['idle', 'gather', 'spy']);

export function canDoJob(v, job) {
  if (ALWAYS.has(job) || isVersatile(v)) return true;
  const trade = ensureProfession(v);
  if (job === 'recruit') return trade === 'warrior';
  return trade === job;
}

export function professionLabel(v) {
  return isVersatile(v) ? 'Jack of all trades' : PROFESSIONS[ensureProfession(v)] || 'Gatherer';
}
