import { TILE, DAY_LENGTH } from '../core/constants.js';
import { irange } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { killVillager } from './villagers.js';
import { has } from './dynasty.js';
import { payBounty, damageHero, knockOutHero } from './hero.js';
import { toughness } from './body.js';

const BIG_KILLS = {
  bandit:        { gold: [3, 8], text: 'A bandit was defeated!' },
  goblin:        { gold: [1, 4] },
  cave_troll:    { gold: [10, 20], gems: [1, 2], text: 'The CAVE TROLL has fallen!' },
  forest_spirit: { influence: [5, 10], karma: -2, text: 'The forest spirit fades… the woods mourn.' },
  skeleton:      { iron: [1, 3] },
  dragon:        { gold: [300, 600], gems: [25, 40], influence: [120, 200], text: 'THE DRAGON IS SLAIN! Legends will be sung!' },
  bear:          { text: 'A great bear was brought down.' },
};

export const maxHp = c => Math.round(CREATURES[c.t].hp * (c.scale || 1) * (c.elite ? 1.8 : 1));

export function updateCreature(g, c, dt) {
  const def = CREATURES[c.t];
  if (!def) { remove(g, c); return; }
  // one in ten hostile beasts is an Elite: bigger, tougher, harder hitting, with better loot
  if (c._eliteRolled == null) {
    c._eliteRolled = true;
    if (def.hostile && !def.boss && !c.bounty && c.t !== 'invader' && Math.random() < 0.1) { c.elite = true; c.scale = (c.scale || 1) * 1.3; c.hp = maxHp(c); }
  }
  if (c.hp == null) c.hp = maxHp(c);
  c._walking = false;
  if (c._hurtFlash) c._hurtFlash = Math.max(0, c._hurtFlash - dt);
  if (c._whiteFlash > 0) c._whiteFlash -= dt;
  if (c._kbx || c._kby) {   // sliding back from a blow (even while stunned)
    const nx = c.x + c._kbx * dt, ny = c.y + c._kby * dt;
    if (CREATURES[c.t]?.flying || g.world.walkable(nx, ny)) { c.x = nx; c.y = ny; } else { c._kbx = -c._kbx * 0.3; c._kby = -c._kby * 0.3; }
    const k = Math.exp(-9 * dt); c._kbx *= k; c._kby *= k;
    if (Math.hypot(c._kbx, c._kby) < 4) c._kbx = c._kby = 0;
  }
  if (c._stunned > 0) { c._stunned -= dt; c._windup = 0; return; }

  const s = g.state;

  // raiders give up after a day and a half; ghosts vanish at dawn
  if (c.raid && !c.fleeing && s.time - (c.born || 0) > DAY_LENGTH * 1.5) c.fleeing = true;
  if (def.night && !g.isNight && Math.random() < dt * 0.2) { g.puff(c, 'effects/ghost_wisp', 3); remove(g, c); return; }

  if (def.water) { wander(g, c, dt, def, true); return; }

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
          let dmg = def.damage * (c.scale || 1) / (1 + g.defense / 50);
          if (target.armed && g.hasBuilding('armory')) dmg *= 0.7;   // shield and mail
          dmg *= toughness(target);   // stamina shrugs off wounds
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
function special(g, c, def, target, dt) {
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
      strikeVillager(g, c, hit, def.damage * 1.6 * (c.scale || 1));
      return true;
    }
    return true;
  }
  if (c._specialCd > 0) return false;
  if (c.t === 'boar' && d > TILE * 2 && d < TILE * 7) {
    const a = Math.atan2(target.y - c.y, target.x - c.x);
    c._charge = { dx: Math.cos(a), dy: Math.sin(a), wind: 0.7, t: Math.min(1.6, d / (def.speed * 3.2) + 0.3) };   // long enough to run right through where you stood
    c._specialCd = 4 + Math.random() * 2;
    return true;
  }
  if (c.t === 'goblin' && d > TILE * 2.2 && d < TILE * 8) {
    c._throw = (c._throw ?? 0.5) - dt;   // winding up the throw
    c._windup = Math.max(0, c._throw);
    c._flip = target.x < c.x;
    if (c._throw > 0) return true;
    c._throw = null;
    c._specialCd = 2.2 + Math.random() * 1.5;
    const a = Math.atan2(target.y - c.y, target.x - c.x) + (Math.random() - 0.5) * 0.15;
    (g.enemyShots ||= []).push({ x: c.x, y: c.y - 10, vx: Math.cos(a) * TILE * 7, vy: Math.sin(a) * TILE * 7, left: TILE * 9, dmg: def.damage * 0.8 * (c.scale || 1), from: c });
    return true;
  }
  return false;
}

/** A blow from a beast to a villager (the person you play can dodge, block or parry it). */
function strikeVillager(g, c, target, dmg) {
  dmg = dmg / (1 + g.defense / 50) * toughness(target);
  if (g.hero?.id === target.id) dmg = damageHero(g, target, dmg, c);
  if (!dmg) return;
  target.hp -= dmg;
  target._hurtFlash = 0.25;
  g.fx.shake = Math.max(g.fx.shake, 0.6);
  if (target.hp <= 0 && !knockOutHero(g, target)) killVillager(g, target, `was slain by ${/^[aeiou]/.test(c.t) ? 'an' : 'a'} ${c.t.replace('_', ' ')}`);
}

/** Rocks thrown by goblins fly until they hit someone or fall. */
export function updateEnemyShots(g, dt) {
  if (!g.enemyShots?.length) return;
  for (const s of g.enemyShots) {
    const mx = s.vx * dt, my = s.vy * dt;
    s.x += mx; s.y += my; s.left -= Math.hypot(mx, my);
    const hit = g.state.villagers.find(v => !v.away && Math.hypot(v.x - s.x, v.y - 10 - s.y) < TILE * 0.5);
    if (hit) {
      s.left = 0;
      strikeVillager(g, s.from || { x: s.x - s.vx, y: s.y - s.vy, t: 'goblin' }, hit, s.dmg);
      g.anim('combat/hit', s.x, s.y, { size: 18, dur: 0.2 });
    }
  }
  g.enemyShots = g.enemyShots.filter(s => s.left > 0);
}

export function damageCreature(g, c, dmg, by) {
  const def = CREATURES[c.t];
  if (c.hp == null) c.hp = maxHp(c);
  // armoured beasts shrug off most blows from people; a real weapon cuts through better
  const heroArmed = by && g.hero?.id === by.id && g.state.rpg?.gear?.weapon;
  if (def.armor && by) dmg *= by.armed || heroArmed || by.inv?.pack?.sword || by.inv?.pack?.spear ? 1 - def.armor * 0.6 : 1 - def.armor;
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
    const d = Math.hypot(v.x - c.x, v.y - c.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function step(g, c, tx, ty, dist, def) {
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
