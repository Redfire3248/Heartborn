import { LAW_CATEGORIES, DEFAULT_LAWS, lawOption } from '../data/laws.js';
import { OFFICES, officeUnlocked, officialOf, appoint, bestForOffice } from './court.js';

/*
 * Auto-pick: the moment something new unlocks, the best choice is made for you.
 * - A court office unlocks (its building is built) and nobody holds it: the best person is appointed,
 *   as soon as the village has enough workers to spare them.
 * - A law unlocks: if you have never set that category yourself, the best law for your village is enacted
 *   (free, and without the day of waiting a decree normally needs). A law you chose stays yours.
 * Turn it off in the Rule panel.
 */

const EVERY = 4;   // game seconds between checks

export const autoPickOn = g => g.state.autoPick !== false;

/** How good a law would be for this village right now. */
export function lawScore(g, opt) {
  const s = g.state;
  const e = opt.effects || {};
  const pop = s.villagers.length;
  const avgHappy = pop ? s.villagers.reduce((n, v) => n + v.happy, 0) / pop : 60;
  const markets = s.buildings.filter(b => b.built && b.type === 'market').length;
  const foodLow = (s.resources.food || 0) < pop * 4;
  const threatened = (s.incoming?.length || 0) > 0 || Object.keys(s.battles || {}).length > 0;
  let score = 0;
  score += (e.happy || 0) * (avgHappy < 40 ? 3 : 1.2);
  score += (e.work || 0) * 80;
  score += (e.combat || 0) * (threatened ? 60 : 30);
  score += (e.defense || 0) * 0.8;
  score += (e.fate || 0) * 40;
  score += (e.influence || 0) * 4;
  score += (e.goldPerPop || 0) * pop * 0.8;
  score += ((e.marketMult || 1) - 1) * markets * 6;
  score += (e.join || 0) * (pop < 30 ? 80 : 30);
  score += (e.karma || 0) * (s.karma < -40 ? 2 : 15);   // a good ruler avoids cruel laws; a tyrant stops caring
  score += e.autoRally ? 3 : 0;
  score += e.food ? (foodLow ? 20 : -6) : 0;
  score += (e.raidCooldown || 1) < 1 ? 2 : 0;
  return score;
}

const available = (g, opt) => (!opt.era || g.state.era >= opt.era) && (!opt.requires || g.hasBuilding(opt.requires));

export function updateAutoPick(g, dt) {
  if (g.visiting || g.offline) return;
  g._autoPickTimer = (g._autoPickTimer ?? 1) - dt;
  if (g._autoPickTimer > 0) return;
  g._autoPickTimer = EVERY;
  if (!autoPickOn(g)) return;
  runAutoPick(g);
}

export function runAutoPick(g) {
  const s = g.state;
  const seen = (s.unlockSeen ||= {});
  const picked = [];

  // offices: fill each one once, when it first unlocks (dismissing someone later is your call)
  const adults = () => s.villagers.filter(v => !v.away && !v.ruling && v.age >= 16).length;
  const held = () => Object.keys(OFFICES).filter(k => officialOf(g, k)).length;
  for (const key of Object.keys(OFFICES)) {
    if (seen[`office:${key}`] || !officeUnlocked(g, key)) continue;
    if (officialOf(g, key)) { seen[`office:${key}`] = 1; continue; }
    // officials stop working with their hands: keep at least three workers for every office
    if (adults() - held() < 4 + held() * 3) continue;   // not yet: try again when the village has grown
    seen[`office:${key}`] = 1;
    const best = bestForOffice(g, key);
    if (best && !appoint(g, key, best).error) picked.push(`${best.name} as ${OFFICES[key].name}`);
  }

  // laws: something new unlocked in a category you have not decided yourself
  s.lawAuto ||= {};
  for (const cat of LAW_CATEGORIES) {
    let fresh = false;
    for (const opt of cat.options) {
      if (seen[`law:${opt.id}`] || !available(g, opt)) continue;
      seen[`law:${opt.id}`] = 1;
      fresh = true;
    }
    if (!fresh) continue;
    const manual = s.lawChangedAt?.[cat.id] != null && !s.lawAuto[cat.id];
    if (manual) continue;
    const current = s.laws?.[cat.id] || DEFAULT_LAWS[cat.id];
    const options = cat.options.filter(o => available(g, o));
    const best = options.reduce((a, b) => (lawScore(g, b) > lawScore(g, a) ? b : a), lawOption(cat.id, current) || options[0]);
    if (!best || best.id === current || lawScore(g, best) <= lawScore(g, lawOption(cat.id, current)) + 1) continue;
    s.laws = { ...DEFAULT_LAWS, ...(s.laws || {}), [cat.id]: best.id };
    s.lawAuto[cat.id] = true;
    picked.push(`${best.name} (${cat.name.toLowerCase()})`);
  }

  if (!picked.length) return picked;
  g.recalc();
  g.log(`Auto-pick: ${picked.join(', ')}.`, 'good');
  g.announce(`Auto-picked: ${picked[0]}${picked.length > 1 ? ` +${picked.length - 1}` : ''}`);
  g.emit('change');
  return picked;
}
