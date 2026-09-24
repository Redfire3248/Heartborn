/*
 * What lives in the water.
 *
 * The sea used to throw pirate ships at you, which is a different game. Now the danger is the sea itself: eighteen
 * creatures that each move and fight their own way. Some run you down, some circle, some spit from a distance, some
 * dive and come up underneath you, and a few travel in packs. They rise more often the further out you sail and the
 * longer you stay, and every one of them is worth something when it goes down.
 */
import { TILE } from '../core/constants.js';
import { clamp, chance } from '../core/rng.js';

/*
 * kind: how it fights.
 *   chase   - straight at you and bites
 *   circle  - keeps its distance and wears you down
 *   ranged  - spits from far off
 *   diver   - vanishes, then surfaces under you
 *   swarm   - small, fast, and never alone
 *   brute   - slow, enormous, and rams
 * tier: how far out you must be before it shows up at all.
 */
export const SEA_MONSTERS = {
  shark:          { name: 'Shark', sprite: 'sea/shark', hull: 40, speed: 3.2, dmg: 9, kind: 'chase', size: 1.1, tier: 0, gold: 12 },
  piranha_swarm:  { name: 'Piranhas', sprite: 'sea/piranha_swarm', hull: 22, speed: 3.8, dmg: 5, kind: 'swarm', size: 0.9, tier: 0, gold: 8, pack: 4 },
  stingray:       { name: 'Stingray', sprite: 'sea/stingray', hull: 34, speed: 2.6, dmg: 8, kind: 'circle', size: 1, tier: 0, gold: 10 },
  jellyfish:      { name: 'Jellyfish', sprite: 'sea/jellyfish', hull: 26, speed: 1.4, dmg: 7, kind: 'circle', size: 0.9, tier: 0, gold: 9, sting: true },
  hammerhead:     { name: 'Hammerhead', sprite: 'sea/hammerhead', hull: 60, speed: 3.4, dmg: 12, kind: 'chase', size: 1.2, tier: 1, gold: 18 },
  armoured_crab:  { name: 'Armoured Crab', sprite: 'sea/armoured_crab', hull: 95, speed: 1.6, dmg: 14, kind: 'brute', size: 1.2, tier: 1, gold: 22, armor: 0.35 },
  deep_eel:       { name: 'Deep Eel', sprite: 'sea/deep_eel', hull: 52, speed: 3.6, dmg: 11, kind: 'diver', size: 1.1, tier: 1, gold: 20 },
  anglerfish:     { name: 'Anglerfish', sprite: 'sea/anglerfish', hull: 70, speed: 2.2, dmg: 13, kind: 'diver', size: 1.2, tier: 2, gold: 26 },
  drowned_sailor: { name: 'Drowned Sailor', sprite: 'sea/drowned_sailor', hull: 64, speed: 2.4, dmg: 12, kind: 'chase', size: 1.1, tier: 2, gold: 24 },
  siren:          { name: 'Siren', sprite: 'sea/siren', hull: 58, speed: 2.8, dmg: 10, kind: 'ranged', size: 1.1, tier: 2, gold: 30, shot: 'effects/magic_orb', shotSpeed: 8 },
  lantern_ghost:  { name: 'Lantern Ghost', sprite: 'sea/lantern_ghost', hull: 46, speed: 2.6, dmg: 11, kind: 'diver', size: 1.1, tier: 2, gold: 28 },
  spiked_turtle:  { name: 'Spiked Turtle', sprite: 'sea/spiked_turtle', hull: 150, speed: 1.4, dmg: 16, kind: 'brute', size: 1.5, tier: 3, gold: 40, armor: 0.45 },
  lobster_horror: { name: 'Lobster Horror', sprite: 'sea/lobster_horror', hull: 120, speed: 2.2, dmg: 17, kind: 'chase', size: 1.3, tier: 3, gold: 38, armor: 0.2 },
  coral_golem:    { name: 'Coral Golem', sprite: 'sea/coral_golem', hull: 180, speed: 1.5, dmg: 20, kind: 'brute', size: 1.5, tier: 3, gold: 50, armor: 0.4 },
  sea_serpent:    { name: 'Sea Serpent', sprite: 'sea/sea_serpent', hull: 160, speed: 3.4, dmg: 19, kind: 'circle', size: 1.5, tier: 4, gold: 60 },
  giant_squid:    { name: 'Giant Squid', sprite: 'sea/giant_squid', hull: 200, speed: 2.6, dmg: 22, kind: 'ranged', size: 1.6, tier: 4, gold: 70, shot: 'effects/poison_spit', shotSpeed: 7 },
  leviathan:      { name: 'Leviathan', sprite: 'sea/leviathan', hull: 380, speed: 2.4, dmg: 28, kind: 'brute', size: 2.1, tier: 5, gold: 140, armor: 0.3, boss: true },
  kraken:         { name: 'The Kraken', sprite: 'sea/kraken', hull: 520, speed: 2.2, dmg: 34, kind: 'ranged', size: 2.4, tier: 5, gold: 220, armor: 0.25, boss: true, shot: 'effects/poison_spit', shotSpeed: 8, shots: 3 },
};

export const MONSTER_KEYS = Object.keys(SEA_MONSTERS);

/** How rough the water is where you are: 0 near your own shore, up to 5 far out on the Open Sea. */
export function seaTier(g, s) {
  const base = s.arena ? 2 : 0;                       // the Open Sea is deeper water to begin with
  const byTime = Math.min(3, Math.floor(s.time / 70));   // and it gets worse the longer you stay out
  return Math.min(5, base + byTime + Math.min(1, Math.floor((g.state.era || 0) / 3)));
}

