import { bossFightStart } from './bossIndex.js';
import { TILE, DAY_LENGTH } from '../core/constants.js';
import { irange } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { killVillager } from './villagers.js';
import { has } from './dynasty.js';
import { payBounty, damageHero, knockOutHero } from './hero.js';
import { onHeroKill } from './rpg.js';
import { toughness } from './body.js';
import { fightBoss, bossTakesHit } from './bossAI.js';

const BIG_KILLS = {
  bandit:        { gold: [3, 8], text: 'A bandit was defeated!' },
  goblin:        { gold: [1, 4] },
  cave_troll:    { gold: [10, 20], gems: [1, 2], text: 'The CAVE TROLL has fallen!' },
  forest_spirit: { influence: [5, 10], karma: -2, text: 'The forest spirit fades… the woods mourn.' },
  skeleton:      { iron: [1, 3] },
  dragon:        { gold: [300, 600], gems: [25, 40], influence: [120, 200], text: 'THE DRAGON IS SLAIN! Legends will be sung!' },
  bear:          { text: 'A great bear was brought down.' },
  ashen_knight:  { gold: [150, 320], gems: [8, 16], influence: [60, 120], text: 'VAREK, THE ASHEN KNIGHT, HAS FALLEN!' },
};

export const maxHp = c => Math.round(CREATURES[c.t].hp * (c.scale || 1) * (c.hpMult || 1) * (c.elite ? 1.8 : 1) * levelMult(c));

// ------------------------------------------------------------------ levels

/**
 * How much tougher a creature is for its level: every level adds a little health and bite.
 * Bosses already grow with the depth they guard, so their levels count for half.
 */
export const levelMult = c => 1 + Math.max(0, (c.lvl || 1) - 1) * (CREATURES[c.t]?.boss ? 0.05 : 0.12);
export const levelDmgMult = c => 1 + Math.max(0, (c.lvl || 1) - 1) * (CREATURES[c.t]?.boss ? 0.03 : 0.07);

/**
 * What level this creature should be. Far from home is rougher, deep floors rougher still,
 * night is worse than day, and everything creeps up as the days pass — so the island grows with you.
 */
export function levelFor(g, c) {
  const def = CREATURES[c.t] || {};
  if (g.dungeon) {   // down in the dark: the floor decides
    const depth = g.dungeon.depth || 1;
    return Math.max(1, Math.round(2 + depth * 2 + (def.boss ? 4 : 0) + (Math.random() < 0.5 ? 0 : 1)));
  }
  const cen = g.state.center || { x: c.x, y: c.y };
  const tiles = Math.hypot(c.x - cen.x, c.y - cen.y) / TILE;
  const days = Math.max(0, Math.floor((g.day || 0) / 6));
  const lvl = 1 + Math.floor(tiles / 14) + days + (g.isNight ? 2 : 0) + (def.boss ? 5 : 0) + (c.elite ? 2 : 0) + (Math.random() < 0.35 ? 1 : 0);
  return Math.max(1, Math.min(99, Math.round(lvl)));
}

/** Gives a creature its level (once), which makes it tougher and hit harder. */
export function setLevel(g, c) {
  if (c.lvl != null) return c.lvl;
  c.lvl = levelFor(g, c);
  c.dmgMult = (c.dmgMult || 1) * levelDmgMult(c);
  return c.lvl;
}

