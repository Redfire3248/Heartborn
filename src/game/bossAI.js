/*
 * Bosses fight like a player instead of shuffling at you.
 *
 * They run about as fast as you, circle and strafe to find an opening, dash in, swing combos (every swing flashes the
 * red ! first, so each one can be dodged, blocked or parried), roll out of the way of your swings, raise a guard
 * when you keep hitting them (hit it enough and the guard breaks), and leap at you from range, landing where the red
 * circle shows. Below half health they become ENRAGED: faster, with longer combos and shorter rests.
 *
 * Every attack has a recovery afterwards: that is your window to hit back.
 */
import { TILE, WALK_SPEED } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';
import { special, step, strikeVillager, maxHp } from './creatures.js';

const rnd = (a, b) => a + Math.random() * (b - a);

/** Runs the boss for this frame. Returns true when it handled the boss (false: nobody to fight, use the normal AI). */
export function fightBoss(g, c, def, dt) {
  const hero = g.hero && g.state.villagers.find(v => v.id === g.hero.id && !v.away);
  if (!hero || (g.hero.buffs?.invis || 0) > g.state.time) return false;
  const d = Math.hypot(hero.x - c.x, hero.y - c.y);
  const ai = (c._ai ||= { act: null, cd: 1, dodgeCd: 2, guardCd: 3, leapCd: 5, dashCd: 2, hits: [], strafe: Math.random() < 0.5 ? 1 : -1 });
  if (!ai.engaged && d > TILE * 12) return false;
  ai.engaged = true;
  if (d > TILE * 22) { ai.engaged = false; ai.act = null; return false; }

  // below half health: enraged, once
  const hpK = (c.hp ?? maxHp(c)) / maxHp(c);
  if (!c._enraged && hpK < 0.5) {
    c._enraged = true;
    ai.act = { kind: 'roar', t: 0.7 };
    g.float(c.x, c.y - def.size * TILE - 6, 'ENRAGED!', '#ff5a3a');
    g.fx.shake = Math.max(g.fx.shake, 2);
  }
  const rage = c._enraged ? 1 : 0;
  const run = Math.max(def.speed * 2.4, WALK_SPEED * 1.75) * (1 + rage * 0.2) * (c._chill ? c._chill.k : 1);
  for (const k of ['cd', 'dodgeCd', 'guardCd', 'leapCd', 'dashCd']) ai[k] -= dt * (1 + rage * 0.4);
  if (c._guard > 0) c._guard -= dt;
  if (c._iframes > 0) c._iframes -= dt;
  if (c._attack) c._attack = Math.max(0, c._attack - dt);
  c._flip = hero.x < c.x;

  if (ai.act) { doAct(g, c, def, hero, ai, dt, run, rage); return true; }

  // react to your swing: roll away from it
  const h = g.hero;
  if (ai.dodgeCd <= 0 && d < TILE * 2.4 && h.atkAnim && h.atkAnim.t < 0.08 && Math.random() < 0.35 + rage * 0.2) {
    const away = Math.atan2(c.y - hero.y, c.x - hero.x) + (Math.random() < 0.5 ? 1 : -1) * rnd(0.6, 1.3);
    ai.act = { kind: 'roll', t: 0.24, dx: Math.cos(away), dy: Math.sin(away) };
    c._iframes = 0.28;
    ai.dodgeCd = rnd(2.2, 3.5);
    return true;
  }

  // the moves it already had: summons, ground slams, ranged shots
  if (d > TILE * 2.6 && special(g, c, { ...def, ranged: def.ranged && { ...def.ranged, min: 0 } }, hero, dt)) return true;
  if (def.summons && special(g, c, { summons: def.summons, speed: def.speed }, hero, dt)) return true;

  // dragon fire: the ground where you stand glows first, then it burns
  if (def.breath && d < TILE * 7) {
    ai.breathCd = (ai.breathCd ?? 2) - dt * (1 + rage * 0.4);
    if (ai.breathCd <= 0) {
      ai.breathCd = def.breath.every;
      const delay = 0.8 - rage * 0.15;
      (g.aoes ||= []).push({ x: hero.x, y: hero.y, r: TILE * def.breath.radius, t: 0, delay, dmg: def.breath.damage * power(c), from: c });
      g.puff({ x: hero.x, y: hero.y }, 'effects/flame', 10, TILE * def.breath.radius * 0.8);
      ai.act = { kind: 'recover', t: delay };
      c._windup = delay;
      return true;
    }
  }
  // leap at you from range: the landing spot is marked first
  if (ai.leapCd <= 0 && d > TILE * 3 && d < TILE * 9) {
    const delay = 0.85 - rage * 0.15;
    ai.act = { kind: 'leap', t: delay, max: delay, fx: c.x, fy: c.y, tx: hero.x, ty: hero.y };
    (g.aoes ||= []).push({ x: hero.x, y: hero.y, r: TILE * 1.6, t: 0, delay, dmg: def.damage * 1.3 * power(c), from: c });
    ai.leapCd = rnd(7, 10);
    c._windup = delay;
    return true;
  }
  // close the gap in a burst, then strike at once
  if (ai.dashCd <= 0 && d > TILE * 2.5 && d < TILE * 6.5) {
    ai.act = { kind: 'dashWind', t: 0.28 - rage * 0.08 };
    c._windup = ai.act.t;
    ai.dashCd = rnd(3, 5);
    return true;
  }
  // in reach: a combo
  if (d < TILE * 1.9 && ai.cd <= 0) {
    ai.act = { kind: 'combo', left: Math.floor(rnd(2, 4)) + rage, phase: 'wind', t: swingWind(rage) };
    c._windup = ai.act.t;
    return true;
  }
  // otherwise move like a fighter: come in, then circle at the edge of reach looking for an opening
  if (d > TILE * 3) {
    const a = Math.atan2(hero.y - c.y, hero.x - c.x) + ai.strafe * 0.35;
    step(g, c, c.x + Math.cos(a) * TILE * 3, c.y + Math.sin(a) * TILE * 3, run * dt, def);
  } else if (ai.cd > 0) {
    if (Math.random() < dt * 0.6) ai.strafe *= -1;
    const a = Math.atan2(c.y - hero.y, c.x - hero.x) + ai.strafe * 0.9;
    const want = TILE * 2.4;
    step(g, c, hero.x + Math.cos(a) * want, hero.y + Math.sin(a) * want, run * 0.8 * dt, def);
    if (!c._walking) ai.strafe *= -1;
  } else {
    step(g, c, hero.x, hero.y, run * dt, def);
  }
  return true;
}

