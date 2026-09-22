/*
 * Shared monsters: on a server, one player runs the creatures for everybody.
 *
 * Whoever holds the lease is the "mob host": their game is the real one, and it sends out where every monster
 * is and how hurt it is, a few times a second. Everyone else stops running their own monsters and shows the
 * host's instead, so you all fight the same zombie. When a guest lands a blow the damage is sent to the host,
 * who applies it; when something dies the host says who killed it, and that player's own game hands out the
 * loot and the experience.
 *
 * The lease is short. If the host closes the game, someone else picks the monsters up a few seconds later.
 */
import { TILE } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';
import { maxHp } from './creatures.js';

export const MOB_LEASE_MS = 12_000;   // a host that has said nothing for this long has gone
export const MOB_RANGE = 46;          // tiles: monsters this close to a player are worth sending

/** What a guest needs to know about one monster. */
export const packMob = c => ({
  t: c.t, x: Math.round(c.x), y: Math.round(c.y), hp: Math.round(c.hp ?? maxHp(c)), mx: Math.round(maxHp(c)),
  f: c._flip ? 1 : 0, s: c.scale && c.scale !== 1 ? Math.round(c.scale * 100) : 0,
  ...(c.elite ? { e: 1 } : {}), ...(c.bounty ? { b: 1 } : {}),
});

/** The monsters the host should send: the ones near any player (its own hero and everyone else's). */
export function mobsToSend(g, players = []) {
  const spots = [];
  const me = g.hero && g.state.villagers?.find(v => v.id === g.hero.id);
  if (me) spots.push(me);
  for (const p of players) spots.push(p);
  const out = {};
  let n = 0;
  for (const c of g.state.creatures) {
    if (!CREATURES[c.t]?.hostile || c.net) continue;
    if (spots.length && !spots.some(p => Math.hypot(c.x - p.x, c.y - p.y) < MOB_RANGE * TILE)) continue;
    out[c.id] = packMob(c);
    if (++n >= 70) break;   // a crowded island still fits in one message
  }
  return out;
}

/**
 * A guest takes the host's monsters as its own: new ones appear, known ones glide to where they now are,
 * and ones the host no longer sends are gone.
 */
export function applyNetMobs(g, mobs) {
  const seen = new Set();
  for (const [id, m] of Object.entries(mobs || {})) {
    if (!CREATURES[m.t]) continue;
    seen.add(id);
    let c = g.state.creatures.find(x => x.netId === id);
    if (!c) {
      c = { id: `n${id}`, netId: id, net: true, t: m.t, x: m.x, y: m.y, hp: m.hp };
      g.state.creatures.push(c);
    }
    c.t = m.t;
    c._nx = m.x; c._ny = m.y;     // where it really is: we slide towards it so it does not jump
    c.hp = m.hp; c._netMax = m.mx;
    c._flip = !!m.f;
    if (m.s) c.scale = m.s / 100;
    c.elite = !!m.e; c.bounty = !!m.b;
  }
  const gone = g.state.creatures.filter(c => c.net && !seen.has(c.netId));
  if (gone.length) g.state.creatures = g.state.creatures.filter(c => !gone.includes(c));
}

/** Slides the host's monsters towards where they really are (called every frame on a guest). */
export function glideNetMobs(g, dt) {
  for (const c of g.state.creatures) {
    if (!c.net || c._nx == null) continue;
    const k = Math.min(1, dt * 9);
    const dx = c._nx - c.x, dy = c._ny - c.y;
    if (Math.hypot(dx, dy) > TILE * 6) { c.x = c._nx; c.y = c._ny; continue; }   // teleported (or a long gap): just be there
    c.x += dx * k; c.y += dy * k;
    c._walking = Math.hypot(dx, dy) > 1.5;
  }
}
