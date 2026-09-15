import { ADULT_AGE, DAY_LENGTH } from '../core/constants.js';
import { clamp, chance, pick } from '../core/rng.js';
import { OFFICES, officeUnlocked, officialOf, appoint } from './court.js';
import { rulerOf, crown, isTrained } from './dynasty.js';
import { exileVillager } from './deeds.js';

/*
 * Natural talents: everyone is born good at one or two things (often what their parents were good at).
 * Their first talent decides their trade. A few are born Gifted: stronger learners who may grow proud,
 * and pride left unchecked becomes rebellion.
 */

export const TALENTS = {
  gather: { label: 'Foraging', trade: 'gather', weight: 12 },
  chop: { label: 'Woodcraft', trade: 'chop', weight: 13 },
  mine: { label: 'Mining', trade: 'mine', weight: 12 },
  farm: { label: 'Farming', trade: 'farm', weight: 13 },
  fish: { label: 'Fishing', trade: 'fish', weight: 6 },
  hunt: { label: 'Hunting', trade: 'hunt', weight: 8 },
  build: { label: 'Building', trade: 'build', weight: 12 },
  craft: { label: 'Smithing', trade: 'smith', weight: 7 },
  combat: { label: 'Fighting', trade: 'warrior', weight: 8 },
  stealth: { label: 'Stealth', trade: 'spy', weight: 4 },
  magic: { label: 'Magic', trade: 'mage', weight: 0 },
};

const GIFTED_CHANCE = 0.05;
// magic is not in the random pool: it only comes from a rare birth roll (or, sometimes, a wizard parent)
export const EGO_PROUD = 50;

function randomTalent(exclude = []) {
  const entries = Object.entries(TALENTS).filter(([k]) => !exclude.includes(k));
  let r = Math.random() * entries.reduce((n, [, t]) => n + t.weight, 0);
  for (const [k, t] of entries) if ((r -= t.weight) < 0) return k;
  return 'gather';
}

export const talentLabel = key => TALENTS[key]?.label || key;

/** The trade a talent leads to (stealth makes spies, and sometimes scouts). */
export function tradeOfTalent(key) {
  if (key === 'stealth') return chance(0.4) ? 'scout' : 'spy';
  return TALENTS[key]?.trade || 'gather';
}

/**
 * Born with one or two talents. Parents pass theirs on half the time; magic runs in families.
 * Sets v.talents, v.gifted, v.profession and gives the starting skills.
 */
const TRADE_TALENT = Object.fromEntries(Object.entries(TALENTS).map(([k, t]) => [t.trade, k]));
TRADE_TALENT.scout = 'stealth';

export function rollTalents(v, parents = []) {
  // what the parents are good at: their talents, or the skill of their trade
  const talentsOf = p => (p?.talents?.length ? p.talents : TRADE_TALENT[p?.profession] ? [TRADE_TALENT[p.profession]] : []);
  const mains = [...new Set(parents.map(p => talentsOf(p)[0]).filter(Boolean))];
  const inherited = [...new Set(parents.flatMap(talentsOf))];
  const count = chance(0.3) ? 2 : 1;
  const talents = [];
  for (let i = 0; i < count; i++) {
    const fromParents = (i === 0 ? mains : inherited).filter(t => !talents.includes(t));
    let t;
    if (fromParents.length && chance(i === 0 ? 0.65 : 0.45)) t = pick(fromParents);
    // magic stays rare: even a wizard's child only sometimes inherits the gift
    if (t === 'magic' && !chance(0.3)) t = null;
    t ||= randomTalent([...talents, 'magic']);
    if (!talents.length && !inherited.includes('magic') && chance(0.012)) t = 'magic';
    talents.push(t);
  }
  v.talents = talents;
  v.gifted = chance(parents.some(p => p?.gifted) ? GIFTED_CHANCE * 2.5 : GIFTED_CHANCE);
  v.ego = 0;
  if (v.gifted && !v.traits.includes('gifted')) v.traits.push('gifted');
  v.profession = tradeOfTalent(talents[0]);
  grantTalentSkills(v);
  return talents;
}