export function updateCreature(g, c, dt) {
  const def = CREATURES[c.t];
  if (!def) { remove(g, c); return; }
  // one in ten hostile beasts is an Elite: bigger, tougher, harder hitting, with better loot
  if (c._eliteRolled == null) {
    c._eliteRolled = true;
    if (def.hostile && !def.boss && !c.bounty && c.t !== 'invader' && Math.random() < 0.1) { c.elite = true; c.scale = (c.scale || 1) * 1.3; c.hp = maxHp(c); }
  }
  setLevel(g, c);   // its level decides how much it can take and how hard it hits
  if (def.hostile && c.wild && !c.raid && !c.attackId && g.inSafeZone?.(c.x, c.y)) {   // wandered too close to home: it turns back
    const cen = g.state.center;
    const a = Math.atan2(c.y - cen.y, c.x - cen.x) || 0;
    const sp = (def.speed || 30) * 1.4 * dt;
    c.x += Math.cos(a) * sp; c.y += Math.sin(a) * sp;
    c._flip = Math.cos(a) < 0;
    c._walking = true;
    c.hunting = null;
    return;
  }
  if (c.hp == null) c.hp = maxHp(c);
  if (c.t === 'invader' && c._archer == null) c._archer = Math.random() < 0.3;
  c._walking = false;
  if (c._hurtFlash) c._hurtFlash = Math.max(0, c._hurtFlash - dt);
  if (c._whiteFlash > 0) c._whiteFlash -= dt;
  if (c._kbx || c._kby) {   // sliding back from a blow (even while stunned)
    const nx = c.x + c._kbx * dt, ny = c.y + c._kby * dt;
    if (CREATURES[c.t]?.flying || g.world.walkable(nx, ny)) { c.x = nx; c.y = ny; } else { c._kbx = -c._kbx * 0.3; c._kby = -c._kby * 0.3; }
    const k = Math.exp(-9 * dt); c._kbx *= k; c._kby *= k;
    if (Math.hypot(c._kbx, c._kby) < 4) c._kbx = c._kby = 0;
  }
  // fire and bleeding keep hurting; kills still count for your hero
  for (const key of ['_burn', '_bleed']) {
    const e = c[key];
    if (!e) continue;
    if (s0(g).time >= e.until) { c[key] = null; continue; }
    const by = g.state.villagers.find(v => v.id === e.by) || null;
    damageCreature(g, c, e.dps * dt, by);
    if (Math.random() < dt * 6) g.fx.particles.push({ x: c.x + (Math.random() - 0.5) * 12, y: c.y - 8 - Math.random() * 10, vx: 0, vy: key === '_burn' ? -18 : 10, sprite: key === '_burn' ? 'effects/flame' : 'effects/raindrop', size: 6, life: 0.5, max: 0.5, rot: 0 });
    if (!g.state.creatures.includes(c)) {
      if (by && g.hero?.id === by.id) { g.hero.kills++; onHeroKill(g, c, by); }
      return;
    }
  }
  if (c._chill && s0(g).time >= c._chill.until) c._chill = null;
  if (c._stunned > 0) { c._stunned -= dt; c._windup = 0; c._hop = 0; c._charging = 0; c._raise = 0; c._spin = 0; if (c._ai) c._ai.act = null; return; }

  const s = g.state;

  // raiders give up after a day and a half; ghosts vanish at dawn
  if (c.raid && !c.fleeing && s.time - (c.born || 0) > DAY_LENGTH * 1.5) c.fleeing = true;
  if (def.night && !g.isNight && Math.random() < dt * 0.2) { g.puff(c, 'effects/ghost_wisp', 3); remove(g, c); return; }
  if (c.nightSpawn && !g.isNight && !c.hunting && Math.random() < dt * 0.08) { g.puff(c, 'effects/ghost_wisp', 3); remove(g, c); return; }   // the night's monsters fade at dawn

  if (def.water) { wander(g, c, dt, def, true); return; }

  // bosses fight like a player (see bossAI.js)
  if (def.boss && !c.fleeing && fightBoss(g, c, def, dt)) return;

  if (c.fleeing) {
    const cen = g.center;
    const away = { x: c.x + (c.x - cen.x), y: c.y + (c.y - cen.y) };
    step(g, c, away.x, away.y, def.speed * 1.2 * dt, def);
    if (Math.hypot(c.x - cen.x, c.y - cen.y) > TILE * 28) remove(g, c);
    return;
  }

  // a boar you hurt turns on you: it charges again and again until it calms down
  if (c.angry > 0) {
    c.angry -= dt;
    const foe = g.state.villagers.find(v => v.id === g.hero?.id) || null;
    if (foe && Math.hypot(foe.x - c.x, foe.y - c.y) < TILE * 14) {
      if (special(g, c, def, foe, dt)) return;
      if (Math.hypot(foe.x - c.x, foe.y - c.y) > TILE * 2.2) { step(g, c, foe.x, foe.y, def.speed * dt, def); return; }
      step(g, c, c.x + (c.x - foe.x), c.y + (c.y - foe.y), def.speed * 0.8 * dt, def);   // back off to charge again
      return;
    }
  }

  if (def.hostile) {
    // a mimic sits still, looking like a chest, until you come close
    if (def.ambush && !c._awake) {
      const near = s.villagers.some(v => !v.away && Math.hypot(v.x - c.x, v.y - c.y) < TILE * def.ambush);
      if (!near) return;
      c._awake = true; c._windup = 0.5; g.float(c.x, c.y - TILE, 'It was a mimic!', '#ff9f7a');
    }
    // wild predators guard a territory; raiders march on the village
    c.hx ??= c.x; c.hy ??= c.y;
    // hungry predators sometimes leave their den to hunt villagers — more often at night
    if (!c.raid && !c.hunting && Math.random() < dt * (g.isNight ? 0.004 : 0.0015)) {
      c.hunting = s.time + DAY_LENGTH * 0.5;
      if (!g.offline) g.log(`A hungry ${c.t.replace('_', ' ')} is hunting near the village!`, 'bad');
    }
    if (c.hunting && s.time > c.hunting) c.hunting = null;
    const hunter = c.raid || c.hunting;
    const aggro = hunter ? TILE * (g.isNight ? 18 : 14) : TILE * (g.isNight ? 9 : 6);
    let target = nearestVillager(g, c, aggro);
    if (target && !hunter && Math.hypot(target.x - c.hx, target.y - c.hy) > TILE * 16) target = null;
    if (!target && c.hunting) {   // prowl toward the village
      const cen = g.center;
      if (Math.hypot(cen.x - c.x, cen.y - c.y) > TILE * 3) { step(g, c, cen.x, cen.y, def.speed * 0.7 * dt, def); return; }
    }
    if (!target && !hunter && Math.hypot(c.x - c.hx, c.y - c.hy) > TILE * 6) {
      step(g, c, c.hx, c.hy, def.speed * 0.5 * dt, def);
      return;
    }
    // dragon fire: every few seconds it burns everyone close to it
    if (def.breath && target && Math.hypot(target.x - c.x, target.y - c.y) < TILE * def.breath.radius * 1.5) {
      c._breath = (c._breath ?? def.breath.every) - dt;
      if (c._breath <= 0) {
        c._breath = def.breath.every;
        c._attack = 0.4;
        g.puff({ x: target.x, y: target.y }, 'effects/flame', 18, TILE * def.breath.radius);
        g.fx.shake = Math.max(g.fx.shake, 1);
        for (const v of [...s.villagers]) {
          if (v.away || Math.hypot(v.x - target.x, v.y - target.y) > TILE * def.breath.radius) continue;
          v.hp -= damageHero(g, v, def.breath.damage * (c.scale || 1) * toughness(v), c);
          v._hurtFlash = 0.3;
          if (v.hp <= 0 && !knockOutHero(g, v)) killVillager(g, v, 'was burned by the dragon');
        }
      }
    }
    if (target && special(g, c, def, target, dt)) return;   // charges, thrown rocks
    if (target) {
      const d = Math.hypot(target.x - c.x, target.y - c.y);
      if (d > TILE * 0.75) {
        step(g, c, target.x, target.y, def.speed * dt, def);
      } else {
        c._flip = target.x < c.x;
        c._cd = (c._cd || 0) - dt;
        // a telegraphed blow: it rears back first, so you can dash out of the way, block or parry
        if (c._cd <= 0 && !c._windup) c._windup = def.boss ? 0.6 : 0.45;
        if (c._windup > 0) {
          c._windup -= dt;
          if (c._windup > 0) { if (c._attack) c._attack = Math.max(0, c._attack - dt); return; }
          c._windup = 0;
        }
        if (c._cd <= 0) {
          c._cd = 1.2;
          c._attack = 0.25;
          let dmg = def.damage * (c.scale || 1) * (c.dmgMult || 1);
          if (g.hero?.id !== target.id) {   // villagers: the village's defences and their own toughness soften it
            dmg /= 1 + g.defense / 50;
            if (target.armed && g.hasBuilding('armory')) dmg *= 0.7;   // shield and mail
            dmg *= toughness(target);   // stamina shrugs off wounds
          }
          if (g.hero?.id === target.id) {
            if (Math.hypot(target.x - c.x, target.y - c.y) > TILE * 1.2) return;   // stepped out of reach during the wind-up
            dmg = damageHero(g, target, dmg, c);
          }
          target.hp -= dmg;
          if (target.hp <= 0 && knockOutHero(g, target)) return;
          if (g.hero?.id !== target.id && dmg > 0) {   // villagers are shoved back by the blow too
            const a = Math.atan2(target.y - c.y, target.x - c.x), push = Math.min(14, 5 + dmg * 0.4);
            if (g.world.walkable(target.x + Math.cos(a) * push, target.y + Math.sin(a) * push)) { target.x += Math.cos(a) * push; target.y += Math.sin(a) * push; }
          }
          if (target.hp > 0 && target.hp < 15 && !has(target, 'scarred') && Math.random() < 0.3) {
            target.traits.push('scarred');
            g.log(`${target.name} barely survived and will carry the scars.`, 'bad');
          }
          target._hurtFlash = 0.25;
          if (target.hp <= 0) {
            killVillager(g, target, `was slain by ${/^[aeiou]/.test(c.t) ? 'an' : 'a'} ${c.t.replace('_', ' ')}`);
            if (c.raid && !def.boss && Math.random() < 0.5) c.fleeing = true;   // sated, it retreats (bosses stay until they are slain)
            if (c.hunting) { c.hunting = null; c.hx = c.x; c.hy = c.y; }   // fed: it settles here for now
          }
        }
      }
      if (c._attack) c._attack = Math.max(0, c._attack - dt);
      return;
    }
    if (c.raid) {
      const cen = g.center;
      const d = Math.hypot(cen.x - c.x, cen.y - c.y);
      if (def.steals && d < TILE * 1.5) { steal(g, c); return; }
      if (d > TILE) { step(g, c, cen.x, cen.y, def.speed * 0.8 * dt, def); return; }
    }
  }

  if (def.flees) {
    const threat = nearestVillager(g, c, TILE * 3);
    if (threat) {
      step(g, c, c.x + (c.x - threat.x), c.y + (c.y - threat.y), def.speed * dt, def);
      return;
    }
  }
  wander(g, c, dt, def, false);
}

