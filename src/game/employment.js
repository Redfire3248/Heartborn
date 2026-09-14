import { JOBS, assignJob } from './villagers.js';
import { managed, distribute } from './court.js';
import { ADULT_AGE } from '../core/constants.js';

/*
 * Employment Office: set a target number of workers for each job and the clerks keep it that way,
 * moving as few people as possible. Everyone not covered by a target gathers food.
 * state.employment = { targets: { job: n }, on: true }
 */

export const OFFICE = 'employment_office';
export const hasOffice = g => g.hasBuilding(OFFICE);
export const employmentOf = g => (g.state.employment ||= { targets: {}, on: true });

/** Jobs the office can staff (soldiers are the Marshal's business, spies need a Spy Den). */
export const STAFFABLE = Object.keys(JOBS).filter(j => !['idle', 'warrior', 'recruit'].includes(j));

export const activeTargets = g => {
  const e = employmentOf(g);
  return hasOffice(g) && e.on && Object.values(e.targets).some(n => n > 0);
};

export function setTarget(g, job, n) {
  const e = employmentOf(g);
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v) e.targets[job] = v; else delete e.targets[job];
}

/** Presets that scale with the workforce. */
export function applyPreset(g, preset) {
  const e = employmentOf(g);
  const n = managed(g).length;
  const pct = share => Object.fromEntries(Object.entries(share).map(([j, p]) => [j, Math.round(n * p)]).filter(([, v]) => v > 0));
  const presets = {
    balanced: { gather: 0.2, farm: 0.15, fish: 0.08, chop: 0.17, mine: 0.15, build: 0.12, hunt: 0.05, smith: 0.05, scout: 0.03 },
    food: { gather: 0.25, farm: 0.3, fish: 0.15, hunt: 0.1, chop: 0.1, build: 0.1 },
    industry: { chop: 0.3, mine: 0.3, build: 0.15, smith: 0.1, gather: 0.15 },
    builders: { build: 0.4, chop: 0.25, mine: 0.2, gather: 0.15 },
    clear: {},
  };
  e.targets = pct(presets[preset] || {});
  e.on = true;
  return applyNow(g);
}

/** Move people so every job meets its target. Returns how many changed jobs. */
export function applyNow(g) {
  if (!hasOffice(g)) return 0;
  const e = employmentOf(g);
  const pool = managed(g);
  const targets = { ...e.targets };
  // whoever is left over gathers food rather than standing idle
  const assigned = Object.values(targets).reduce((a, b) => a + b, 0);
  if (assigned < pool.length) targets.gather = (targets.gather || 0) + (pool.length - assigned);
  return distribute(g, pool, targets);
}

export function updateEmployment(g, dt) {
  if (!activeTargets(g) || g.state.rallied) return;
  g._employTimer = (g._employTimer ?? 2) - dt;
  if (g._employTimer > 0) return;
  g._employTimer = 5;
  applyNow(g);
}

/**
 * Move up to `n` people into (n > 0) or out of (n < 0) a job at once.
 * In: taken from idle first, then gatherers, then the biggest other jobs. Out: sent to gather.
 */
export function moveWorkers(g, job, n) {
  const s = g.state;
  const auto = activeTargets(g);   // with job targets on, the office keeps managing these people
  const adults = s.villagers.filter(v => v.age >= ADULT_AGE && !v.away && !v.office && !v.ruling && !v.jailed);
  let moved = 0;
  if (n < 0) {
    const inJob = adults.filter(v => v.job === job);
    for (const v of inJob.slice(0, -n)) if (assignJob(g, v, job === 'gather' ? 'idle' : 'gather', auto)) moved++;
  } else {
    const counts = {};
    for (const v of adults) counts[v.job] = (counts[v.job] || 0) + 1;
    const donors = adults.filter(v => v.job !== job && v.job !== 'warrior' && v.job !== 'recruit' && !v.prevJob)
      .sort((a, b) => rank(a.job) - rank(b.job) || (counts[b.job] || 0) - (counts[a.job] || 0));
    for (const v of donors) {
      if (moved >= n) break;
      if (assignJob(g, v, job, auto)) moved++;
    }
  }
  if (activeTargets(g)) setTarget(g, job, (employmentOf(g).targets[job] || 0) + (n > 0 ? moved : -moved));
  return moved;
}
const rank = job => (job === 'idle' ? 0 : job === 'gather' ? 1 : 2);

/** The skill that makes someone good at a job. */
export const JOB_SKILL = { gather: 'gather', chop: 'chop', mine: 'mine', farm: 'farm', fish: 'fish', hunt: 'hunt', build: 'build', smith: 'craft', spy: 'stealth', scout: 'stealth', recruit: 'combat', warrior: 'combat', explore: 'combat' };
const TRAIT_FIT = { warrior: ['brave', 'strong'], recruit: ['brave', 'strong'], explore: ['brave', 'curious'], build: ['hardworking', 'strong'], smith: ['clever', 'strong'], spy: ['sly', 'clever'], scout: ['sly', 'curious'] };

/** How good a villager is for a job: skill first, then fitting traits, health and happiness. */
export function fitness(v, job) {
  let s = (v.skills?.[JOB_SKILL[job]] || 0) * 10;
  for (const t of TRAIT_FIT[job] || []) if (v.traits?.includes(t)) s += 6;
  if (v.traits?.includes('lazy')) s -= 5;
  if (v.traits?.includes('hardworking')) s += 3;
  return s + v.hp * 0.02 + (v.happy || 0) * 0.02 - (v.sick ? 8 : 0);
}

const OFFICE_FIT = {
  steward: { skills: ['farm', 'gather', 'build'], traits: ['clever', 'honest', 'loyal'] },
  master_builder: { skills: ['build', 'chop'], traits: ['hardworking', 'clever'] },
  marshal: { skills: ['combat'], traits: ['brave', 'strong', 'loyal'] },
  spymaster: { skills: ['stealth'], traits: ['sly', 'clever'] },
  treasurer: { skills: ['craft'], traits: ['clever', 'honest'] },
  high_priest: { skills: [], traits: ['kind', 'honest', 'wise'] },
};

/** The best villager to appoint to a court office (not already serving, adult, at home). */
export function bestForOffice(g, key) {
  const fit = OFFICE_FIT[key] || { skills: [], traits: [] };
  const score = v => fit.skills.reduce((n, s) => n + (v.skills?.[s] || 0) * 10, 0) + fit.traits.filter(t => v.traits?.includes(t)).length * 12
    - (v.traits?.includes('lazy') ? 8 : 0) - (v.traits?.includes('greedy') && key === 'treasurer' ? 15 : 0) + Math.min(v.age, 50) * 0.2;
  return g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away && !v.office && !v.ruling && !v.jailed && !v.traitor)
    .sort((a, b) => score(b) - score(a))[0] || null;
}

/** Auto pick: move the single best available person into a job. Returns them, or null. */
export function autoPick(g, job) {
  const candidates = g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away && !v.office && !v.ruling && !v.jailed && !v.prevJob
    && v.job !== job && v.job !== 'warrior' && v.job !== 'recruit');
  const best = candidates.sort((a, b) => fitness(b, job) - fitness(a, job))[0];
  if (!best || !assignJob(g, best, job, activeTargets(g))) return null;
  if (activeTargets(g)) setTarget(g, job, (employmentOf(g).targets[job] || 0) + 1);
  return best;
}