/** Skills from talents: a head start as a child, real skill as an adult (Gifted even more). */
export function grantTalentSkills(v) {
  if (!v.skills || !v.talents?.length) return;
  const adult = (v.age ?? 20) >= ADULT_AGE;
  v.talents.forEach((t, i) => {
    if (v.skills[t] == null) v.skills[t] = 0;
    const base = adult ? (i === 0 ? 3 + Math.random() * 2 : 2 + Math.random()) : 1 + Math.random() * 0.8;
    const level = base + (v.gifted ? (adult ? 2 : 1) : 0);
    v.skills[t] = Math.max(v.skills[t], Math.round(level * 10) / 10);
  });
  if (adult && v.talents.includes('combat') && v.profession === 'warrior') v.trained = true;
  if (adult && v.talents.includes('stealth') && v.profession === 'spy') v.spyTrained = true;
}

/** Old villagers get talents that match the trade they already have. */
export function ensureTalents(v, tradeSkill) {
  if (v.talents?.length) return;
  const t = tradeSkill?.[v.profession];
  v.talents = t ? [t] : [randomTalent()];
  v.ego ??= 0;
}

/** How much faster someone learns a skill. */
export function talentLearnMult(v, skill) {
  if (!v.talents?.includes(skill)) return 1;
  return v.gifted ? 3 : 2;
}

// ------------------------------------------------------------------ pride and rebellion

const bestTalentSkill = v => Math.max(0, ...(v.talents || []).map(t => v.skills?.[t] || 0));

/** Each day: the Gifted grow proud unless they are respected; at full pride they rebel. */
export function dailyTalents(g) {
  const s = g.state;
  const ruler = rulerOf(g);
  const rulerBest = ruler ? Math.max(ruler.skills.combat || 0, ruler.skills.magic || 0, bestTalentSkill(ruler)) : 0;
  for (const v of s.villagers) {
    if (!v.gifted || v.ruling || v.age < ADULT_AGE || v.away || v.jailed) continue;
    const best = bestTalentSkill(v);
    let growth = 1.5 + Math.max(0, best - 5) * 0.8;
    if (v.happy < 40) growth += 2;
    if (best > rulerBest) growth += 1.5;                                  // "why does someone weaker rule me?"
    if (v.office || v.traits.includes('knighted')) growth *= 0.3;          // respected: little to prove
    if (v.traits.includes('loyal')) growth *= 0.4;
    if (v.traits.includes('ambitious') || v.traits.includes('cruel')) growth *= 1.5;
    if (v.happy > 75) growth -= 1;
    const before = v.ego || 0;
    v.ego = clamp(before + growth, 0, 100);
    if (before < EGO_PROUD && v.ego >= EGO_PROUD) {
      g.log(`${fullName(v)} grows proud: "My talents are wasted here."`, 'bad', v);
      v._say = { text: 'My talents are wasted here.', until: performance.now() + 5000 };
    }
    if (v.ego >= 100 && !g.pendingEvent && !g.offline && !(v._rebelAt > s.time - DAY_LENGTH * 2)) {
      v._rebelAt = s.time;
      g.startEvent(rebellionEvent(g, v));
      break;   // one uprising at a time
    }
  }
}

export const fullName = v => (v.surname ? `${v.name} ${v.surname}` : v.name);

function followersOf(g, rebel) {
  const s = g.state;
  const max = 1 + Math.floor(s.villagers.length / 8);
  return s.villagers
    .filter(x => x !== rebel && x.age >= ADULT_AGE && !x.ruling && !x.office && !x.away && !x.jailed
      && (x.happy < 45 || x.traits.includes('ambitious') || x.traits.includes('cruel') || (rebel.surname && x.surname === rebel.surname)) && !x.traits.includes('loyal'))
    .slice(0, max);
}