// ------------------------------------------------------------------ special attacks

/**
 * Some beasts fight their own way. Boars paw the ground, then charge in a straight line.
 * Goblins keep their distance and throw rocks. Both warn you first (the red !), so you can dodge or guard.
 * Returns true while the special move is running.
 */
export function special(g, c, def, target, dt) {
  const d = Math.hypot(target.x - c.x, target.y - c.y);
  c._specialCd = (c._specialCd ?? 2 + Math.random() * 2) - dt;
  // a charge in progress: rush straight on, hurting the first person in the way
  if (c._charge) {
    const ch = c._charge;
    if (ch.wind > 0) { ch.wind -= dt; c._windup = ch.wind; c._flip = ch.dx < 0; return true; }
    c._windup = 0;
    const sp = def.speed * 3.2 * dt;
    const nx = c.x + ch.dx * sp, ny = c.y + ch.dy * sp;
    ch.t -= dt;
    if (!g.world.walkable(nx, ny) || ch.t <= 0) { c._charge = null; c._stunned = ch.t > 0 ? 1 : 0.3; return true; }   // ran into something: dazed
    c.x = nx; c.y = ny; c._walking = true;
    if (Math.random() < dt * 20) g.anim('combat/dust', c.x - ch.dx * 10, c.y, { size: 18, dur: 0.3 });
    const hit = g.state.villagers.find(v => !v.away && Math.hypot(v.x - c.x, v.y - c.y) < TILE * 0.7);
    if (hit) {
      c._charge = null;
      c._cd = 1.5;
      strikeVillager(g, c, hit, def.damage * 1.6 * (c.scale || 1) * (c.dmgMult || 1));
      return true;
    }
    return true;
  }
  // bosses call helpers now and then
  if (def.summons) {
    c._summonCd = (c._summonCd ?? def.summons.every * 0.5) - dt;
    if (c._summonCd <= 0 && g.state.creatures.length < 60) {
      c._summonCd = def.summons.every;
      for (let i = 0; i < def.summons.count; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = c.x + Math.cos(a) * TILE * 1.5, y = c.y + Math.sin(a) * TILE * 1.5;
        if (!g.world.walkable(x, y)) continue;
        const m = g.spawnCreature(def.summons.type, x, y, { hpMult: c.hpMult ? Math.max(1, c.hpMult * 0.5) : 1, summoned: true });
        if (m) { m._eliteRolled = true; m.hx = c.x; m.hy = c.y; g.anim('combat/poof', x, y - 6, { size: TILE, dur: 0.35 }); }
      }
      g.float(c.x, c.y - TILE * 1.8, 'Calls for help!', '#ff9f7a');
    }
  }
  // an aura: standing next to it hurts
  if (def.aura && d < TILE * def.aura.r) {
    c._auraT = (c._auraT ?? 0) + dt;
    if (c._auraT >= 1) {
      c._auraT = 0;
      strikeVillager(g, c, target, def.damage * def.aura.dmg * (c.dmgMult || 1));
      g.puff({ x: target.x, y: target.y - 10 }, def.aura.sprite || 'effects/toxic_bubble', 3, 10);
    }
  }
  // it stitches itself back together
  if (def.heals) {
    c._healT = (c._healT ?? def.heals.every) - dt;
    if (c._healT <= 0) {
      c._healT = def.heals.every;
      const max = maxHp(c);
      if (c.hp < max) {
        c.hp = Math.min(max, c.hp + max * def.heals.part);
        g.float(c.x, c.y - TILE * 1.6, 'Mends itself', '#8fe07a');
        g.puff({ x: c.x, y: c.y - 10 }, 'effects/plus_heal', 4, 12);
      }
    }
  }
  // a ground slam: a red circle appears where you stand, then it lands
  if (def.slam && d < TILE * def.slam.range) {
    c._slamCd = (c._slamCd ?? def.slam.every * 0.6) - dt;
    if (c._slamCd <= 0) {
      c._slamCd = def.slam.every;
      c._attack = 0.4; c._windup = def.slam.delay;
      (g.aoes ||= []).push({ x: target.x, y: target.y, r: TILE * def.slam.radius, t: 0, delay: def.slam.delay, dmg: def.damage * def.slam.dmg * (c.scale || 1) * (c.dmgMult || 1), from: c });
      return true;
    }
  }
  // ranged attacks: arrows, bolts, knives, webs, spit, fireballs, boulders
  const r = c._archer ? ARCHER : def.ranged;
  if (r) {
    if (c._aim != null) {   // winding up the shot (the red ! shows)
      c._aim -= dt; c._windup = Math.max(0, c._aim); c._flip = target.x < c.x;
      if (c._aim > 0) return true;
      c._aim = null;
      fireShots(g, c, def, r, target);
      return true;
    }
    if (c._shotCd == null) c._shotCd = r.every * (0.4 + Math.random() * 0.6);
    c._shotCd -= dt;
    const inRange = d < TILE * r.range && d > TILE * (r.min ? r.min * 0.6 : 1.3);
    if (c._shotCd <= 0 && inRange && g.world.clearLine(c.x, c.y, target.x, target.y)) {
      c._shotCd = r.every * (0.85 + Math.random() * 0.3);
      c._aim = r.windup ?? 0.45;
      return true;
    }
    // archers keep their distance
    if (r.min && d < TILE * r.min) { step(g, c, c.x + (c.x - target.x), c.y + (c.y - target.y), def.speed * 0.9 * dt, def); return true; }
  }
  // a blink: it vanishes and comes back beside you
  if (def.blink && c._specialCd <= 0 && d > TILE * 2 && d < TILE * def.blink.range) {
    const a = Math.atan2(target.y - c.y, target.x - c.x) + (Math.random() - 0.5);
    const bx = target.x - Math.cos(a) * TILE * 1.6, by = target.y - Math.sin(a) * TILE * 1.6;
    if (g.world.walkable(bx, by)) {
      g.anim('combat/poof', c.x, c.y - 8, { size: TILE * 1.6, dur: 0.35 });
      g.puff({ x: c.x, y: c.y - 8 }, 'effects/ghost_wisp', 5, 12);
      c.x = bx; c.y = by;
      g.anim('combat/poof', c.x, c.y - 8, { size: TILE * 1.6, dur: 0.35 });
      c._specialCd = def.blink.every;
      c._attack = 0.3;
      return true;
    }
  }
  // a burst: shots in every direction at once, so standing close is no safer than standing far
  if (def.burst && c._specialCd <= 0 && d < TILE * def.burst.range) {
    c._specialCd = def.burst.every;
    c._attack = 0.4;
    const kind = SHOTS[def.burst.shot] || SHOTS.magic_bolt;
    const n = def.burst.count || 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      (g.enemyShots ||= []).push({
        kind: def.burst.shot, x: c.x, y: c.y - 10, vx: Math.cos(a) * TILE * kind.speed, vy: Math.sin(a) * TILE * kind.speed,
        left: TILE * (def.burst.range + 2), dmg: def.damage * (def.burst.dmg ?? 0.8) * (c.scale || 1) * (c.dmgMult || 1), from: c, target: null,
      });
    }
    g.float(c.x, c.y - TILE * 1.8, def.burst.text || 'Burst!', '#ffb3aa');
    return true;
  }
  if (c._specialCd > 0) return false;
  // a charge: it paws the ground, then runs right through where you stood
  if (def.charges && d > TILE * 2 && d < TILE * (def.charges.range || 8)) {
    const a = Math.atan2(target.y - c.y, target.x - c.x);
    c._charge = { dx: Math.cos(a), dy: Math.sin(a), wind: def.charges.wind ?? 0.6, t: Math.min(2, d / (def.speed * 3.2) + 0.35) };
    c._specialCd = def.charges.every ?? 5;
    return true;
  }
  if (c.t === 'boar' && d > TILE * 2 && d < TILE * 7) {
    const a = Math.atan2(target.y - c.y, target.x - c.x);
    c._charge = { dx: Math.cos(a), dy: Math.sin(a), wind: 0.7, t: Math.min(1.6, d / (def.speed * 3.2) + 0.3) };   // long enough to run right through where you stood
    c._specialCd = 4 + Math.random() * 2;
    return true;
  }
  return false;
}