const swingWind = rage => (rage ? 0.26 : 0.36);
const power = c => (c.scale || 1) * (c.dmgMult || 1) * (c._enraged ? 1.15 : 1);

function doAct(g, c, def, hero, ai, dt, run, rage) {
  const a = ai.act;
  a.t -= dt;
  switch (a.kind) {
    case 'roar':
      c._attack = 0.3;
      if (a.t <= 0) { ai.act = null; ai.cd = 0; }
      return;
    case 'roll': {
      const sp = TILE * 11 * dt;
      step(g, c, c.x + a.dx * sp * 4, c.y + a.dy * sp * 4, sp, { ...def, speed: 1 });
      if (Math.random() < dt * 30) g.anim('combat/dust', c.x, c.y, { size: 16, dur: 0.25 });
      if (a.t <= 0) { ai.act = null; ai.cd = Math.min(ai.cd, 0.2); }   // out of a roll it often comes straight back in
      return;
    }
    case 'leap': {
      const k = 1 - Math.max(0, a.t) / a.max;
      c.x = a.fx + (a.tx - a.fx) * k; c.y = a.fy + (a.ty - a.fy) * k;
      c._hop = Math.sin(k * Math.PI) * TILE * 2.2;
      c._windup = Math.max(0, a.t);
      if (a.t <= 0) { c._hop = 0; ai.act = { kind: 'recover', t: 0.7 - rage * 0.2 }; }
      return;
    }
    case 'dashWind':
      c._windup = Math.max(0, a.t);
      if (a.t <= 0) {
        const ang = Math.atan2(hero.y - c.y, hero.x - c.x);
        ai.act = { kind: 'dash', t: 0.35, dx: Math.cos(ang), dy: Math.sin(ang) };
      }
      return;
    case 'dash': {
      const sp = TILE * 14 * dt;
      step(g, c, c.x + a.dx * TILE * 4, c.y + a.dy * TILE * 4, sp, { ...def, speed: 1 });
      if (Math.random() < dt * 30) g.anim('combat/dust', c.x - a.dx * 10, c.y, { size: 18, dur: 0.3 });
      if (Math.hypot(hero.x - c.x, hero.y - c.y) < TILE * 1.3 || a.t <= 0 || !c._walking) {
        ai.act = { kind: 'combo', left: 1 + rage, phase: 'wind', t: 0.14 };
        c._windup = 0.14;
      }
      return;
    }
    case 'combo':
      if (a.phase === 'wind') {
        c._windup = Math.max(0, a.t);
        // it tracks you while winding up, but only slowly
        if (Math.hypot(hero.x - c.x, hero.y - c.y) > TILE * 1.2) step(g, c, hero.x, hero.y, run * 0.35 * dt, def);
        if (a.t > 0) return;
        // the swing: a lunge, and a hit if you are still in front of it
        const ang = Math.atan2(hero.y - c.y, hero.x - c.x);
        step(g, c, c.x + Math.cos(ang) * TILE, c.y + Math.sin(ang) * TILE, TILE * 0.5, { ...def, speed: 1 });
        c._attack = 0.22;
        g.anim('combat/slash', c.x + Math.cos(ang) * TILE * 0.8, c.y - 8 + Math.sin(ang) * TILE * 0.6, { size: def.size * TILE * 1.1, dur: 0.2, rot: ang });
        if (Math.hypot(hero.x - c.x, hero.y - c.y) < TILE * (1.35 + def.size * 0.25)) strikeVillager(g, c, hero, def.damage * (a.left === 1 ? 1.25 : 0.8) * power(c));
        a.left--;
        if (c._stunned > 0) { ai.act = null; return; }   // parried: the combo is broken
        if (a.left <= 0) { ai.act = { kind: 'recover', t: 0.75 - rage * 0.25 }; return; }
        a.phase = 'gap'; a.t = 0.16;
        return;
      }
      if (a.t <= 0) { a.phase = 'wind'; a.t = swingWind(rage) * 0.8; c._windup = a.t; }
      return;
    case 'recover':   // the opening: it is catching its breath
      c._windup = 0;
      if (a.t <= 0) { ai.act = null; ai.cd = rnd(0.8, 1.6) - rage * 0.4; }
      return;
    default:
      ai.act = null;
  }
}

