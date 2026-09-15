import { TILE, WALK_SPEED, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { CREATURES, OBJECTS } from '../data/objects.js';
import { damageCreature } from './creatures.js';
import { collectFind } from './finds.js';
import { pickUp } from './groundItems.js';
import { gainSkill, hitVillager } from './villagers.js';
import { has } from './dynasty.js';
import { speedMult, strengthMult } from './body.js';
import { heroStats, heroWeapon, onHeroKill, questProgress, updateQuests } from './rpg.js';

/*
 * Lead in person: take control of your ruler and walk the land yourself.
 * WASD / arrows (or the stick on phones) to move, Space (or the ACT button) to strike, chop, mine and pick up.
 * Your ruler swings at any beast in reach, walks over finds to collect them, and people working near
 * them work 50% faster. While you lead, bounties appear: named monsters with a price on their head.
 */

const REACH = TILE * 1.25;
const INSPIRE = TILE * 5;
const ACT_COOLDOWN = 0.32;

const BOUNTY_TIERS = [
  { era: 0, types: ['wolf', 'boar', 'giant_spider', 'slime'], gold: [15, 30], names: ['Old Greytooth', 'the Tusked One', 'Webmother', 'the Green Ooze'] },
  { era: 1, types: ['bandit', 'goblin', 'bear', 'skeleton'], gold: [30, 60], names: ['Red Rolf', 'Snitch the Goblin King', 'Ironhide', 'the Bone Knight'] },
  { era: 2, types: ['cave_troll', 'forest_spirit', 'bandit'], gold: [60, 120], names: ['Grumbelly', 'the Weeping Spirit', 'Black Bess'] },
  { era: 4, types: ['cave_troll', 'dragon'], gold: [150, 400], names: ['Mountainback', 'Ashwing the Dragon'] },
];

export const heroOf = g => {
  const id = g.hero?.id;
  if (!id) return null;
  const v = g.state.villagers.find(x => x.id === id && !x.away);
  if (!v) { endLead(g, true); return null; }
  return v;
};

/** Who you play as: your chosen avatar, else the ruler, else the strongest adult at home. */
export function avatarOf(g) {
  const s = g.state;
  return s.villagers.find(v => v.id === s.avatarId && !v.away) || s.villagers.find(v => v.ruling && !v.away) || [...s.villagers].filter(v => !v.away && v.age >= 16).sort((a, b) => (b.skills.combat || 0) - (a.skills.combat || 0))[0] || null;
}

export function startLead(g, v = avatarOf(g)) {
  if (!v) return { error: 'Nobody at home can lead' };
  if (v.away) return { error: `${v.name} is away` };
  if (v.age < ADULT_AGE) return { error: 'Children cannot be your avatar' };
  if (g.sail) return { error: 'Return to port first' };
  const prev = g.hero;
  v._task = null;
  g.hero = { id: v.id, cd: 0, actCd: 0, swing: 0, inspire: 0, kills: prev?.kills || 0, finds: prev?.finds || 0, chopped: prev?.chopped || 0, bountyAt: prev?.bountyAt ?? g.state.time + 20 };
  g.log(v.ruling ? `${v.name} walks among the people. Lead the way!` : `You take the form of ${v.name} the ${v.profession || 'villager'}.`, 'event', v);
  g.emit('change');
  return { ok: true, hero: v };
}

/** Choose a villager as your avatar, and start playing as them right away. */
export function setAvatar(g, v) {
  if (!v || v.age < ADULT_AGE) return { error: 'Children cannot be your avatar' };
  const r = startLead(g, v);
  if (r.ok) g.state.avatarId = v.id;
  return r;
}

export function endLead(g, died = false) {
  if (!g.hero) return;
  const h = g.hero;
  g.hero = null;
  if (!died && (h.kills || h.finds || h.chopped)) g.log(`You step back from leading: ${h.kills} beasts slain, ${h.finds} finds, ${h.chopped} trees and rocks worked.`, 'good');
  g.emit('change');
}

/** Is someone close enough to the hero to be inspired (works 50% faster)? */
export function inspired(g, v) {
  const h = g.hero;
  return !!h && h.id !== v.id && h.x != null && Math.abs(v.x - h.x) < INSPIRE && Math.abs(v.y - h.y) < INSPIRE && Math.hypot(v.x - h.x, v.y - h.y) < INSPIRE;
}

function heroDamage(g, v) {
  const pack = v.inv?.pack || {};
  let dmg = (9 + (v.skills.combat || 0) * 2.2) * (1 + (g.combatBonus || 0));
  if (v.armed || pack.sword) dmg *= 1.8;
  else if (pack.spear || pack.axe || pack.pickaxe || pack.hammer) dmg *= 1.3;
  if (has(v, 'knighted')) dmg *= 1.25;
  if (has(v, 'veteran')) dmg *= 1.3;
  return dmg * strengthMult(v);
}

function nearestHostile(g, v, range) {
  let best = null, bd = range;
  for (const c of g.state.creatures) {
    if (!CREATURES[c.t]?.hostile) continue;
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function strike(g, v, c, mult) {
  v._flip = c.x < v.x;
  g.hero.swing = 0.22;
  const had = g.state.creatures.includes(c);
  damageCreature(g, c, heroDamage(g, v) * mult, v);
  gainSkill(g, v, 'combat');
  g.puff({ x: c.x, y: c.y - 6 }, 'effects/hit_star', 2, 8);
  g.fx.shake = Math.max(g.fx.shake, 0.25);
  if (had && !g.state.creatures.includes(c)) g.hero.kills++;
}

const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function attack(g, v, st) {
  const h = g.hero;
  const w = heroWeapon(g, v);
  const nearFoe = nearestHostile(g, v, TILE * Math.max(3, w.ranged ? w.range : 3));
  const nearPerson = h.violent ? nearestPerson(g, v, TILE * 2.5) : null;
  // nothing to fight close by: the same button chops, mines and gathers
  if (!nearFoe && !nearPerson) {
    if (h.actCd <= 0) { h.actCd = ACT_COOLDOWN; if (work(g, v)) questProgress(g, 'gather', { v }); }
    return;
  }
  const cost = w.ranged ? 6 : 8;
  if (h.stamina < cost) { if (!h._tiredAt || g.state.time - h._tiredAt > 1) { h._tiredAt = g.state.time; g.float(v.x, v.y - TILE * 1.3, 'Out of breath', '#ffb3aa'); } return; }
  h.stamina -= cost;
  h.sinceAttack = 0;
  h.atkCd = w.speed / Math.max(0.6, st.speed);
  h.swing = 0.22;
  // aim: where you are going, or straight at the closest foe when you stand still
  const target = nearFoe || nearPerson;
  if (target && (!h._movedAt || g.state.time - h._movedAt > 0.15 || angleDiff(h.facing, Math.atan2(target.y - v.y, target.x - v.x)) < 1.2)) h.facing = Math.atan2(target.y - v.y, target.x - v.x);
  const crit = Math.random() < st.crit;
  h.atkAnim = { t: 0, dur: Math.max(0.24, Math.min(0.42, w.speed * 0.7)) };
  const dmg = w.dmg * st.dmgMult * strengthMult(v) * (crit ? 1.8 : 1);
  if (w.ranged) {
    (h.arrows ||= []).push({ x: v.x, y: v.y - 8, vx: Math.cos(h.facing) * TILE * 14, vy: Math.sin(h.facing) * TILE * 14, left: TILE * w.range, dmg, crit });
    return;
  }
  h.arc = { angle: h.facing, width: w.arc, range: w.range * TILE, t: 0.16, max: 0.16, crit };
  const reachPx = w.range * TILE;
  g.anim(crit ? 'combat/crit_slash' : 'combat/slash', v.x + Math.cos(h.facing) * reachPx * 0.55, v.y - 10 + Math.sin(h.facing) * reachPx * 0.55, { size: reachPx * 1.2, dur: 0.22, rot: h.facing });
  let hits = 0;
  for (const c of [...g.state.creatures]) {
    if (!CREATURES[c.t]?.hostile && !CREATURES[c.t]?.food) continue;
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    const reach = w.range * TILE + CREATURES[c.t].size * TILE * 0.4;
    if (d > reach || (d > TILE * 0.4 && angleDiff(Math.atan2(c.y - v.y, c.x - v.x), h.facing) > w.arc / 2 + 0.25)) continue;
    hitCreature(g, v, c, dmg, crit, w);
    hits++;
  }
  if (h.violent) {
    for (const o of [...g.state.villagers]) {
      if (o === v || o.away) continue;
      const d = Math.hypot(o.x - v.x, o.y - v.y);
      if (d > w.range * TILE + 8 || (d > 8 && angleDiff(Math.atan2(o.y - v.y, o.x - v.x), h.facing) > w.arc / 2 + 0.2)) continue;
      gainSkill(g, v, 'combat', true);
      if (hitVillager(g, v, o, dmg)) h.slain = (h.slain || 0) + 1;
      hits++;
    }
  }
  if (hits) g.fx.shake = Math.max(g.fx.shake, crit ? 0.8 : 0.35);
}

function hitCreature(g, v, c, dmg, crit, w) {
  const had = g.state.creatures.includes(c);
  damageCreature(g, c, dmg, v);
  gainSkill(g, v, 'combat', true);
  g.anim('combat/hit', c.x, c.y - 8, { size: crit ? 34 : 24, dur: 0.24 });
  g.hitStop = crit ? 0.09 : 0.05;
  g.float(c.x + (Math.random() - 0.5) * 10, c.y - TILE * 0.9, String(Math.round(dmg)), crit ? '#ffd76a' : '#ffffff');

  // knockback, and heavy weapons stagger
  const a = Math.atan2(c.y - v.y, c.x - v.x);
  const push = (w.stun ? 14 : 7) * (CREATURES[c.t]?.boss ? 0.2 : 1);
  if (g.world.walkable(c.x + Math.cos(a) * push, c.y + Math.sin(a) * push)) { c.x += Math.cos(a) * push; c.y += Math.sin(a) * push; }
  if (w.stun && !CREATURES[c.t]?.boss) c._stunned = Math.max(c._stunned || 0, w.stun);
  c._windup = 0;   // a hit interrupts their attack
  if (had && !g.state.creatures.includes(c)) { g.hero.kills++; onHeroKill(g, c, v); }
}

function updateArrows(g, v, dt) {
  const h = g.hero;
  if (!h.arrows?.length) return;
  for (const ar of h.arrows) {
    const sx = ar.vx * dt, sy = ar.vy * dt;
    ar.x += sx; ar.y += sy; ar.left -= Math.hypot(sx, sy);
    const c = g.state.creatures.find(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - ar.x, c.y - 8 - ar.y) < TILE * 0.6);
    if (c) { hitCreature(g, v, c, ar.dmg, ar.crit, { stun: 0 }); ar.left = 0; }
  }
  h.arrows = h.arrows.filter(a => a.left > 0);
}

/**
 * Something hits the person you play. Dashing through it: dodged. Guarding while facing it: most of it is
 * blocked (and a guard raised just in time parries, staggering the attacker). Armour takes its share.
 * Returns the damage that gets through.
 */
export function damageHero(g, v, dmg, from = null) {
  const h = g.hero;
  if (!h || h.id !== v.id) return dmg;
  if (h.iframes > 0) { g.float(v.x, v.y - TILE * 1.3, 'Dodged!', '#9fd4ff'); return 0; }
  const facingIt = from ? angleDiff(Math.atan2(from.y - v.y, from.x - v.x), h.facing) < 1.8 : true;
  if (h.blocking && facingIt) {
    if (g.state.time - (h.blockAt || 0) < 0.25) {
      if (from && 'hp' in from && !from.traits) from._stunned = Math.max(from._stunned || 0, 1.2);
      g.float(v.x, v.y - TILE * 1.3, 'PARRY!', '#ffd76a');
      g.anim('combat/parry', v.x + Math.cos(h.facing) * 10, v.y - 10 + Math.sin(h.facing) * 8, { size: 34, dur: 0.3 });
      h.stamina = Math.min(h.maxStamina || 100, (h.stamina || 0) + 10);
      return 0;
    }
    h.stamina -= dmg * 1.2;
    dmg *= h.stamina > 0 ? 0.2 : 0.6;   // a broken guard lets more through
    g.float(v.x, v.y - TILE * 1.3, 'Blocked', '#d9d4c7');
  }
  dmg *= 1 - heroStats(g).armor;
  h.sinceHit = 0;
  return dmg;
}

/** The person you play never simply dies: they are knocked out and come to at home, a little poorer. */
export function knockOutHero(g, v) {
  const h = g.hero;
  if (!h || h.id !== v.id) return false;
  const st = heroStats(g);
  v.hp = Math.round(st.maxHp * 0.4);
  const home = g.center;
  v.x = home.x + 20; v.y = home.y + 20;
  h.iframes = 3; h.dash = null; h.arrows = [];
  const lost = Math.floor((g.state.resources.gold || 0) * 0.1);
  g.state.resources.gold -= lost;
  g.announce('You were knocked out!');
  g.log(`You were knocked out and woke up at home${lost ? `, ${lost} gold poorer` : ''}.`, 'bad');
  g.fx.shake = 2;
  return true;
}

/** Hostile mode: your avatar can strike your own people too. Guards and grieving families answer a killing. */
export function setViolent(g, on) {
  if (!g.hero) return;
  g.hero.violent = on ?? !g.hero.violent;
  g.emit('change');
}

function nearestPerson(g, v, range) {
  let best = null, bd = range;
  for (const o of g.state.villagers) {
    if (o === v || o.away) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function strikePerson(g, v, o) {
  v._flip = o.x < v.x;
  g.hero.swing = 0.22;
  g.hero.cd = 0.5;
  gainSkill(g, v, 'combat');
  g.fx.shake = Math.max(g.fx.shake, 0.25);
  if (hitVillager(g, v, o, heroDamage(g, v) * 1.2)) g.hero.slain = (g.hero.slain || 0) + 1;
}

/** Chop, mine or pick the thing in reach: a few hits and it gives double what a worker would get. */
function work(g, v) {
  const s = g.state;
  const tx = v.x / TILE, ty = v.y / TILE;
  let obj = null, bd = 1.35;
  for (let y = Math.floor(ty) - 2; y <= Math.floor(ty) + 2; y++) for (let x = Math.floor(tx) - 2; x <= Math.floor(tx) + 2; x++) {
    const o = g.world.objectAt(x, y);
    if (!o || !OBJECTS[o.t]?.work || OBJECTS[o.t].work === 'explore') continue;
    const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
    if (d < bd) { bd = d; obj = o; }
  }
  if (!obj) return false;
  const def = OBJECTS[obj.t];
  const c = { x: (obj.x + 0.5) * TILE, y: (obj.y + 0.5) * TILE };
  v._flip = c.x < v.x;
  g.hero.swing = 0.22;
  obj._shake = 0.25;
  obj._heroHits = (obj._heroHits || 0) + 1;
  g.puff(c, def.work === 'mine' ? 'effects/rock_chunk' : def.work === 'chop' ? 'items/icon_wood' : 'effects/leaf', 3, 10);
  const need = def.work === 'chop' ? 3 : def.work === 'mine' ? 2 : 1;
  if (obj._heroHits < need) return true;
  obj._heroHits = 0;
  const got = [];
  for (const k of ['wood', 'stone', 'food', 'coal', 'iron', 'gold', 'gems', 'influence']) {
    if (!def[k]) continue;
    const n = (def[k][0] + Math.floor(Math.random() * (def[k][1] - def[k][0] + 1))) * 2;
    got.push(`+${g.addResource(k, n) ?? n} ${k}`);
  }
  if (got.length) g.float(c.x, c.y - TILE, got.join('  '), '#ffe7a0');
  if (def.work === 'chop') {
    s.stats.treesCut = (s.stats.treesCut || 0) + 1;
    if (def.stump) { obj.t = 'tree_stump'; obj.growAt = s.time + OBJECTS.tree_stump.growDays * DAY_LENGTH; }
    else g.world.removeObject(s.objects, obj);
    g.puff(c, 'effects/leaf', 12, 30);
  } else {
    obj.charges = (obj.charges || 1) - 1;
    if (obj.charges <= 0 && !def.regrowDays) g.world.removeObject(s.objects, obj);
  }
  gainSkill(g, v, def.work === 'chop' ? 'chop' : def.work === 'mine' ? 'mine' : 'gather', true);
  g.hero.chopped++;
  return true;
}

/** controls: { mx, my } in -1..1, act: true while the strike button is held */
export function updateHero(g, dt, controls = {}) {
  const v = heroOf(g);
  if (!v) return;
  const h = g.hero;
  const st = heroStats(g);
  h.cd -= dt; h.actCd -= dt; h.swing = Math.max(0, h.swing - dt);
  h.atkCd = (h.atkCd || 0) - dt; h.dashCd = (h.dashCd || 0) - dt; h.iframes = Math.max(0, (h.iframes || 0) - dt);
  h.sinceHit = (h.sinceHit ?? 99) + dt; h.sinceAttack = (h.sinceAttack ?? 99) + dt;
  if (h.arc) { h.arc.t -= dt; if (h.arc.t <= 0) h.arc = null; }
  if (h.atkAnim) h.atkAnim.t += dt;
  h.maxStamina = st.maxStamina; h.maxHp = st.maxHp;
  h.stamina = Math.min(st.maxStamina, h.stamina ?? st.maxStamina);
  v._task = null;

  // walking: a little quicker than anyone else, sliding along coasts and walls
  let mx = controls.mx || 0, my = controls.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  if (len > 0.1) { h.facing = Math.atan2(my, mx); h._movedAt = g.state.time; }
  h.facing ??= 0;
  const ok = (x, y) => g.world.walkable(x, y) && !g.buildingAt(Math.floor(x / TILE), Math.floor(y / TILE))?.built;
  const moveBy = (dx, dy) => {
    const nx = v.x + dx, ny = v.y + dy;
    if (ok(nx, ny)) { v.x = nx; v.y = ny; }
    else if (ok(nx, v.y)) v.x = nx;
    else if (ok(v.x, ny)) v.y = ny;
  };

  // block: hold to raise your guard (slow, drains stamina); a block right as the blow lands is a parry
  const blocking = !!controls.block && h.stamina > 1 && !h.dash;
  if (blocking && !h.blocking) h.blockAt = g.state.time;
  h.blocking = blocking;
  if (blocking) h.stamina -= 14 * dt;

  // dash: a quick burst in the direction you move (or face) with a moment where nothing can touch you
  if (controls.dash && !h.dash && h.dashCd <= 0 && h.stamina >= 22 && !g.visiting) {
    const a = len > 0.1 ? Math.atan2(my, mx) : h.facing;
    h.dash = { t: 0.18, dx: Math.cos(a), dy: Math.sin(a) };
    h.iframes = 0.3;
    h.dashCd = 0.5;
    g.anim('combat/dust', v.x, v.y - 4, { size: 26, dur: 0.32, flip: Math.cos(a) > 0 });
    h.stamina -= 22;
    (h.trail ||= []).length = 0;
  }
  if (h.dash) {
    const sp = TILE * 17 * dt;
    moveBy(h.dash.dx * sp, h.dash.dy * sp);
    (h.trail ||= []).push({ x: v.x, y: v.y, life: 0.25 });
    h.dash.t -= dt;
    if (h.dash.t <= 0) h.dash = null;
    v._walking = true;
  } else {
    v._walking = len > 0.1;
    if (v._walking) {
      const sp = WALK_SPEED * 2.1 * speedMult(v) * st.speed * (blocking ? 0.45 : 1) * dt;
      moveBy(mx * sp, my * sp);
    }
  }
  for (const p of h.trail || []) p.life -= dt;
  if (h.trail?.length) h.trail = h.trail.filter(p => p.life > 0);
  if (Math.abs(Math.cos(h.facing)) > 0.2) v._flip = Math.cos(h.facing) < 0;

  // stamina comes back when you are not swinging or guarding; health slowly after a while out of harm
  if (!blocking && h.sinceAttack > 0.4 && !h.dash) h.stamina = Math.min(st.maxStamina, h.stamina + 32 * dt);
  if (h.sinceHit > 6 && v.hp < st.maxHp) v.hp = Math.min(st.maxHp, v.hp + 3 * dt);
  h.x = v.x; h.y = v.y;
  // in someone else's land you only walk (a spy acts through the spy bar; nothing there is yours to take)
  if (g.visiting) return;

  // a quick bite from the stores when hungry (nobody else feeds a ruler on the move)
  if (v.hunger < 35 && g.state.resources.food >= 3) { g.state.resources.food -= 3; v.hunger = 100; g.float(v.x, v.y - TILE * 1.3, 'Ate', '#8fe07a'); }

  // finds are picked up by walking over them
  for (const f of [...(g.state.finds || [])]) {
    if (Math.hypot(f.x - v.x, f.y - v.y) < TILE * 0.9 && collectFind(g, f)) h.finds++;
  }

  // items on the ground go into your pack as you walk over them
  for (const it of [...(g.state.groundItems || [])]) {
    if (Math.hypot(it.x - v.x, it.y - v.y) < TILE * 0.7) pickUp(g, v, it);
  }

  // ATTACK: swing your weapon in an arc (or loose an arrow); with nothing to fight nearby it works the land
  if (controls.act && h.atkCd <= 0 && !blocking && !h.dash) attack(g, v, st);
  updateArrows(g, v, dt);
  updateQuests(g);

  // people nearby are inspired: a spark over their heads now and then
  h.inspire -= dt;
  if (h.inspire <= 0) {
    h.inspire = 2.5;
    for (const o of g.state.villagers) if (o._task?.phase === 'work' && inspired(g, o) && Math.random() < 0.35) g.puff({ x: o.x, y: o.y - TILE }, 'effects/spark', 1, 4);
  }

  updateBounties(g, v);
}

// ------------------------------------------------------------------ bounties

export const bountyOf = g => g.state.creatures.find(c => c.bounty) || null;

function updateBounties(g, v) {
  const s = g.state;
  const h = g.hero;
  if (bountyOf(g) || s.time < h.bountyAt) return;
  h.bountyAt = s.time + 70 + Math.random() * 60;
  const tier = [...BOUNTY_TIERS].reverse().find(t => s.era >= t.era) || BOUNTY_TIERS[0];
  const i = Math.floor(Math.random() * tier.types.length);
  const type = tier.types[i];
  if (!CREATURES[type]) return;
  const p = g.randomLandTile(9, 16);
  if (!p) return;
  const gold = tier.gold[0] + Math.floor(Math.random() * (tier.gold[1] - tier.gold[0]));
  const c = g.spawnCreature(type, p.x, p.y, { bounty: { gold, name: tier.names[i] || type }, scale: 1.25, hunting: null });
  if (!c) return;
  c.hp = Math.round(CREATURES[type].hp * 1.25 * 1.6);
  const dir = compass(p.x - v.x, p.y - v.y);
  g.log(`Bounty: ${c.bounty.name} (${type.replace('_', ' ')}) lurks to the ${dir}. Slay it for ${gold} gold!`, 'event', p);
  g.announce(`Bounty: ${c.bounty.name}, ${gold} gold`);
}

/** Paid out by damageCreature when a bounty monster dies (whoever kills it). */
export function payBounty(g, c, by) {
  const b = c.bounty;
  const gold = g.addResource('gold', b.gold) ?? b.gold;
  g.addResource('influence', Math.round(b.gold / 5));
  g.float(c.x, c.y - TILE * 1.6, `Bounty! +${gold} gold`, '#ffcf5a');
  g.puff(c, 'effects/coin', 10, 24);
  g.log(`${b.name} is slain${by ? ` by ${by.name}` : ''}! The bounty pays ${gold} gold and ${Math.round(b.gold / 5)} influence.`, 'good', c);
  g.announce(`${b.name} slain!`);
  for (const o of g.state.villagers) if (Math.hypot(o.x - c.x, o.y - c.y) < TILE * 10) o.happy = Math.min(100, o.happy + 6);
}

export function compass(dx, dy) {
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  return dirs[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