/** How each kind of shot flies and what it does when it hits. */
export const SHOTS = {
  arrow:          { speed: 11, size: 0.5 },
  bone_arrow:     { speed: 11, size: 0.5 },
  rock:           { speed: 7, size: 0.35, spin: true },
  throwing_knife: { speed: 13, size: 0.4, spin: true },
  magic_bolt:     { speed: 6.5, size: 0.45, homing: 1.6, glow: '#c08aff' },
  dark_orb:       { speed: 5, size: 0.5, homing: 1.2, glow: '#8a4aff' },
  fireball:       { speed: 7.5, size: 0.55, glow: '#ff8a3a', burn: { dps: 5, secs: 2 } },
  ice_shard:      { speed: 9, size: 0.45, glow: '#9fd4ff', slow: { k: 0.6, secs: 1.5 } },
  poison_spit:    { speed: 6, size: 0.4, glow: '#8fe07a', poison: { dps: 3, secs: 3 } },
  web_ball:       { speed: 6, size: 0.5, slow: { k: 0.45, secs: 2.5 } },
  sonic_wave:     { speed: 8, size: 0.5, glow: '#d8d0ff' },
  boulder:        { speed: 5.5, size: 0.8, spin: true },
};
const ARCHER = { shot: 'arrow', range: 8, min: 3, every: 2.4, dmg: 0.9 };