/** One monster that belongs in water this rough (never something from far deeper). */
export function pickMonster(tier) {
  const pool = MONSTER_KEYS.filter(k => SEA_MONSTERS[k].tier <= tier);
  const deep = pool.filter(k => SEA_MONSTERS[k].tier >= tier - 1);
  const from = deep.length && chance(0.65) ? deep : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** Puts one in the water a little way off, in a direction with room to swim. */
export function spawnMonster(g, s, key, waterAt) {
  const def = SEA_MONSTERS[key];
  if (!def) return null;
  const a0 = Math.random() * Math.PI * 2;
  for (let k = 0; k < 16; k++) {
    const a = a0 + (k / 16) * Math.PI * 2;
    for (let r = 9; r < 18; r++) {
      const x = s.x + Math.cos(a) * r * TILE, y = s.y + Math.sin(a) * r * TILE;
      if (!waterAt(x, y)) continue;
      const m = {
        id: `m${Math.random().toString(36).slice(2, 8)}`, t: key, x, y, angle: a + Math.PI,
        hull: def.hull, max: def.hull, reload: 1 + Math.random() * 2, dive: 0, t0: 0,
      };
      s.monsters.push(m);
      if (def.boss) g.announce?.(`${def.name} rises from the deep!`);
      return m;
    }
  }
  return null;
}

/**
 * Moves and fights every monster for one frame. `hit(dmg)` is called when one reaches your hull, and `shoot`
 * puts a spit in the water. Kept apart from the boat code so the sea can be tested on its own.
 */
export function updateMonsters(g, s, dt, { waterAt, hit, shoot }) {
  for (const m of s.monsters) {
    const def = SEA_MONSTERS[m.t];
    if (!def) continue;
    m.t0 += dt;
    const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy) || 1;
    const toYou = Math.atan2(dy, dx);
    let want = toYou;
    let sp = def.speed * TILE;

    if (def.kind === 'circle') {
      want = toYou + (d < TILE * 5 ? Math.PI * 0.5 : d > TILE * 9 ? 0 : Math.PI * 0.35);
    } else if (def.kind === 'ranged') {
      want = d < TILE * 7 ? toYou + Math.PI : toYou;      // keeps its distance and spits
      sp *= 0.8;
    } else if (def.kind === 'diver') {
      // it goes under, crosses the water unseen, and comes up beside you
      m.dive -= dt;
      if (m.dive <= 0 && d < TILE * 12) { m.dive = 2.6; m.under = true; }
      if (m.under) {
        sp *= 2.2;
        if (m.dive < 1.2) { m.under = false; g.puff?.({ x: m.x, y: m.y }, 'boats/big_splash', 4, 14); }
      }
    } else if (def.kind === 'swarm') {
      want = toYou + Math.sin(m.t0 * 4 + m.x) * 0.5;       // darts about instead of running straight
    }

    const diff = Math.atan2(Math.sin(want - m.angle), Math.cos(want - m.angle));
    m.angle += clamp(diff, -dt * 2, dt * 2);
    const nx = m.x + Math.cos(m.angle) * sp * dt, ny = m.y + Math.sin(m.angle) * sp * dt;
    if (waterAt(nx, ny)) { m.x = nx; m.y = ny; } else m.angle += dt * 3;

    m.reload -= dt;
    if (def.kind === 'ranged' && m.reload <= 0 && d < TILE * 11) {
      m.reload = 2.4 + Math.random();
      for (let i = 0; i < (def.shots || 1); i++) {
        const a = toYou + (i - ((def.shots || 1) - 1) / 2) * 0.16 + (Math.random() - 0.5) * 0.1;
        shoot(m, a, def);
      }
    } else if (def.kind !== 'ranged' && m.reload <= 0 && d < TILE * (1.1 + def.size * 0.6) && !m.under) {
      m.reload = def.kind === 'brute' ? 2.2 : 1.2;
      hit(def.dmg, m);
      g.puff?.({ x: m.x, y: m.y }, 'boats/big_splash', 5, 16);
      g.spark?.(s.x, s.y, '#ff6b5b', 10, { speed: 110 });
    }
    if (def.sting && d < TILE * 2 && m.reload > 0.9) m.reload -= dt * 0.5;   // a jellyfish stings anything that lingers
  }
}

/** A blow lands on a monster. Returns true when it goes down. */
export function damageMonster(g, s, m, dmg) {
  const def = SEA_MONSTERS[m.t];
  if (!def) return false;
  m.hull -= dmg * (1 - (def.armor || 0));
  m.flash = 0.2;
  g.spark?.(m.x, m.y, def.boss ? '#ff6b5b' : '#9fd4ff', def.boss ? 14 : 7, { speed: 110 });
  if (m.hull > 0) return false;
  s.monsters = s.monsters.filter(x => x !== m);
  s.sunk = (s.sunk || 0) + 1;
  g.puff?.({ x: m.x, y: m.y }, 'boats/big_splash', 10, 26);
  g.spark?.(m.x, m.y, '#ffd76a', def.boss ? 30 : 14, { speed: 150, life: 0.7 });
  s.loot.push({ x: m.x, y: m.y, gold: def.gold + Math.floor(Math.random() * def.gold), life: 60, boss: !!def.boss });
  g.float?.(m.x, m.y - TILE, `${def.name} slain!`, def.boss ? '#ff6b5b' : '#ffd76a');
  if (def.boss) g.announce?.(`${def.name} sinks beneath the waves`);
  return true;
}
