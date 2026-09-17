import { doorOf } from './houses.js';
import { enchantTraits } from './enchanting.js';
import { gameTheme } from './worldTypes.js';
import { TILE, WALK_SPEED, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { traitEffects, abilityOf } from './forging.js';
import { popResource, updateDrops, lucky, ORE_RESOURCE } from './loot.js';
import { CREATURES, OBJECTS } from '../data/objects.js';
import { damageCreature, maxHp } from './creatures.js';
import { collectFind } from './finds.js';
import { pickUp } from './groundItems.js';
import { gainSkill } from './villagers.js';
import { has } from './dynasty.js';
import { speedMult, strengthMult } from './body.js';
import { heroStats, heroWeapon, onHeroKill, questProgress, updateQuests, rpgOf, SHIELDS, BLADE_SPECIALS, UNDEAD } from './rpg.js';
import { updateTreasure, chestNear, openChest, drinkPotion, entranceNear } from './treasure.js';
import { homeDoorNear } from './houses.js';
import { workWith, flashTool, dig, fish, buildMult, heldSlot, hasTool, TOOLS, WORK_OF_KIND, HAND_WORK, canMine, pickaxeFor, giveTool, dropTool, bestTool } from './tools.js';
import { useItem, buffActive, updateBuffs } from './consumables.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';

/** A building under construction within reach (solo: you build it yourself). */
function siteNear(g, v) {
  for (const b of g.state.buildings) {
    if (b.built) continue;
    const s = sizeOf(b);
    const nx = Math.max(b.tx * TILE, Math.min(v.x, (b.tx + s) * TILE)), ny = Math.max(b.ty * TILE, Math.min(v.y, (b.ty + s) * TILE));
    if (Math.hypot(nx - v.x, ny - v.y) < TILE * 1.3) return b;
  }
  return null;
}

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

/** Who you play as: always your ruler, the King (only if there is no ruler at home, the strongest adult stands in). */
export function avatarOf(g) {
  const s = g.state;
  return s.villagers.find(v => v.ruling && !v.away) || [...s.villagers].filter(v => !v.away && v.age >= 16).sort((a, b) => (b.skills.combat || 0) - (a.skills.combat || 0))[0] || null;
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

/** The closest creature you can fight: any beast, hostile or not (fish in the water are out of reach). */
function nearestHostile(g, v, range) {
  let best = null, bd = range;
  for (const c of g.state.creatures) {
    if (!CREATURES[c.t] || CREATURES[c.t].water) continue;
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
  // what you hold in your hotbar decides what the swing does
  const held = heldSlot(g);
  if (held === 'potion') { if (h.atkCd <= 0) { h.atkCd = 0.5; drinkPotion(g, v); } return; }
  if (held?.startsWith('item:')) { if (h.atkCd <= 0) { h.atkCd = 0.5; useItem(g, v, held.slice(5)); } return; }
  const tool = TOOLS[held] ? held : null;
  const nearFoe = tool ? null : nearestHostile(g, v, TILE * Math.max(3, w.ranged ? w.range : 3));   // tools do not fight
  const nearPerson = null;   // your avatar only fights beasts and raiders
  const swingTime = Math.max(0.3, Math.min(0.45, w.speed * 0.8));
  // nothing to fight close by: you still swing (the animation always plays), and the swing chops, mines and gathers
  // a chest in reach and no foe close: the swing breaks it open
  // a cave mouth in reach: the swing takes you down into the dungeon
  const cave = !nearFoe && entranceNear(g, v.x, v.y);
  if (cave) { h.atkCd = swingTime; h.atkAnim = { t: 0, dur: swingTime }; g.emit('dungeon', cave); return; }
  const chest = !nearFoe && chestNear(g, v.x, v.y);
  const site = !nearFoe && !chest && g.solo && siteNear(g, v);
  if (site) {
    h.atkCd = swingTime; h.atkAnim = { t: 0, dur: swingTime };
    const c = g.buildingCenter(site);
    h.facing = Math.atan2(c.y - v.y, c.x - v.x);
    slashFx(g, v, h, w, false);
    site.progress = Math.min(1, (site.progress || 0) + Math.min(0.6, 6 / (BUILDINGS[site.type]?.work || 10)) * buildMult(g));
    g.puff(c, 'effects/dust', 4, 12);
    g.float(c.x, c.y - TILE, `Building ${Math.round(site.progress * 100)}%`, '#ffd76a');
    if (site.progress >= 1) g.finishBuilding(site);
    return;
  }
  if (chest) {
    h.atkCd = swingTime; h.atkAnim = { t: 0, dur: swingTime };
    h.facing = Math.atan2(chest.y - v.y, chest.x - v.x);
    slashFx(g, v, h, w, false);
    openChest(g, chest, v);
    return;
  }
  if (!nearFoe && !nearPerson && !(w.ranged && !tool)) {   // (bows, guns and staffs always shoot where you face)
    if (h.actCd > 0) return;
    h.actCd = Math.max(ACT_COOLDOWN, swingTime);
    h.atkCd = swingTime;
    h.atkAnim = { t: 0, dur: swingTime };
    if (!tool) {   // a weapon (or bare hands) at nothing to fight: cut grass, pick berries and crops
      slashFx(g, v, h, w, false);
      if (work(g, v, null)) questProgress(g, 'gather', { v });   // hands and weapons only pick plants: trees need an axe, rocks a pickaxe
      return;
    }
    h.swing = 0.22;
    if (tool === 'torch') { placeTorch(g, v, h); return; }
    const kind = TOOLS[tool].kind;
    if (WORK_OF_KIND[kind]) { if (work(g, v, tool)) questProgress(g, 'gather', { v }); else nothingFor(g, v, tool); }
    else if (kind === 'shovel') { if (g.dungeon || g.visiting || !dig(g, v, tool)) nothingFor(g, v, tool); }
    else if (kind === 'fishing_rod') { if (!fish(g, v, tool)) nothingFor(g, v, tool); }
    else nothingFor(g, v, tool);
    return;
  }
  const cost = w.admin ? 0 : w.ranged ? (w.speed < 0.2 ? 1.5 : 6) : 8;
  if (h.stamina < cost) { if (!h._tiredAt || g.state.time - h._tiredAt > 1) { h._tiredAt = g.state.time; g.float(v.x, v.y - TILE * 1.3, 'Out of breath', '#ffb3aa'); } return; }
  h.stamina -= cost;
  h.sinceAttack = 0;
  h.atkCd = Math.max(swingTime, w.speed / Math.max(0.6, st.speed));   // let the swing finish before the next
  h.swing = 0.22;
  // aim: where you are going, or straight at the closest foe when you stand still
  const target = nearFoe || nearPerson;
  if (target && (!h._movedAt || g.state.time - h._movedAt > 0.15 || angleDiff(h.facing, Math.atan2(target.y - v.y, target.x - v.x)) < 1.2)) h.facing = Math.atan2(target.y - v.y, target.x - v.x);
  const crit = Math.random() < st.crit;
  h.atkAnim = { t: 0, dur: swingTime };
  // combos: swing again soon after a swing to chain up to three; the third blow is a finisher
  h.combo = h.sinceAttackSwing != null && g.state.time - h.sinceAttackSwing < swingTime + 0.45 ? (h.combo % 3) + 1 : 1;
  h.sinceAttackSwing = g.state.time;
  const finisher = h.combo === 3;
  if (finisher) h.atkAnim.dur = swingTime * 1.25;
  const allTraits = [...(w.traits || []), ...enchantTraits(w)];   // forged traits and enchantments
  const traitSp = allTraits.length ? traitEffects([...new Set(allTraits)]) : null;
  const sp = traitSp ? { ...traitSp, ...(BLADE_SPECIALS[w.base] || {}) } : BLADE_SPECIALS[w.base];
  let dmg = w.dmg * st.dmgMult * strengthMult(v) * (1 + (w.ench?.sharpness || 0) * 0.08) * (crit ? 1.8 : 1) * (finisher ? 1.6 : 1) * (buffActive(g, 'strength') ? 1.5 : 1) * (w.ranged && buffActive(g, 'ammo') ? 1.3 : 1);
  if (sp?.riposte && h.riposte) { dmg *= sp.riposte; h.riposte = false; g.float(v.x, v.y - TILE * 1.6, 'RIPOSTE!', '#ffd76a'); }
  if (w.ranged) {
    fireShots(g, v, h, w, dmg, crit);
    h.atkCd = Math.max(0.03, w.speed / Math.max(0.6, st.speed));   // guns fire as fast as they are built to
    return;
  }
  h.arc = { angle: h.facing, width: w.arc, range: w.range * TILE, t: 0.16, max: 0.16, crit };
  slashFx(g, v, h, w, crit || finisher, finisher ? 1.45 : 1);
  let hits = 0;
  for (const c of [...g.state.creatures]) {
    if (!CREATURES[c.t] || CREATURES[c.t].water) continue;   // every beast can be struck
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    const reach = w.range * TILE + CREATURES[c.t].size * TILE * 0.4;
    const arc = sp?.whirl && finisher ? Math.PI * 2 : w.arc;   // a whirlwind finisher hits all the way round
    if (d > reach || (d > TILE * 0.4 && angleDiff(Math.atan2(c.y - v.y, c.x - v.x), h.facing) > arc / 2 + 0.25)) continue;
    let blow = sp?.undead && UNDEAD.has(c.t) ? dmg * sp.undead : dmg;
    if (sp?.keen && Math.random() < sp.keen) { blow *= 2; g.float(c.x, c.y - TILE * 1.5, 'KEEN!', '#ff8a7a'); }
    hitCreature(g, v, c, blow, crit || finisher, finisher ? { ...w, stun: (w.stun || 0) + 0.4, finisher: true } : w);
    if (w.base === 'rubber_chicken') g.float(c.x, c.y - TILE * 1.4, 'SQUEAK!', '#ffe07a');
    if (w.base === 'golden_frying_pan') g.float(c.x, c.y - TILE * 1.4, 'BONK!', '#ffd76a');
    if (sp) bladeSpecial(g, v, c, blow, sp, finisher);
    if (sp?.swift && Math.random() < sp.swift && g.state.creatures.includes(c)) { hitCreature(g, v, c, blow * 0.6, false, { stun: 0 }); g.float(c.x + 8, c.y - TILE * 1.2, 'Swift!', '#9fffe0'); }
    hits++;
  }
  // other players on this island: the blow is sent to them
  if (g.pvp) for (const p of g.strangers || []) {
    if (!p.from) continue;
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    const arc = sp?.whirl && finisher ? Math.PI * 2 : w.arc;
    if (d > w.range * TILE + TILE * 0.4 || (d > TILE * 0.4 && angleDiff(Math.atan2(p.y - v.y, p.x - v.x), h.facing) > arc / 2 + 0.25)) continue;
    const blow = dmg * 0.6;   // players take less than monsters do, so fights last a few swings
    g.pvp(p.from, blow, v.x, v.y, v.name);
    p._hitFlash = 0.18;
    g.float(p.x, p.y - TILE * 1.3, String(Math.round(blow)), crit || finisher ? '#ffd76a' : '#ffffff');
    g.anim('combat/hit', p.x, p.y - 12, { size: 30, dur: 0.25 });
    hits++;
  }
  if (sp?.shockwave && (finisher || sp.shockwave.always)) {   // the claymore's finisher: a ring of force around you
    g.anim('combat/poof', v.x, v.y - 6, { size: TILE * sp.shockwave.radius * 2, dur: 0.4 });
    g.fx.shake = Math.max(g.fx.shake, 1.4);
    for (const c of [...g.state.creatures]) if (CREATURES[c.t]?.hostile && Math.hypot(c.x - v.x, c.y - v.y) < TILE * sp.shockwave.radius) hitCreature(g, v, c, dmg * sp.shockwave.share, false, w);
  }
  if (sp?.whirl && finisher) g.anim('combat/crit_slash', v.x, v.y - 10, { size: w.range * TILE * 2.4, dur: 0.3, rot: h.facing + Math.PI });
  if (hits) g.fx.shake = Math.max(g.fx.shake, finisher ? 1.1 : crit ? 0.8 : 0.35);
  if (finisher) g.float(v.x, v.y - TILE * 1.6, 'COMBO!', '#9fd4ff');
}

/**
 * Your weapon's active ability (F): Holy Light, Flame Wave, Frost Nova and more. Each has a cooldown.
 * Returns false (and says why) when there is no ability or it is not ready.
 */
export function useAbility(g) {
  const v = heroOf(g), h = g.hero;
  if (!v || !h) return false;
  const w = heroWeapon(g, v);
  const ab = abilityOf(rpgOf(g).gear.weapon || w);
  if (!ab) { g.float(v.x, v.y - TILE * 1.4, 'This weapon has no ability', '#cfc6e0'); return false; }
  const now = g.state.time;
  h.abilityReady ??= 0;
  if (now < h.abilityReady) { g.float(v.x, v.y - TILE * 1.4, `${ab.name}: ${Math.ceil(h.abilityReady - now)}s`, '#cfc6e0'); return false; }
  h.abilityReady = now + ab.cd;
  h.abilityMax = ab.cd;
  const st = heroStats(g);
  const base = (w.dmg || 10) * st.dmgMult;
  const foes = r => g.state.creatures.filter(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - v.x, c.y - v.y) < TILE * r);
  const flash = (r, color) => (g.fx.flashes ||= []).push({ x: v.x, y: v.y - 10, r: TILE * r, color, life: 0.5, max: 0.5 });
  const daze = (c, s) => { if (!CREATURES[c.t]?.boss) c._stunned = Math.max(c._stunned || 0, s); };
  g.float(v.x, v.y - TILE * 1.9, ab.name.toUpperCase() + '!', ab.color);
  g.fx.shake = Math.max(g.fx.shake, 1.2);
  switch (ab.id) {
    case 'holy_light':
      flash(4, '#fff3b0');
      v.hp = Math.min(st.maxHp, v.hp + st.maxHp * 0.25);
      for (const c of foes(4)) { hitCreature(g, v, c, base * (UNDEAD.has(c.t) ? 5 : 2.5), true, { stun: 0 }); daze(c, 1.2); }
      for (let i = 0; i < 16; i++) g.fx.particles.push({ x: v.x, y: v.y - 10, vx: Math.cos(i / 16 * Math.PI * 2) * 90, vy: Math.sin(i / 16 * Math.PI * 2) * 90, sprite: 'effects/spark', size: 8, life: 0.6, max: 0.6, rot: 0 });
      break;
    case 'flame_wave':
      flash(3, '#ff9a3a');
      for (const c of foes(4.5)) {
        if (angleDiff(Math.atan2(c.y - v.y, c.x - v.x), h.facing) > 1.1) continue;
        hitCreature(g, v, c, base * 2, false, { stun: 0 });
        if (g.state.creatures.includes(c)) c._burn = { dps: 8, until: now + 4, by: v.id };
      }
      for (let i = 0; i < 14; i++) { const a = h.facing + (Math.random() - 0.5) * 2; g.fx.particles.push({ x: v.x, y: v.y - 8, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, sprite: 'effects/flame', size: 12, life: 0.5, max: 0.5, rot: 0 }); }
      break;
    case 'frost_nova':
      flash(3.5, '#9fd4ff');
      for (const c of foes(3.5)) {
        hitCreature(g, v, c, base * 1.3, false, { stun: 0 });
        if (!g.state.creatures.includes(c)) continue;
        c._chill = { k: 0.4, until: now + 4 };
        if (!CREATURES[c.t]?.boss) { c._stunned = Math.max(c._stunned || 0, 2.5); c._frozen = now + 2.5; }
      }
      break;
    case 'thunderstorm':
      for (const c of foes(7).slice(0, 4)) {
        (g.fx.bolts ||= []).push({ x0: c.x + (Math.random() - 0.5) * 40, y0: c.y - 160, x1: c.x, y1: c.y - 10, life: 0.3 });
        hitCreature(g, v, c, base * 2.2, true, { stun: 0 });
        daze(c, 0.8);
      }
      flash(2, '#fff27a');
      break;
    case 'shadow_step': {
      const c = foes(8).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      if (!c) { h.abilityReady = now + 1; g.float(v.x, v.y - TILE * 1.4, 'No foe in reach', '#cfc6e0'); return false; }
      g.puff({ x: v.x, y: v.y - 8 }, 'effects/ghost_wisp', 6, 10);
      const a = Math.atan2(c.y - v.y, c.x - v.x);
      const bx = c.x + Math.cos(a) * TILE * 0.8, by = c.y + Math.sin(a) * TILE * 0.8;
      if (g.world.walkable(bx, by)) { v.x = bx; v.y = by; }
      h.facing = a + Math.PI;
      h.iframes = Math.max(h.iframes || 0, 0.5);
      hitCreature(g, v, c, base * 3, true, { stun: 0.5 });
      flash(1.5, '#b06aff');
      break;
    }
    case 'soul_reap': {
      let n = 0;
      for (const c of foes(3)) { hitCreature(g, v, c, base * 1.6, false, { stun: 0 }); n++; }
      v.hp = Math.min(st.maxHp, v.hp + n * st.maxHp * 0.06);
      g.anim('combat/crit_slash', v.x, v.y - 10, { size: TILE * 6, dur: 0.35, rot: h.facing });
      flash(3, '#8aff9a');
      break;
    }
    case 'iaido': {
      const a = h.facing;
      for (let s = 0; s < 8; s++) { const nx = v.x + Math.cos(a) * TILE * 0.6, ny = v.y + Math.sin(a) * TILE * 0.6; if (!g.world.walkable(nx, ny)) break; v.x = nx; v.y = ny; g.anim('combat/dust', v.x, v.y, { size: 16, dur: 0.25 }); for (const c of foes(1.2)) if (!c._iaido) { c._iaido = true; hitCreature(g, v, c, base * 2.4, true, { stun: 0.3 }); } }
      for (const c of g.state.creatures) delete c._iaido;
      h.iframes = Math.max(h.iframes || 0, 0.4);
      break;
    }
    case 'regrowth':
      h.regrow = { per: st.maxHp * 0.1, left: 4, tick: 0 };
      flash(2, '#7aff9a');
      break;
    case 'earthsplitter':
      g.anim('combat/poof', v.x, v.y - 6, { size: TILE * 6, dur: 0.45 });
      g.fx.shake = Math.max(g.fx.shake, 2.2);
      for (const c of foes(3.2)) { hitCreature(g, v, c, base * 2, false, { stun: 0 }); daze(c, 1.5); }
      break;
  }
  return true;
}

/** The slash animation in front of you, turned the way you swing (gold on a critical hit). */
function slashFx(g, v, h, w, crit, scale = 1) {
  if (w.ranged) return;
  const reach = (w.range || 1.2) * TILE;
  // alternate swings mirror the slash, so a combo reads as back-and-forth blows
  g.anim(crit ? 'combat/crit_slash' : 'combat/slash', v.x + Math.cos(h.facing) * reach * 0.6, v.y - 12 + Math.sin(h.facing) * reach * 0.6, { size: reach * 1.25 * scale, dur: 0.24, rot: h.facing, flip: h.combo === 2 });
}

/** What a special blade does on top of the blow. */
function bladeSpecial(g, v, c, dmg, sp, finisher) {
  const h = g.hero;
  const now = g.state.time;
  const alive = g.state.creatures.includes(c);
  const st = heroStats(g);
  if (sp.burn && alive) { c._burn = { dps: sp.burn.dps, until: now + sp.burn.secs, by: v.id }; }
  if (sp.bleed && alive && Math.random() < sp.bleed.chance) { c._bleed = { dps: sp.bleed.dps, until: now + sp.bleed.secs, by: v.id }; g.float(c.x, c.y - TILE * 1.3, 'Bleeding', '#ff6a6a'); }
  if (sp.chill && alive) {
    c._chill = { k: sp.chill.k, until: now + sp.chill.secs };
    if (Math.random() < sp.chill.freeze && !CREATURES[c.t]?.boss) { c._stunned = Math.max(c._stunned || 0, 1.8); c._frozen = now + 1.8; g.float(c.x, c.y - TILE * 1.3, 'Frozen!', '#9fd4ff'); }
  }
  if (sp.lifesteal) v.hp = Math.min(st.maxHp, v.hp + dmg * sp.lifesteal);
  if (sp.heal) v.hp = Math.min(st.maxHp, v.hp + sp.heal);
  if (sp.chain) {   // lightning jumps to the closest other foes
    const others = g.state.creatures.filter(o => o !== c && CREATURES[o.t]?.hostile && Math.hypot(o.x - c.x, o.y - c.y) < TILE * sp.chain.range)
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, sp.chain.count);
    let from = c;
    for (const o of others) {
      (g.fx.bolts ||= []).push({ x0: from.x, y0: from.y - 10, x1: o.x, y1: o.y - 10, life: 0.2 });
      hitCreature(g, v, o, dmg * sp.chain.share, false, { stun: 0 });
      from = o;
    }
  }
  if (!alive) {   // the blow was a kill
    if (sp.reap) { v.hp = Math.min(st.maxHp, v.hp + st.maxHp * sp.reap); g.float(v.x, v.y - TILE * 1.4, 'Reaped', '#b0ffb0'); }
    if (sp.plunder) { const gold = sp.plunder[0] + Math.floor(Math.random() * (sp.plunder[1] - sp.plunder[0] + 1)); g.addResource('gold', gold); g.float(c.x, c.y - TILE, `+${gold} gold`, '#ffd76a'); }
  }
  if (sp.twin && alive && g.state.creatures.includes(c)) {
    damageCreature(g, c, dmg * sp.twin, v);
    g.float(c.x + 6, c.y - TILE * 1.1, String(Math.round(dmg * sp.twin)), '#e0e0ff');
    if (!g.state.creatures.includes(c)) { h.kills++; onHeroKill(g, c, v); }
  }
}

function hitCreature(g, v, c, dmg, crit, w) {
  const had = g.state.creatures.includes(c);
  damageCreature(g, c, dmg, v);
  const boss = !!CREATURES[c.t]?.boss;
  if (boss && !c._lastDmg) return;   // it rolled out of the way
  if (boss) dmg = c._lastDmg;
  gainSkill(g, v, 'combat', true);
  g.anim('combat/hit', c.x, c.y - 8, { size: crit ? 34 : 24, dur: 0.24 });
  g.hitStop = crit ? 0.09 : 0.05;
  g.float(c.x + (Math.random() - 0.5) * 10, c.y - TILE * 0.9, String(Math.round(dmg)), crit ? '#ffd76a' : '#ffffff');

  // knockback: sent sliding away from the blow (heavier weapons send them further; bosses barely budge)
  const a = Math.atan2(c.y - v.y, c.x - v.x);
  const push = TILE * (w.stun ? 11 : 7) * (crit ? 1.4 : 1) * (w.finisher ? 1.6 : 1) * (w.kb || 1) * (CREATURES[c.t]?.boss ? 0.2 : 1);
  c._kbx = Math.cos(a) * push; c._kby = Math.sin(a) * push;
  if (w.stun && !CREATURES[c.t]?.boss) c._stunned = Math.max(c._stunned || 0, 1 + w.stun);
  c._whiteFlash = 0.16;
  if (boss) {
    // bosses have poise: blows do not interrupt them. Enough damage in a short time staggers them (a real opening)
    const now = g.state.time;
    if (!c._poiseAt || now - c._poiseAt > 4) c._poise = 0;
    c._poiseAt = now;
    c._poise = (c._poise || 0) + dmg;
    if (c.hp > 0 && c._poise >= maxHp(c) * 0.25 && now > (c._staggerReady || 0)) {
      c._poise = 0;
      c._staggerReady = now + 8;   // not again for a while
      c._stunned = Math.max(c._stunned || 0, 1.1);
      c._windup = 0; c._charge = null;
      g.float(c.x, c.y - TILE * 1.6, 'Staggered!', '#ffd76a');
    }
  } else {
    c._windup = 0; c._charge = null; c._throw = null;   // a hit interrupts their attack, charge or throw
    c._stunned = Math.max(c._stunned || 0, 1);   // and they reel for a moment
  }
  if (had && !g.state.creatures.includes(c)) { g.hero.kills++; onHeroKill(g, c, v); }
}

const CHAOS_KINDS = ['fireball', 'ice_shard', 'lightning_bolt', 'dark_orb', 'magic_bolt', 'plasma', 'banana', 'rocket'];

/** Bows, guns, staffs and thrown weapons: one or more shots in the direction you face. */
function fireShots(g, v, h, w, dmg, crit) {
  const s = w.shot || { kind: 'arrow', speed: 14 };
  const n = s.count || 1;
  for (let i = 0; i < n; i++) {
    const a = h.facing + (n > 1 ? (i - (n - 1) / 2) * (s.spread || 0.2) : (Math.random() - 0.5) * (s.spread || 0));
    const kind = s.kind === 'chaos' ? CHAOS_KINDS[Math.floor(Math.random() * CHAOS_KINDS.length)] : s.kind;
    const chaos = s.kind === 'chaos' ? { explode: Math.random() < 0.4 ? 2.5 : 0, burn: Math.random() < 0.3 ? { dps: 30, secs: 3 } : null, freeze: Math.random() < 0.2 ? 2 : 0, pull: Math.random() < 0.15 } : {};
    (h.arrows ||= []).push({
      ...s, ...chaos, kind, x: v.x + Math.cos(a) * 10, y: v.y - 8 + Math.sin(a) * 6, x0: v.x, y0: v.y - 8,
      vx: Math.cos(a) * TILE * (s.speed || 14), vy: Math.sin(a) * TILE * (s.speed || 14), left: TILE * w.range, range: TILE * w.range,
      dmg, crit, hitIds: [], target: s.homing ? nearestHostile(g, v, TILE * w.range) : null,
    });
  }
  if (s.kind === 'bullet' || s.kind === 'laser' || s.kind === 'rocket' || s.kind === 'plasma') {
    g.anim('combat/hit', v.x + Math.cos(h.facing) * 18, v.y - 10 + Math.sin(h.facing) * 12, { size: 12, dur: 0.1 });   // muzzle flash
    if (w.dmg >= 200) g.fx.shake = Math.max(g.fx.shake, 0.6);
  }
}

/** A blast: damage around a point (and black holes pull everything in). */
function explodeAt(g, v, ar) {
  const r = TILE * ar.explode;
  (g.fx.booms ||= []).push({ x: ar.x, y: ar.y, r, t: 0, pull: !!ar.pull });
  g.fx.shake = Math.max(g.fx.shake, Math.min(3, ar.explode * 0.6));
  for (const c of [...g.state.creatures]) {
    if (!CREATURES[c.t] || CREATURES[c.t].water) continue;
    const d = Math.hypot(c.x - ar.x, c.y - 8 - ar.y);
    if (d > r) continue;
    if (ar.pull) { const a = Math.atan2(ar.y - c.y, ar.x - c.x); c._kbx = Math.cos(a) * TILE * 14; c._kby = Math.sin(a) * TILE * 14; }
    hitCreature(g, v, c, ar.dmg * (1 - d / r * 0.5), ar.crit, { stun: 0.5, kb: ar.pull ? 0 : 1 });
  }
}

function updateArrows(g, v, dt) {
  const h = g.hero;
  if (!h.arrows?.length) return;
  const st = heroStats(g);
  for (const ar of h.arrows) {
    if (ar.homing && ar.target && g.state.creatures.includes(ar.target)) {   // magic curves toward its target
      const want = Math.atan2(ar.target.y - 8 - ar.y, ar.target.x - ar.x), have = Math.atan2(ar.vy, ar.vx);
      let da = want - have; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const turn = Math.max(-ar.homing * dt, Math.min(ar.homing * dt, da)), sp = Math.hypot(ar.vx, ar.vy);
      ar.vx = Math.cos(have + turn) * sp; ar.vy = Math.sin(have + turn) * sp;
    }
    const sx = ar.vx * dt, sy = ar.vy * dt;
    ar.x += sx; ar.y += sy; ar.left -= Math.hypot(sx, sy);
    if (ar.returns && !ar.back && ar.left < ar.range * 0.45) { ar.back = true; ar.hitIds = []; }
    if (ar.back) {   // a boomerang flies home
      const a = Math.atan2(v.y - 8 - ar.y, v.x - ar.x), sp = Math.hypot(ar.vx, ar.vy);
      ar.vx = Math.cos(a) * sp; ar.vy = Math.sin(a) * sp; ar.left = Math.max(ar.left, TILE);
      if (Math.hypot(v.x - ar.x, v.y - 8 - ar.y) < TILE * 0.6) { ar.left = 0; continue; }
    }
    if (ar.kind !== 'laser' && !ar.lob && !g.world.walkable(ar.x, ar.y + 8) && !g.world.isWater(Math.floor(ar.x / TILE), Math.floor((ar.y + 8) / TILE))) {   // a wall
      if (ar.explode) explodeAt(g, v, ar);
      ar.left = 0; continue;
    }
    if (ar.lob) { if (ar.left <= 0) explodeAt(g, v, ar); continue; }   // bombs fly over everything and blow up where they land
    const c = g.state.creatures.find(c => CREATURES[c.t] && !CREATURES[c.t].water && !ar.hitIds.includes(c.id) && Math.hypot(c.x - ar.x, c.y - 8 - ar.y) < TILE * (ar.kind === 'laser' ? 0.8 : 0.6));
    if (c) {
      ar.hitIds.push(c.id);
      const dmg = ar.undead && UNDEAD.has(c.t) ? ar.dmg * ar.undead : ar.dmg;
      if (ar.explode && !ar.explodeAtEnd) { explodeAt(g, v, ar); ar.left = 0; continue; }
      hitCreature(g, v, c, dmg, ar.crit, { stun: ar.freeze || 0, kb: ar.kb || 1 });
      const now = g.state.time, alive = g.state.creatures.includes(c);
      if (alive && ar.burn) c._burn = { dps: ar.burn.dps, until: now + ar.burn.secs, by: v.id };
      if (alive && ar.poison) c._bleed = { dps: ar.poison.dps, until: now + ar.poison.secs, by: v.id };
      if (alive && ar.chill) c._chill = { k: 0.5, until: now + ar.chill };
      if (alive && ar.freeze && !CREATURES[c.t]?.boss) { c._stunned = Math.max(c._stunned || 0, ar.freeze); c._frozen = now + ar.freeze; }
      if (ar.lifesteal) v.hp = Math.min(st.maxHp, v.hp + dmg * ar.lifesteal);
      if (ar.heal) v.hp = Math.min(st.maxHp, v.hp + ar.heal);
      if (ar.explode && ar.explodeAtEnd) { explodeAt(g, v, ar); ar.left = 0; continue; }
      if ((ar.pierce || 0) > 0) ar.pierce--; else ar.left = 0;
    }
    if (ar.left <= 0 && ar.explode && ar.explodeAtEnd && !ar.done) { ar.done = true; explodeAt(g, v, ar); }
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
  if (g.state.rpg?.god) return 0;   // admin god mode
  if (h.inHouse) return 0;   // nothing can hurt you inside your home
  // monsters hit hard, and keep up as your health grows with your level
  const lvl = rpgOf(g).level || 1;
  dmg *= (1 + (ENEMY_DAMAGE - 1) * Math.min(1, (lvl - 1) / 8)) * (0.55 + 0.45 * heroStats(g).maxHp / 100);
  if (g.state.time < DAY_LENGTH && !g.dungeon) dmg *= 0.5;   // your first day in a new world
  if (h.iframes > 0) { g.float(v.x, v.y - TILE * 1.3, 'Dodged!', '#9fd4ff'); return 0; }
  const facingIt = from ? angleDiff(Math.atan2(from.y - v.y, from.x - v.x), h.facing) < 1.8 : true;
  let guarded = false;
  if (h.blocking && facingIt) {
    guarded = true;
    const sh = rpgOf(g).gear.shield;
    const shieldDef = sh ? SHIELDS[sh.base] : null;
    // a guard raised just as the blow lands: a perfect parry (the window is a little wider with a good shield)
    if (g.state.time - (h.blockAt || 0) < 0.12 + (shieldDef?.parry ?? 0.2)) {
      if (from && 'hp' in from && !from.traits) {
        from._stunned = Math.max(from._stunned || 0, CREATURES[from.t]?.boss ? 0.8 : 1.8);
        from._whiteFlash = 0.2; from._windup = 0; from._charge = null;
        const a = Math.atan2(from.y - v.y, from.x - v.x), push = TILE * (CREATURES[from.t]?.boss ? 2 : 9);
        from._kbx = Math.cos(a) * push; from._kby = Math.sin(a) * push;
      }
      h.lastParry = g.state.time;
      g.hitStop = 0.12;
      g.fx.shake = Math.max(g.fx.shake, 0.8);
      g.float(v.x, v.y - TILE * 1.5, 'PERFECT PARRY!', '#ffd76a');
      g.anim('combat/parry', v.x + Math.cos(h.facing) * 10, v.y - 10 + Math.sin(h.facing) * 8, { size: 48, dur: 0.35 });
      g.anim('combat/hit', v.x + Math.cos(h.facing) * 16, v.y - 12 + Math.sin(h.facing) * 10, { size: 30, dur: 0.25 });
      h.riposte = true;   // a rapier strikes back for triple damage
      h.stamina = Math.min(h.maxStamina || 100, (h.stamina || 0) + 10);
      return 0;
    }
    h.stamina -= dmg * 1.2;
    if (shieldDef?.thorns && from && !from.traits && g.state.creatures.includes(from)) damageCreature(g, from, shieldDef.thorns, v);   // spikes bite back
    // what gets through a guard: your shield decides (bare arms stop only half); a broken guard lets more through
    const through = 1 - (sh?.block ?? shieldDef?.block ?? 0.5);
    dmg *= h.stamina > 0 ? through : Math.min(1, through + 0.4);
    g.float(v.x, v.y - TILE * 1.3, 'Blocked', '#d9d4c7');
  }
  dmg *= 1 - heroStats(g).armor;
  h.sinceHit = 0;
  if (dmg > 0 && guarded) {   // behind your guard: no stun, only a small push
    if (from) { const a = Math.atan2(v.y - from.y, v.x - from.x); const push = TILE * Math.min(3, 1 + dmg * 0.05); h.kbx = Math.cos(a) * push; h.kby = Math.sin(a) * push; }
  } else if (dmg > 0) {   // you flash white, reel for a moment and are pushed back from the blow
    // just like the enemies you hit: flash solid white, stunned for a second, knocked back
    v._whiteFlash = 0.16; h.stagger = Math.max(h.stagger || 0, 1);
    if (from) { const a = Math.atan2(v.y - from.y, v.x - from.x); const push = TILE * Math.min(9, 4 + dmg * 0.15); h.kbx = Math.cos(a) * push; h.kby = Math.sin(a) * push; }
  }
  return dmg;
}

/** The person you play never simply dies: they are knocked out and come to at home, a little poorer. */
export function knockOutHero(g, v) {
  const h = g.hero;
  if (!h || h.id !== v.id) return false;
  if (g.state.rpg?.god) { v.hp = Math.max(v.hp, 1); return true; }
  const st = heroStats(g);
  v.hp = Math.round(st.maxHp * 0.4);
  const home = g.center;
  v.x = home.x + 20; v.y = home.y + 20;
  h.iframes = 3; h.dash = null; h.arrows = [];
  const lost = Math.floor((g.state.resources.gold || 0) * 0.1);
  g.state.resources.gold -= lost;
  if (g.dungeon) { g.dungeon.event = 'knockout'; h.iframes = 3; return true; }   // carried back up to the surface
  g.announce('You were knocked out!');
  g.log(`You were knocked out and woke up at home${lost ? `, ${lost} gold poorer` : ''}.`, 'bad');
  g.fx.shake = 2;
  return true;
}

/** Place a torch on the ground in front of you (it lights the area for good); swing at a placed torch to take it back. */
function placeTorch(g, v, h) {
  const list = (g.state.torches ||= []);
  const a = h.facing ?? Math.PI / 2;
  // in front of you, on the middle of that tile (so torches line up neatly, like Minecraft)
  const x = (Math.floor((v.x + Math.cos(a) * TILE) / TILE) + 0.5) * TILE, y = (Math.floor((v.y + Math.sin(a) * TILE) / TILE) + 0.5) * TILE;
  const near = list.find(t => Math.hypot(t.x - x, t.y - y) < TILE * 0.9);
  if (near) {
    g.state.torches = list.filter(t => t !== near);
    giveTool(g, 'torch');
    g.float(near.x, near.y - TILE, '+1 Torch', '#ffe7a0');
    return;
  }
  if (!g.world.walkable(x, y)) { g.float(x, y - TILE, 'No room for a torch', '#cfc6e0'); return; }
  list.push({ x, y });
  dropTool(g, 'torch', 1);
  g.puff({ x, y: y - 10 }, 'effects/spark', 4, 8);
  g.emit('change');
}

/** A tool swung where it has nothing to do: say what it is for (not on every swing). */
function nothingFor(g, v, key) {
  const h = g.hero;
  if (h._hintAt && g.state.time - h._hintAt < 2.5) return;
  h._hintAt = g.state.time;
  g.float(v.x, v.y - TILE * 1.3, `${TOOLS[key].name}: ${TOOLS[key].does}`, '#cfc6e0');
}

const ORE_COLORS = { Uncommon: '#7aff9a', Rare: '#5aa9ff', Epic: '#c77dff', Legendary: '#ffb347', Mythical: '#ff4d6d' };

const ENEMY_DAMAGE = 1.6;

/** Chop, mine or pick the thing in reach: a few hits and it gives double what a worker would get. */
function work(g, v, held = null) {
  const wants = held ? WORK_OF_KIND[TOOLS[held]?.kind] : HAND_WORK;   // an axe only chops, a pickaxe only mines, hands pick plants
  const s = g.state;
  const tx = v.x / TILE, ty = v.y / TILE;
  let obj = null, bd = 1.35;
  for (let y = Math.floor(ty) - 2; y <= Math.floor(ty) + 2; y++) for (let x = Math.floor(tx) - 2; x <= Math.floor(tx) + 2; x++) {
    const o = g.world.objectAt(x, y);
    if (!o || !OBJECTS[o.t]?.work || OBJECTS[o.t].work === 'explore') continue;
    if (wants && !wants.includes(OBJECTS[o.t].work)) continue;
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
  if (def.work === 'cut' && obj.t === 'cactus' && !held) { v.hp -= 2; g.float(v.x, v.y - TILE * 1.2, 'Ouch! Prickly', '#ff9f7a'); }
  const tool = workWith(g, def.work, def.work === 'chop' ? 3 : def.work === 'mine' ? 2 : 1, held);
  if (def.work === 'mine' && !canMine(tool.key, def.tier)) {   // too hard for this pickaxe: it just bounces off
    obj._heroHits = 0;
    flashTool(g, tool.key);
    g.puff(c, 'effects/spark', 4, 8);
    if (!obj._toughAt || s.time - obj._toughAt > 1.2) {
      obj._toughAt = s.time;
      g.float(c.x, c.y - TILE, `Too hard! Needs a ${pickaxeFor(def.tier)} or better`, '#ffb3aa');
    }
    return true;
  }
  if (def.work === 'cut') g.puff(c, 'effects/leaf', 6, 14);   // better tools: fewer swings, more to take home
  flashTool(g, tool.key);
  if (obj._heroHits < tool.hits) return true;
  obj._heroHits = 0;
  // what comes out pops onto the ground; the dice decide how much and whether something special comes too
  const rich = def.work === 'mine' && (obj.rich || lucky(g, 0.12));
  const jackpot = def.work === 'mine' && lucky(g, 0.015);
  for (const k of ['wood', 'stone', 'food', 'coal', 'iron', 'gold', 'gems', 'influence', 'copper', 'silver', 'obsidian', 'mythril', 'frostite', 'magmite', 'jade', 'cobalt', 'moonstone', 'titanium', 'sunstone', 'voidstone']) {
    if (!def[k]) continue;
    let n = Math.round((def[k][0] + Math.floor(Math.random() * (def[k][1] - def[k][0] + 1))) * 2 * tool.yieldMult);
    if (n <= 0) continue;
    if (rich) n *= 2;
    if (jackpot) n *= 2;
    for (let i = 0; i < Math.min(n, 4); i++) popResource(g, k, i === Math.min(n, 4) - 1 ? n - Math.min(n, 4) + 1 : 1, c.x, c.y - 4);
  }
  if (def.work === 'mine') {
    if (jackpot) { g.float(c.x, c.y - TILE * 1.3, rich ? 'JACKPOT! x4' : 'JACKPOT! x2', '#ff9aff'); g.anim?.('effects/jackpot', c.x, c.y - 8, { size: TILE * 3, dur: 0.6 }); g.puff(c, 'effects/spark', 16, 20); g.fx.shake = Math.max(g.fx.shake, 0.8); }
    else if (rich) { g.float(c.x, c.y - TILE * 1.3, 'Rich vein! x2', '#ffd76a'); g.puff(c, 'effects/spark', 8, 14); }
    if (lucky(g, 0.03)) {   // a stray nugget of another ore from these lands
      const ores = (gameTheme(g).ores || []).filter(k => ORE_RESOURCE[k] && k !== obj.t);
      const o = ores[Math.floor(Math.random() * ores.length)];
      if (o) { popResource(g, ORE_RESOURCE[o], 1 + Math.floor(Math.random() * 2), c.x, c.y); g.float(c.x, c.y - TILE * 1.9, 'A stray nugget!', '#9fe0ff'); }
    }
    if (lucky(g, 0.04)) { popResource(g, 'gems', 1, c.x, c.y); g.float(c.x, c.y - TILE * 1.7, 'A hidden gem!', '#9fe0ff'); }
    if (def.rarity && def.rarity !== 'Common' && obj._heroHits === 0) g.float(c.x, c.y - TILE * 2.1, `${def.rarity} ore`, ORE_COLORS[def.rarity] || '#fff');
  } else if (def.work === 'chop') {
    if (lucky(g, 0.1)) { popResource(g, 'food', 2 + Math.floor(Math.random() * 3), c.x, c.y); g.float(c.x, c.y - TILE * 1.6, 'Apples fell!', '#ff8a7a'); }
    if (lucky(g, 0.03)) { popResource(g, 'gold', 3 + Math.floor(Math.random() * 6), c.x, c.y); g.float(c.x, c.y - TILE * 1.9, "A bird's nest with coins!", '#ffd76a'); }
    if (lucky(g, 0.01)) { popResource(g, 'gems', 1, c.x, c.y); g.float(c.x, c.y - TILE * 2.2, 'Amber!', '#ffb347'); }
  }
  if (def.work === 'chop') {
    s.stats.treesCut = (s.stats.treesCut || 0) + 1;
    if (def.stump) { obj.grow = obj.t; obj.t = 'tree_stump'; obj.growAt = s.time + OBJECTS.tree_stump.growDays * DAY_LENGTH; }
    else g.world.removeObject(s.objects, obj);
    g.puff(c, 'effects/leaf', 12, 30);
  } else {
    if (def.work === 'mine') questProgress(g, 'mineType', { type: obj.t, v });
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
  h.stagger = Math.max(0, (h.stagger || 0) - dt);
  if (v._whiteFlash > 0) v._whiteFlash -= dt;
  if (h.stagger > 0) controls = { ...controls, mx: 0, my: 0, act: false, dash: false, block: false };   // stunned by a hit
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
  // standing inside something solid (a building finished around you): step out to the nearest free spot
  if (!ok(v.x, v.y) && !h.dash) {
    const inside = g.buildingAt(Math.floor(v.x / TILE), Math.floor(v.y / TILE));
    const door = inside && BUILDINGS[inside.type]?.housing ? doorOf(g, inside) : null;
    let spot = door && ok(door.x, door.y + 6) ? { x: door.x, y: door.y + 6 } : null;
    const tx = Math.floor(v.x / TILE), ty = Math.floor(v.y / TILE);
    for (let r = 1; r <= 8 && !spot; r++) {
      let best = null, bd = Infinity;
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
        if (!ok(px, py)) continue;
        const d = Math.hypot(px - v.x, py - v.y);
        if (d < bd) { bd = d; best = { x: px, y: py }; }
      }
      spot = best;
    }
    if (spot) { v.x = spot.x; v.y = spot.y; if (g.hero) g.hero.doorCd = 1.2; }
  }

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
    const sp = TILE * 17 * dt * (hasTool(g, 'grappling_hook') ? 1.6 : 1);   // a grappling hook pulls you further
    moveBy(h.dash.dx * sp, h.dash.dy * sp);
    (h.trail ||= []).push({ x: v.x, y: v.y, life: 0.25 });
    h.dash.t -= dt;
    if (h.dash.t <= 0) h.dash = null;
    v._walking = true;
  } else {
    v._walking = len > 0.1;
    if (v._walking) {
      const guardSlow = SHIELDS[rpgOf(g).gear.shield?.base]?.slow ?? 0.45;
      const slowed = (h.slow && g.state.time < h.slow.until ? h.slow.k : 1) * (buffActive(g, 'speed') ? 1.5 : 1);   // webs and ice slow you, a speed potion hurries you
      const sp = WALK_SPEED * 2.1 * speedMult(v) * st.speed * (blocking ? guardSlow : 1) * slowed * dt;
      moveBy(mx * sp, my * sp);
    }
  }
  // knockback slides you and fades quickly
  if (h.kbx || h.kby) {
    moveBy(h.kbx * dt, h.kby * dt);
    const k = Math.exp(-9 * dt); h.kbx *= k; h.kby *= k;
    if (Math.hypot(h.kbx, h.kby) < 4) h.kbx = h.kby = 0;
  }
  for (const p of h.trail || []) p.life -= dt;
  if (h.trail?.length) h.trail = h.trail.filter(p => p.life > 0);
  if (Math.abs(Math.cos(h.facing)) > 0.2) v._flip = Math.cos(h.facing) < 0;

  // stamina comes back when you are not swinging or guarding; health slowly after a while out of harm
  if (!blocking && h.sinceAttack > 0.4 && !h.dash) h.stamina = Math.min(st.maxStamina, h.stamina + 32 * dt * (buffActive(g, 'stamina') ? 2 : 1));
  updateBuffs(g, v, dt);
  if (h.sinceHit > 6 && v.hp < st.maxHp) v.hp = Math.min(st.maxHp, v.hp + 3 * dt);
  h.x = v.x; h.y = v.y;
  // poison and fire keep hurting for a few seconds
  if (h.dot && !h.inHouse) {
    if (g.state.time >= h.dot.until) h.dot = null;
    else {
      v.hp -= h.dot.dps * dt;
      h._dotTick = (h._dotTick || 0) + dt;
      if (h._dotTick > 0.6) { h._dotTick = 0; g.float(v.x + (Math.random() - 0.5) * 8, v.y - TILE, `-${Math.round(h.dot.dps * 0.6)}`, h.dot.color); }
      if (v.hp <= 0) { h.dot = null; knockOutHero(g, v); }
    }
  }
  // walk up into a home's door to go inside
  h.doorCd = Math.max(0, (h.doorCd || 0) - dt);
  if (h.toolFlash) { h.toolFlash.t -= dt; if (h.toolFlash.t <= 0) h.toolFlash = null; }
  if (!g.visiting && !g.dungeon && my < -0.3 && h.doorCd <= 0) {
    const home = homeDoorNear(g, v.x, v.y);
    if (home) { h.doorCd = 1.5; g.emit('house', home); }
  }
  // in someone else's land you only walk (a spy acts through the spy bar; nothing there is yours to take)
  if (g.visiting) return;

  // a quick bite from the stores when hungry (nobody else feeds a ruler on the move)
  if (v.hunger < 35 && g.state.resources.food >= 3) { g.state.resources.food -= 3; v.hunger = 100; g.float(v.x, v.y - TILE * 1.3, 'Ate', '#8fe07a'); }

  // finds are picked up by walking over them
  for (const f of [...(g.state.finds || [])]) {
    if (Math.hypot(f.x - v.x, f.y - v.y) < TILE * 0.9 && collectFind(g, f)) h.finds++;
  }

  // items on the ground go into your pack as you walk over them
  updateDrops(g, dt);
  if (h.regrow && h.regrow.left > 0) { h.regrow.tick -= dt; if (h.regrow.tick <= 0) { h.regrow.tick = 1; h.regrow.left--; v.hp = Math.min(st.maxHp, v.hp + h.regrow.per); g.float(v.x, v.y - TILE * 1.3, `+${Math.round(h.regrow.per)}`, '#7aff9a'); } }
  for (const it of [...(g.state.groundItems || [])]) {
    if ((it.noPickUntil && g.state.time < it.noPickUntil) || it.pickIn > 0) continue;   // just dropped
    const d = Math.hypot(it.x - v.x, it.y - v.y);
    if (d < TILE * 0.7) pickUp(g, v, it);
    else if (d < TILE * 2.6) { const k = Math.min(1, dt * 7); it.x += (v.x - it.x) * k; it.y += (v.y - it.y) * k; }
  }

  // ATTACK: swing your weapon in an arc (or loose an arrow); with nothing to fight nearby it works the land
  if (controls.act && h.atkCd <= 0 && !blocking && !h.dash) attack(g, v, st);
  if (g.hero !== h) return;   // the swing took you somewhere else (into a dungeon or a house)
  updateArrows(g, v, dt);
  updateQuests(g);
  updateTreasure(g, dt, v);
  if (controls.potion) drinkPotion(g, v);

  // people nearby are inspired: a spark over their heads now and then
  h.inspire -= dt;
  if (h.inspire <= 0) {
    h.inspire = 2.5;
    for (const o of g.state.villagers) if (o._task?.phase === 'work' && inspired(g, o) && Math.random() < 0.35) g.puff({ x: o.x, y: o.y - TILE }, 'effects/spark', 1, 4);
  }

  if (!g.dungeon) updateBounties(g, v);
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