function fireShots(g, c, def, r, target) {
  const kind = SHOTS[r.shot] || SHOTS.arrow;
  const n = r.count || 1;
  const base = Math.atan2(target.y - c.y, target.x - c.x);
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? (i - (n - 1) / 2) * (r.spread || 0.3) : (Math.random() - 0.5) * 0.12);
    (g.enemyShots ||= []).push({
      kind: r.shot, x: c.x, y: c.y - 10, vx: Math.cos(a) * TILE * kind.speed, vy: Math.sin(a) * TILE * kind.speed,
      left: TILE * (r.range + 2), dmg: def.damage * (r.dmg ?? 1) * (c.scale || 1) * (c.dmgMult || 1), from: c, target: kind.homing ? target : null,
    });
  }
  c._attack = 0.25;
}

/** A blow from a beast to a villager (the person you play can dodge, block or parry it). */
export function strikeVillager(g, c, target, dmg) {
  if (g.hero?.id === target.id) dmg = damageHero(g, target, dmg, c);   // your hero: armour, blocks and parries decide (not the village's walls)
  else dmg = dmg / (1 + g.defense / 50) * toughness(target);
  if (!dmg) return;
  target.hp -= dmg;
  target._hurtFlash = 0.25;
  g.fx.shake = Math.max(g.fx.shake, 0.6);
  if (target.hp <= 0 && !knockOutHero(g, target)) killVillager(g, target, `was slain by ${/^[aeiou]/.test(c.t) ? 'an' : 'a'} ${c.t.replace('_', ' ')}`);
}

