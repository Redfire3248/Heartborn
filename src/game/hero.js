import { TILE, WALK_SPEED, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { CREATURES, OBJECTS } from '../data/objects.js';
import { damageCreature } from './creatures.js';
import { collectFind } from './finds.js';
import { pickUp } from './groundItems.js';
import { gainSkill } from './villagers.js';
import { has } from './dynasty.js';
import { speedMult, strengthMult } from './body.js';

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
  h.cd -= dt; h.actCd -= dt; h.swing = Math.max(0, h.swing - dt);
  v._task = null;

  // walking: a little quicker than anyone else, sliding along coasts and walls
  let mx = controls.mx || 0, my = controls.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  v._walking = len > 0.1;
  if (v._walking) {
    const sp = WALK_SPEED * 2.1 * speedMult(v) * dt;
    const nx = v.x + mx * sp, ny = v.y + my * sp;
    const ok = (x, y) => g.world.walkable(x, y) && !g.buildingAt(Math.floor(x / TILE), Math.floor(y / TILE))?.built;
    if (ok(nx, ny)) { v.x = nx; v.y = ny; }
    else if (ok(nx, v.y)) v.x = nx;
    else if (ok(v.x, ny)) v.y = ny;
    if (Math.abs(mx) > 0.2) v._flip = mx < 0;
  }
  h.x = v.x; h.y = v.y;

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

  // the ruler fights whatever comes in reach
  const foe = nearestHostile(g, v, REACH);
  if (foe && h.cd <= 0) { h.cd = 0.6; strike(g, v, foe, 1); }

  // ACT: a heavy blow on a nearby foe, or work the land
  if (controls.act && h.actCd <= 0) {
    h.actCd = ACT_COOLDOWN;
    const target = nearestHostile(g, v, REACH * 1.4);
    if (target) { strike(g, v, target, 1.6); h.cd = 0.5; }
    else if (!work(g, v)) h.actCd = 0.1;
  }

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