/**
 * The boss reacts to being hit: a roll dodges it outright, a raised guard takes most of it, and when you keep landing
 * blows it raises its guard. Returns the damage that gets through.
 */
export function bossTakesHit(g, c, dmg, by) {
  const def = CREATURES[c.t];
  if (!def?.boss || !c._ai) return dmg;
  const now = g.state.time;
  if (c._iframes > 0) { g.float(c.x, c.y - def.size * TILE, 'Dodged!', '#9fd4ff'); return 0; }
  if (c._guard > 0) {
    c._guardHits = (c._guardHits || 0) + 1;
    if (c._guardHits >= 4) {   // hit a guard enough and it breaks wide open
      c._guard = 0; c._guardHits = 0;
      c._stunned = 1.4; c._ai.act = null;
      g.float(c.x, c.y - def.size * TILE - 4, 'GUARD BROKEN!', '#ffd76a');
      g.fx.shake = Math.max(g.fx.shake, 1.2);
      return dmg * 1.5;
    }
    g.anim('combat/parry', c.x, c.y - def.size * TILE * 0.5, { size: 30, dur: 0.2 });
    g.float(c.x, c.y - def.size * TILE, 'Blocked', '#c8d0e0');
    return dmg * 0.2;
  }
  const ai = c._ai;
  ai.hits = ai.hits.filter(t => now - t < 1.6);
  ai.hits.push(now);
  if (ai.hits.length >= 3 && ai.guardCd <= 0 && !(c._stunned > 0) && by && g.hero?.id === by.id) {
    c._guard = 1.1; c._guardHits = 0; ai.hits = []; ai.guardCd = rnd(5, 7);
    ai.act = { kind: 'recover', t: 0.5 };   // it stands its ground behind the guard, then answers
    ai.cd = 0;
  }
  return dmg;
}
