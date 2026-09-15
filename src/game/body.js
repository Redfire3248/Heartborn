/*
 * Body: everyone is born with Strength, Speed and Stamina from 1 to 10 (5 is ordinary).
 * Strength: heavy work (chopping, mining, building, farming, forging, hunting) and fighting go faster and hit harder.
 * Speed: they walk and run faster. Stamina: they work longer without flagging, get hungry more slowly and shrug off wounds.
 * Children take after their parents; hard work slowly builds strength and stamina. It shows: strong people swing
 * their tools faster, quick people's steps are quicker.
 */

export const BODY = { strength: 'Strength', speed: 'Speed', stamina: 'Stamina' };
const TRAIT_BONUS = { strong: { strength: 3 }, nimble: { speed: 3 }, hardworking: { stamina: 2 }, brave: { stamina: 1 }, lazy: { stamina: -2 }, sickly: { stamina: -2 } };
const HEAVY = new Set(['chop', 'mine', 'deepmine', 'quarry', 'build', 'farm', 'craft', 'hunt', 'fight', 'haul']);

const clamp10 = n => Math.max(1, Math.min(10, n));
const roll = () => Math.round((Math.random() + Math.random() + Math.random()) / 3 * 8 + 1);   // 1..9, mostly 4-6

export const bodyStat = (v, k) => v.body?.[k] ?? 5;
// admin heroes can go past 10; the effect keeps growing up to 30 (any faster and people would skip through walls)
const eff = (v, k) => Math.min(30, bodyStat(v, k));

export function rollBody(v, parents = []) {
  const b = {};
  for (const k of Object.keys(BODY)) {
    const ps = parents.filter(p => p?.body);
    // children land near their parents' average, with a little luck either way
    let n = ps.length ? ps.reduce((s, p) => s + p.body[k], 0) / ps.length + (Math.random() * 4 - 2) : roll();
    for (const t of v.traits || []) n += TRAIT_BONUS[t]?.[k] || 0;
    if (v.gifted || v.traits?.includes('gifted')) n += 1;
    b[k] = Math.round(clamp10(n) * 10) / 10;
  }
  v.body = b;
  return b;
}

export const ensureBody = v => v.body || rollBody(v);

/** Walking speed: 0.76x at speed 1, 1x at 5, 1.3x at 10. */
export const speedMult = v => 0.7 + eff(v, 'speed') * 0.06;
/** Heavy work and fighting: 0.8x at strength 1, 1x at 5, 1.25x at 10. */
export const strengthMult = v => 0.75 + eff(v, 'strength') * 0.05;
/** Any work: 0.92x at stamina 1, 1x at 5, 1.1x at 10. */
export const staminaMult = v => 0.9 + eff(v, 'stamina') * 0.02;
/** Hunger drain: 1.16x at stamina 1, 1x at 5, 0.8x at 10. */
export const hungerMult = v => Math.max(0.1, 1.2 - eff(v, 'stamina') * 0.04);
/** Damage taken: 1.12x at stamina 1, 1x at 5, 0.85x at 10. */
export const toughness = v => Math.max(0.2, 1.15 - eff(v, 'stamina') * 0.03);

/** How much faster this person does a kind of work because of their body. */
export function bodyWorkMult(v, taskType) {
  return (HEAVY.has(taskType) ? strengthMult(v) : 1) * staminaMult(v);
}

/** Hard work builds the body, a little at a time. */
export function trainBody(v, skill) {
  if (!v.body) return;
  const cap = k => Math.max(10, v.body[k]);   // training never lowers an admin hero
  const up = (k, n) => { v.body[k] = Math.round(Math.min(cap(k), v.body[k] + n) * 1000) / 1000; };
  if (skill === 'combat') { up('strength', 0.02); up('stamina', 0.02); up('speed', 0.01); }
  else if (HEAVY.has(skill) || skill === 'craft') { up('strength', 0.012); up('stamina', 0.008); }
  else if (skill === 'hunt' || skill === 'gather' || skill === 'fish') { up('stamina', 0.01); up('speed', 0.006); }
}
