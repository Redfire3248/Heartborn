/*
 * Streaks: kill again quickly and the world starts shouting at you.
 *
 * Every kill inside the window raises your streak. From three up you hit harder and everything you kill is worth
 * more gold and experience, and the big numbers get a name — DOUBLE, RAMPAGE, GODLIKE. Taking a blow does not end
 * it, it halves it, so charging in is still the fun choice; letting the window run out ends it quietly.
 */
import { TILE } from '../core/constants.js';

const WINDOW = 6;            // seconds you have to keep it alive
export const STREAK_CAP = 0.35;   // the most extra damage a streak can ever give

/** The names, biggest first, so a lookup stops at the first one you have earned. */
export const CALLOUTS = [
  [40, 'BEYOND REASON', '#ff4d6d'],
  [30, 'LEGENDARY', '#ff6bd6'],
  [20, 'GODLIKE', '#ffd76a'],
  [15, 'BLOODBATH', '#ff8a3a'],
  [12, 'UNSTOPPABLE', '#ff9a3a'],
  [8, 'RAMPAGE', '#ffb347'],
  [5, 'KILLING SPREE', '#8aff9a'],
  [3, 'TRIPLE KILL', '#9fd4ff'],
  [2, 'DOUBLE KILL', '#c8b4ff'],
];

export const streakOf = g => g.hero?.streak || null;
/** How much harder you hit right now: nothing until three, then 3% a kill up to the cap. */
export function streakDamage(g) {
  const s = streakOf(g);
  if (!s || s.n < 3 || s.until < g.state.time) return 1;
  return 1 + Math.min(STREAK_CAP, (s.n - 2) * 0.03);
}
/** How much more gold and experience a kill is worth while the streak is hot. */
export const streakBonus = g => (streakOf(g)?.n >= 3 ? 1 + Math.min(0.5, (streakOf(g).n - 2) * 0.05) : 1);

/** A kill landed. Raises the streak, shouts if it just crossed a name, and returns the new count. */
export function bumpStreak(g, v) {
  const h = g.hero;
  if (!h) return 0;
  const now = g.state.time;
  const s = (h.streak && h.streak.until >= now) ? h.streak : { n: 0, until: 0, best: h.streak?.best || 0 };
  s.n++;
  s.until = now + WINDOW;
  s.best = Math.max(s.best || 0, s.n);
  h.streak = s;
  const call = CALLOUTS.find(c => c[0] === s.n);
  if (call && v) {
    const [, text, color] = call;
    g.float(v.x, v.y - TILE * 2.6, text, color);
    g.fx.tint = { color, strength: Math.min(0.3, 0.1 + s.n * 0.01), life: 0.35, max: 0.35 };
    g.fx.shake = Math.max(g.fx.shake || 0, Math.min(3, 1 + s.n * 0.1));
    g.announce?.(`${text} — ${s.n} in a row`);
  }
  return s.n;
}

/** A blow got through: it costs you half the streak rather than all of it. */
export function hurtStreak(g) {
  const s = streakOf(g);
  if (!s || s.until < g.state.time || s.n < 2) { if (g.hero) g.hero.streak = null; return; }
  s.n = Math.floor(s.n / 2);
  if (s.n < 2) { g.hero.streak = null; return; }
  s.until = g.state.time + WINDOW;
}

/** Ticked by the HUD: how far through the window we are (1 fresh, 0 gone), or null when there is no streak. */
export function streakLeft(g) {
  const s = streakOf(g);
  if (!s || s.n < 2) return null;
  const left = (s.until - g.state.time) / WINDOW;
  if (left <= 0) { g.hero.streak = null; return null; }
  return { n: s.n, left, name: (CALLOUTS.find(c => s.n >= c[0]) || [0, '', '#fff'])[1], color: (CALLOUTS.find(c => s.n >= c[0]) || [0, '', '#ffd76a'])[2] };
}