/** Shots fly until they hit someone, a wall or run out of range. Slams land after their warning. */
export function updateEnemyShots(g, dt) {
  for (const a of g.aoes || []) {
    a.t += dt;
    if (a.t < a.delay || a.done) continue;
    a.done = true;
    if (a.warn) continue;   // only a warning (a thrust's path): the blow itself comes from the boss
    g.fx.shake = Math.max(g.fx.shake, 1.5);
    g.anim('combat/poof', a.x, a.y - 4, { size: a.r * 2, dur: 0.4 });
    for (const v of [...g.state.villagers]) if (!v.away && Math.hypot(v.x - a.x, v.y - a.y) < a.r && (!g.world.clearLine || g.world.clearLine(a.x, a.y, v.x, v.y))) strikeVillager(g, a.from || { x: a.x, y: a.y - 1, t: 'slam' }, v, a.dmg);
  }
  if (g.aoes?.length) g.aoes = g.aoes.filter(a => a.t < a.delay + 0.35);
  if (!g.enemyShots?.length) return;
  for (const s of g.enemyShots) {
    const kind = SHOTS[s.kind] || SHOTS.rock;
    if (kind.homing && s.target && !s.target.away) {   // magic curves toward you
      const want = Math.atan2(s.target.y - 10 - s.y, s.target.x - s.x), have = Math.atan2(s.vy, s.vx);
      let da = want - have; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const turn = Math.max(-kind.homing * dt, Math.min(kind.homing * dt, da)), sp = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(have + turn) * sp; s.vy = Math.sin(have + turn) * sp;
    }
    const mx = s.vx * dt, my = s.vy * dt;
    s.x += mx; s.y += my; s.left -= Math.hypot(mx, my);
    if (!g.world.walkable(s.x, s.y + 10) && !g.world.isWater(Math.floor(s.x / TILE), Math.floor((s.y + 10) / TILE))) { s.left = 0; g.anim('combat/hit', s.x, s.y, { size: 14, dur: 0.18 }); continue; }   // hits a wall
    const hit = g.state.villagers.find(v => !v.away && Math.hypot(v.x - s.x, v.y - 10 - s.y) < TILE * 0.5);
    if (hit) {
      s.left = 0;
      const hpBefore = hit.hp;
      strikeVillager(g, s.from || { x: s.x - s.vx, y: s.y - s.vy, t: 'goblin' }, hit, s.dmg);
      if (g.hero?.id === hit.id && g.hero.lastParry === g.state.time) {   // parried: it flies back where it came from, twice as hard
        (g.hero.arrows ||= []).push({ kind: s.kind || 'rock', x: s.x, y: s.y, vx: -s.vx * 1.4, vy: -s.vy * 1.4, left: TILE * 12, range: TILE * 12, dmg: s.dmg * 2, crit: true, hitIds: [], sprite: SHOTS[s.kind]?.spin ? 'nature/rock' : null });
        g.float(hit.x, hit.y - TILE * 1.9, 'Reflected!', '#9fe0ff');
        continue;
      }
      g.anim('combat/hit', s.x, s.y, { size: 18, dur: 0.2 });
      const h = g.hero;
      if (h && h.id === hit.id && hit.hp < hpBefore) {   // what the shot leaves behind: webs slow you, poison and fire keep hurting
        const now = g.state.time;
        if (kind.slow) { h.slow = { k: kind.slow.k, until: now + kind.slow.secs }; g.float(hit.x, hit.y - TILE * 1.4, s.kind === 'web_ball' ? 'Webbed!' : 'Chilled!', '#d8e8ff'); }
        if (kind.poison) { h.dot = { dps: kind.poison.dps, until: now + kind.poison.secs, color: '#8fe07a' }; g.float(hit.x, hit.y - TILE * 1.4, 'Poisoned!', '#8fe07a'); }
        if (kind.burn) { h.dot = { dps: kind.burn.dps, until: now + kind.burn.secs, color: '#ff8a3a' }; g.float(hit.x, hit.y - TILE * 1.4, 'Burning!', '#ff8a3a'); }
      }
    }
  }
  g.enemyShots = g.enemyShots.filter(s => s.left > 0);
}