/** A story event with choices, built for this rebel. */
export function rebellionEvent(g, rebel) {
  const followers = followersOf(g, rebel);
  const gifts = (rebel.talents || []).map(talentLabel).join(' and ');
  const name = fullName(rebel);
  const alive = () => g.state.villagers.includes(rebel);
  return {
    id: 'gifted_rebellion', title: `${name} Rebels`, icon: 'magic/rebel',
    text: `${name}, gifted in ${gifts}, refuses to take orders any longer. ${followers.length ? `${followers.length} villager${followers.length === 1 ? '' : 's'} stand with them and lay down their tools.` : 'They stand alone, but the whole village is watching.'}`,
    choices: [
      { label: 'Honour them with a title', karma: 1, cost: { influence: 40, gold: 30 }, apply: () => {
        if (!alive()) return 'They are already gone.';
        rebel.ego = 20;
        rebel.happy = clamp(rebel.happy + 30, 0, 100);
        for (const f of followers) f.happy = clamp(f.happy + 10, 0, 100);
        const office = Object.keys(OFFICES).find(k => officeUnlocked(g, k) && !officialOf(g, k));
        if (office && !appoint(g, office, rebel).error) return `${name} is made ${OFFICES[office].name}. Pride satisfied, they serve the realm.`;
        if (isTrained(rebel) && !rebel.traits.includes('knighted')) { rebel.traits.push('knighted'); return `${name} is knighted before the realm. The rebellion ends in cheers.`; }
        if (!rebel.traits.includes('loyal')) rebel.traits.push('loyal');
        return `${name} is named Champion of the Realm and swears loyalty.`;
      } },
      { label: 'Throw them in chains', karma: -2, apply: () => {
        if (!alive()) return 'They are already gone.';
        for (const f of followers) f.happy = clamp(f.happy - 12, 0, 100);
        if (chance(0.3 + (rebel.skills.magic || 0) * 0.04)) {
          const fled = [rebel, ...followers.filter(() => chance(0.5))];
          for (const x of fled) if (g.state.villagers.includes(x)) exileVillager(g, x);
          return `${name} breaks the chains and flees into the wild with ${fled.length - 1} follower${fled.length === 2 ? '' : 's'}.`;
        }
        rebel.jailed = true;
        rebel.job = 'prisoner';
        rebel.ego = 60;
        return `${name} is dragged to a cell. The followers go back to work, sullen and afraid.`;
      } },
      { label: 'Face them in a duel', karma: 0, apply: () => {
        if (!alive()) return 'They are already gone.';
        const ruler = rulerOf(g);
        if (!ruler) { crown(g, rebel, 'With no one to stop them,'); return `${name} seizes the empty throne!`; }
        const power = x => Math.max(x.skills.combat || 0, (x.skills.magic || 0) * 1.2) + (x.armed || x.inv?.pack?.sword ? 2 : 0) + Math.random() * 4 + (x.gifted ? 1 : 0);
        const r = power(ruler), p = power(rebel);
        if (r >= p) {
          rebel.ego = 0;
          if (!rebel.traits.includes('loyal')) rebel.traits.push('loyal');
          for (const f of followers) f.happy = clamp(f.happy - 5, 0, 100);
          ruler.happy = clamp(ruler.happy + 15, 0, 100);
          return `${ruler.name} wins the duel. ${name} kneels and swears loyalty.`;
        }
        ruler.hp = Math.max(1, ruler.hp - 40);
        rebel.ego = 0;
        crown(g, rebel, `${name} defeated ${ruler.name} in single combat.`);
        for (const f of followers) f.happy = clamp(f.happy + 15, 0, 100);
        return `${name} wins the duel and takes the throne!`;
      } },
      { label: 'Exile them and their followers', karma: -3, apply: () => {
        const gone = [rebel, ...followers].filter(x => g.state.villagers.includes(x));
        for (const x of gone) exileVillager(g, x);
        return `${name} and ${gone.length - 1} follower${gone.length === 2 ? '' : 's'} are driven from the village.`;
      } },
    ],
  };
}
