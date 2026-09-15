import { chance, pick } from '../core/rng.js';
import { rollTalents, grantTalentSkills, ensureTalents } from './talents.js';

/*
 * Professions: most people have ONE trade they work in (plus gathering food and resting).
 * A few are "Jack of all trades" and can take any job. Households pass their trade on:
 * children usually follow a parent, and families who arrive together often share a trade.
 */

export const PROFESSIONS = {
  gather: 'Gatherer', chop: 'Woodcutter', mine: 'Miner', farm: 'Farmer', fish: 'Fisher', hunt: 'Hunter',
  build: 'Builder', smith: 'Smith', warrior: 'Soldier', scout: 'Scout', spy: 'Spy', explore: 'Explorer', mage: 'Wizard',
};
// how common each trade is for newcomers
const WEIGHTS = { gather: 16, chop: 14, mine: 12, farm: 14, fish: 6, hunt: 8, build: 12, smith: 6, warrior: 5, scout: 3, spy: 1, explore: 3 };
const CALLING_TRADE = { soldier: 'warrior', farmer: 'farm', crafter: 'smith', hunter: 'hunt', scholar: 'build', priest: 'gather', leader: 'build' };

// the skill each trade is born with (spies are born sneaky, soldiers born to fight)
export const TRADE_SKILL = { gather: 'gather', chop: 'chop', mine: 'mine', farm: 'farm', fish: 'fish', hunt: 'hunt', build: 'build', smith: 'craft', warrior: 'combat', scout: 'stealth', spy: 'stealth', explore: 'combat', mage: 'magic' };
const ADULT = 16;

/** Give someone the skill of their trade: a head start as a child, a real working skill as an adult. */
export function grantTradeSkill(v) {
  if (v.talents?.length) { grantTalentSkills(v); return; }
  const skill = TRADE_SKILL[v.profession];
  if (!skill || !v.skills) return;
  const adult = (v.age ?? 20) >= ADULT;
  const level = adult ? 3 + Math.random() * 2 : 1 + Math.random();
  v.skills[skill] = Math.max(v.skills[skill] || 0, Math.round(level * 10) / 10);
  if (adult && v.profession === 'warrior') v.trained = true;   // soldiers by trade are trained soldiers
  if (adult && v.profession === 'spy') v.spyTrained = true;
}

export const VERSATILE = 'versatile';
export const isVersatile = v => !!v.traits?.includes(VERSATILE) || !!v.robot;

export function randomTrade() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(WEIGHTS)) if ((r -= w) < 0) return k;
  return 'gather';
}

const makeVersatile = v => { if (!isVersatile(v)) v.traits = [...(v.traits || []), VERSATILE]; };

/** Give someone a trade if they don't have one yet (new villagers and old saves). */
export function ensureProfession(v, { versatileChance = 0.18 } = {}) {
  if (v.profession && PROFESSIONS[v.profession]) { ensureTalents(v, TRADE_SKILL); return v.profession; }
  if (PROFESSIONS[v.job] && v.job !== 'gather') { v.profession = v.job; leadTalent(v); grantTradeSkill(v); }
  else if (v.job === 'recruit') { v.profession = 'warrior'; leadTalent(v); grantTradeSkill(v); }
  else rollTalents(v);   // born with natural talents, and the first one is their trade
  if (chance(versatileChance)) makeVersatile(v);
  return v.profession;
}

/** A newborn's trade: usually a parent's, sometimes their own path. */
export function inheritProfession(child, mom, dad) {
  const parents = [mom, dad].filter(Boolean);
  rollTalents(child, parents);   // talents often run in the family
  const versatileParents = parents.filter(isVersatile).length;
  if (chance(0.1 + versatileParents * 0.15)) makeVersatile(child);
}

/** Families who arrive together: most share the first member's trade. */
export function shareHousehold(members) {
  const [first, ...rest] = members;
  if (!first) return;
  ensureProfession(first);
  for (const m of rest) {
    if (first.surname) m.surname = first.surname;   // one household, one family name
    // families share a trade, but the gift of magic is not handed around a household
    if (chance(0.65) && first.talents?.[0] !== 'magic') { m.talents = [...(first.talents || [])]; m.profession = first.profession; grantTradeSkill(m); }
  }
}

/** A child's calling decides their trade (Leaders learn a bit of everything). */
export function professionFromCalling(v) {
  if (!v.calling || !CALLING_TRADE[v.calling]) return;
  v.profession = CALLING_TRADE[v.calling];
  grantTradeSkill(v);
  if (v.calling === 'leader') makeVersatile(v);
}

// anyone can rest or forage for food; spies are recruited and trained at a Spy Den, not born to it
const ALWAYS = new Set(['idle', 'gather', 'spy', 'mine']);   // anyone can swing a pickaxe

/** The tool (an item) each trade works with. The smith makes them. */
export const TRADE_TOOL = { chop: 'axe', mine: 'pickaxe', farm: 'hoe', build: 'hammer', smith: 'hammer', hunt: 'bow', fish: 'spear_t' };

/** Someone given a trade directly: the skill of that trade becomes their main talent. */
function leadTalent(v) {
  const skill = TRADE_SKILL[v.profession];
  if (skill) v.talents = [skill, ...(v.talents || []).filter(t => t !== skill)].slice(0, 2);
  else ensureTalents(v, TRADE_SKILL);
}

export function canDoJob(v, job) {
  if (job === 'mage') return !!v.talents?.includes('magic');   // magic cannot be learned without the gift
  if (ALWAYS.has(job) || isVersatile(v)) return true;
  const trade = ensureProfession(v);
  if (job === 'recruit') return trade === 'warrior';
  return trade === job;
}

export function professionLabel(v) {
  return isVersatile(v) ? 'Jack of all trades' : PROFESSIONS[ensureProfession(v)] || 'Gatherer';
}