/*
 * Lock-on is a mode, not a single grab. Turn it on and it stays on - through kills, through a target running
 * off, into and out of dungeons, even across a reload - until you turn it off yourself. While it is on it always
 * holds the nearest hostile: when one dies it moves straight to the next, and when another comes clearly closer
 * than the one you have (a full tile nearer, so two beasts side by side do not make it flicker) it swaps to that.
 */
const LOCK_RANGE = TILE * 11, LOCK_KEEP = TILE * 16;
let lockMode = (() => { try { return localStorage.getItem('hb-lock') === '1'; } catch { return false; } })();
export const lockModeOn = () => lockMode;

function nearestFoe(g, v) {
  let best = null, bd = LOCK_RANGE;
  for (const c of g.state.creatures) {
    if (!CREATURES[c.t]?.hostile || (c.hp ?? 1) <= 0) continue;   // a fresh beast has hp null until it is hit
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** Turns lock-on mode on or off. Returns whether it is now on. */
export function toggleLockOn(g) {
  lockMode = !lockMode;
  try { localStorage.setItem('hb-lock', lockMode ? '1' : '0'); } catch { /* private window */ }
  g.lockOn = null;
  if (lockMode) updateLockOn(g);
  return lockMode;
}

/** Every frame: while the mode is on, hold the nearest hostile. The mode itself only ever changes by your hand. */
export function updateLockOn(g) {
  const v = g.state.villagers.find(x => x.id === g.hero?.id);
  if (!lockMode || !v) { g.lockOn = null; return; }
  const cur = g.lockOn;
  const dist = c => Math.hypot(c.x - v.x, c.y - v.y);
  const keep = cur && g.state.creatures.includes(cur) && (cur.hp ?? 1) > 0 && dist(cur) <= LOCK_KEEP;
  const best = nearestFoe(g, v);
  if (!keep) g.lockOn = best;
  else if (best && best !== cur && dist(best) < dist(cur) - TILE) g.lockOn = best;
}

export function damageCreature(g, c, dmg, by) {
  const def = CREATURES[c.t];
  if (c._brand && c._brand.until > g.state.time) dmg *= c._brand.mult;   // marked: everything hurts it more
  if (c._frozen && c._frozen > g.state.time) {   // frozen solid: the blow that lands shatters it
    dmg *= 3;
    c._frozen = 0;
    g.float(c.x, c.y - TILE * 1.4, 'SHATTER!', '#9fd4ff');
    g.puff({ x: c.x, y: c.y - 10 }, 'effects/ice_crystal', 8, 14);
  }
  if (c.net) {   // the host runs this one: send the blow, and show it landing here straight away
    c._hurtFlash = 0.25;
    c._lastDmg = dmg;
    g.mp?.sendMobHit?.(c.netId, dmg);
    return;
  }
  if (c.hp == null) c.hp = maxHp(c);
  // armoured beasts shrug off most blows from people; a real weapon cuts through better
  const heroArmed = by && g.hero?.id === by.id && g.state.rpg?.gear?.weapon;
  if (def.armor && by) dmg *= by.armed || heroArmed || by.inv?.pack?.sword || by.inv?.pack?.spear ? 1 - def.armor * 0.6 : 1 - def.armor;
  if (def.boss) {
    if (by && g.hero?.id === by.id) bossFightStart(g, c);   // the Index starts its clock on your first blow
    dmg = bossTakesHit(g, c, dmg, by);   // rolls, guards
  }
  c._lastDmg = dmg;
  if (!dmg) return;
  c.hp -= dmg;
  c._hurtFlash = 0.25;
  if (c.t === 'boar' && c.hp > 0) { c.angry = 25; c._specialCd = Math.min(c._specialCd ?? 1, 1.2); }
  if (c.hp > 0) return;
  remove(g, c);
  if (c.bounty) payBounty(g, c, by);
  if (by) by.kills = (by.kills || 0) + 1;
  const battle = c.attackId && g.state.battles?.[c.attackId];
  if (battle) battle.killed = (battle.killed || 0) + 1;
  g.anim('combat/poof', c.x, c.y - 8, { size: def.size * TILE * 1.3, dur: 0.4 });
  if (c.t === 'slime' && !c.tiny) {   // a slime splits into two little ones
    for (const side of [-1, 1]) {
      const s = g.spawnCreature('slime', c.x + side * 10, c.y, { tiny: true, _eliteRolled: true, scale: (c.scale || 1) * 0.6, hx: c.x, hy: c.y });
      if (s) { s.hp = null; s._kbx = side * TILE * 5; s._kby = -TILE; }
    }
  }
  const reward = BIG_KILLS[c.t];
  const parts = [];
  if (def.food && !def.hostile) parts.push(`+${g.addResource('food', irange(...def.food))} food`);
  if (reward) {
    for (const res of ['gold', 'gems', 'iron', 'influence']) {
      if (reward[res]) parts.push(`+${g.addResource(res, irange(...reward[res]))} ${res}`);
    }
    if (reward.karma) g.addKarma(reward.karma);
    if (reward.text) g.log(`${by ? by.name + ': ' : ''}${reward.text}`, 'good');
  }
  if (parts.length) g.float(c.x, c.y - TILE, parts.join(' '), '#ffd76a');
}

function steal(g, c) {
  const r = g.state.resources;
  const food = Math.floor(r.food * 0.15), gold = Math.floor(r.gold * 0.2);
  r.food -= food; r.gold -= gold;
  const battle = c.attackId && g.state.battles?.[c.attackId];
  if (battle) {
    battle.loot.food = (battle.loot.food || 0) + food;
    battle.loot.gold = (battle.loot.gold || 0) + gold;
  }
  g.log(`A ${c.t} stole ${food} food and ${gold} gold!`, 'bad');
  g.float(c.x, c.y - TILE, `-${food} food -${gold} gold`, '#ff7a6a');
  c.fleeing = true;
}

function remove(g, c) {
  g.state.creatures = g.state.creatures.filter(x => x !== c);
  if (g.selected?.ref === c) g.selected = null;
}

function nearestVillager(g, c, range) {
  let best = null, bd = range;
  for (const v of g.state.villagers) {
    if (v.away) continue;
    if (g.hero?.id === v.id && ((g.hero.buffs?.invis || 0) > g.state.time || g.hero.inHouse)) continue;   // invisible, or safe at home
    const d = Math.hypot(v.x - c.x, v.y - c.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

const s0 = g => g.state;

export function step(g, c, tx, ty, dist, def) {
  if (c._chill) dist *= c._chill.k;   // chilled: half speed
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d < 1) return;
  const mx = (dx / d) * Math.min(dist, d), my = (dy / d) * Math.min(dist, d);
  const ok = (x, y) => def.flying || (def.water ? isWaterAt(g, x, y) : g.world.walkable(x, y));
  if (ok(c.x + mx, c.y + my)) { c.x += mx; c.y += my; }
  else if (ok(c.x + mx, c.y)) c.x += mx;
  else if (ok(c.x, c.y + my)) c.y += my;
  else return;
  c._walking = true;
  if (Math.abs(mx) > 0.05) c._flip = mx < 0;
}

function wander(g, c, dt, def, water) {
  if (!c._wander || c._wander.t <= 0) {
    const a = Math.random() * Math.PI * 2;
    const r = TILE * (1 + Math.random() * 4);
    c._wander = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, t: 2 + Math.random() * 4, pause: Math.random() < 0.5 };
  }
  c._wander.t -= dt;
  if (c._wander.pause) return;
  step(g, c, c._wander.x, c._wander.y, def.speed * 0.35 * dt, { ...def, water });
}

function isWaterAt(g, x, y) {
  return g.world.isWater(Math.floor(x / TILE), Math.floor(y / TILE));
}
