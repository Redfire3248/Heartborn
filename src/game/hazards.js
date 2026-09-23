/*
 * Things left lying on the ground after a weapon skill: a wall of fire, a crater, hallowed ground.
 *
 * They are not just damage in a circle — each one changes the fight while it lasts. Fire burns anything that
 * walks through it, a crater slows what stands in it and shields you while you hold it, hallowed ground keeps
 * searing the undead. They live in g.hazards and tick with the world.
 */
import { TILE } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';

/** Drops a hazard on the ground. `kind`: 'fire' | 'crater' | 'hallow'. */
export function addHazard(g, kind, x, y, o = {}) {
  (g.hazards ||= []).push({ kind, x, y, r: TILE * (o.r || 2), life: o.life || 5, max: o.life || 5, dps: o.dps || 0, by: o.by || null, slow: o.slow || 0, mult: o.mult || 1 });
}

/** Is your hero standing in one of these? (the crater's shield, the hallowed healing) */
export const hazardAt = (g, kind, x, y) => (g.hazards || []).find(z => z.kind === kind && Math.hypot(z.x - x, z.y - y) < z.r);

/** Ticks every hazard: burns what stands in fire, slows what stands in a crater, fades them out. */
export function updateHazards(g, dt) {
  const list = g.hazards;
  if (!list?.length) return;
  for (const z of list) {
    z.life -= dt;
    z.t = (z.t || 0) + dt;
    if (z.t < 0.25) continue;   // it bites four times a second, not every frame
    const step = z.t; z.t = 0;
    for (const c of g.state.creatures) {
      const def = CREATURES[c.t];
      if (!def?.hostile) continue;
      if (Math.hypot(c.x - z.x, c.y - z.y) > z.r) continue;
      if (z.kind === 'fire') {
        c.hp = (c.hp ?? 1) - z.dps * step;
        c._hurtFlash = 0.2;
        c._burn = { dps: Math.max(z.dps * 0.4, c._burn?.dps || 0), until: g.state.time + 2, by: z.by };
        if (c.hp <= 0) { c._killedBy = z.by; }
      } else if (z.kind === 'crater') {
        c._chill = { k: Math.max(z.slow, c._chill?.k || 0), until: g.state.time + 0.6 };
        c._brand = { until: g.state.time + 0.6, mult: z.mult };   // the broken ground leaves them open
      } else if (z.kind === 'hallow') {
        if (UNDEAD.has(c.t)) { c.hp = (c.hp ?? 1) - z.dps * step * 2; c._hurtFlash = 0.2; }
      }
    }
  }
  g.hazards = list.filter(z => z.life > 0);
}

export const UNDEAD = new Set(['skeleton', 'skeleton_archer', 'zombie', 'ghost', 'lich', 'bone_conductor', 'marrow_knight', 'drowned_king', 'sunken_choirboy', 'hollow_crown']);
