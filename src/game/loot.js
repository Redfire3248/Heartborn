/*
 * Loot you can see: what you mine, chop and slay pops out as little items that bounce on the ground and fly to you
 * when you are close (like Minecraft). Every drop rolls the dice: rich veins, lucky drops, bird's nests and amber.
 * Your Loot Luck (from your level and lucky trinkets) makes the good rolls more likely.
 */
import { TILE } from '../core/constants.js';
import { rpgOf } from './rpg.js';

/** Extra chance on every lucky roll: +0.4% per level, plus a lucky trinket's bonus (0 .. 0.6). */
export const luckOf = g => {
  const r = g.state.rpg;
  if (!r) return 0;
  return Math.min(0.6, (r.level || 1) * 0.004 + (r.gear?.trinket?.bonus?.luck || 0));
};

/** A lucky roll: the base chance, raised by your luck. */
export const lucky = (g, p) => Math.random() < p * (1 + luckOf(g) * 2);

/** Which resource each ore gives (for monster drops of the local ore). */
export const ORE_RESOURCE = {
  coal_ore: 'coal', iron_ore: 'iron', gold_ore: 'gold', gem_ore: 'gems', crystal_cluster: 'gems', ruby_ore: 'gems', amethyst_ore: 'gems',
  copper_ore: 'copper', silver_ore: 'silver', obsidian_ore: 'obsidian', mythril_ore: 'mythril', frostite_ore: 'frostite', magmite_ore: 'magmite',
  jade_ore: 'jade', cobalt_ore: 'cobalt', moonstone_ore: 'moonstone', titanium_ore: 'titanium', sunstone_ore: 'sunstone', voidstone_ore: 'voidstone',
};

/** Pop some of a resource out of (x, y): it arcs up, bounces and waits to be picked up. */
export function popResource(g, res, count, x, y) {
  count = Math.max(1, Math.round(count));
  const list = (g.state.groundItems ||= []);
  const a = Math.random() * Math.PI * 2, sp = TILE * (0.5 + Math.random() * 0.8);   // lands close by, where your pull reaches
  list.push({
    id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`, res, count,
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 6, vz: 70 + Math.random() * 40,
    pickIn: 0.3, born: g.state.time,
  });
  // a long-forgotten pile disappears after a while so the world does not fill up
  if (list.length > 220) g.state.groundItems = list.filter((it, i) => !it.res || i > list.length - 200);
}

/** Moves popping items for one frame (their little bounce). */
export function updateDrops(g, dt) {
  for (const it of g.state.groundItems || []) {
    if (it.pickIn > 0) it.pickIn -= dt;
    if (it.vz == null) continue;
    it.z += it.vz * dt; it.vz -= 380 * dt;
    const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
    if (g.world?.walkable?.(nx, ny) !== false) { it.x = nx; it.y = ny; }
    if (it.z <= 0) {
      it.z = 0;
      if (Math.abs(it.vz) > 40) { it.vz = -it.vz * 0.35; it.vx *= 0.5; it.vy *= 0.5; }
      else { it.vz = null; it.vx = it.vy = 0; }
    }
  }
}

