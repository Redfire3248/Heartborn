import { ADULT_AGE, DAY_LENGTH, TILE } from '../core/constants.js';
import { clamp, chance, pick } from '../core/rng.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { CREATURES } from '../data/objects.js';
import { has, onVillagerGone } from './dynasty.js';

/*
 * Intrigue: traitors inside the realm, bombs, spies and the machines of the modern ages.
 */

export const SPY_SKILL = 3;
export const isSpy = v => v.job === 'spy' && (v.skills.stealth || 0) >= SPY_SKILL;

const sum = (g, key) => g.builtBuildings().reduce((n, b) => n + (BUILDINGS[b.type][key] || 0), 0);

export function counterIntel(g) {
  const spymaster = g.state.court?.spymaster?.id ? 0.2 : 0;
  return clamp(0.08 + sum(g, 'counterIntel') + spymaster + (g.spotBonus || 0) * 0.3, 0, 0.85);
}

// ------------------------------------------------------------------ traitors

export function suspicion(v) { return v.suspicion || 0; }

/** Once a day: resentment turns people, traitors act, watchers notice. */
export function dailyTraitors(g) {
  const s = g.state;
  const watch = 0.05 + sum(g, 'traitorWatch') + (s.court?.spymaster?.id ? 0.2 : 0)
    + s.villagers.filter(v => v.office && has(v, 'honest')).length * 0.04;

  for (const v of [...s.villagers]) {
    if (v.age < ADULT_AGE || v.ruling || v.robot || v.jailed) continue;

    // resentment breeds treachery
    const bitter = has(v, 'greedy') || has(v, 'cruel') || has(v, 'ambitious');
    if (!v.traitor && !has(v, 'loyal') && v.happy < 25 && (bitter ? chance(0.06) : chance(0.01))) v.traitor = true;
    if (!v.traitor) continue;

    // traitors act in the dark
    if (chance(0.3)) {
      const act = pick(['steal', 'steal', 'sabotage', 'leak']);
      if (act === 'steal') {
        const hidden = sum(g, 'vault') ? 0.5 : 1;
        const n = Math.floor(s.resources.gold * 0.12 * hidden);
        if (n > 0) { s.resources.gold -= n; g.log(`${n} gold went missing from the treasury…`, 'bad'); }
      } else if (act === 'sabotage') {
        const target = pick(g.builtBuildings().filter(b => !['campfire', 'grave'].includes(b.type)));
        if (target) damageBuilding(g, target, 'A fire broke out at the');
      } else {
        s.leaks = (s.leaks || 0) + 1;   // enemy spies will find it easier
      }
    }

    // the watchers notice
    if (chance(watch)) {
      v.suspicion = Math.min(100, (v.suspicion || 0) + 40);
      if (v.suspicion >= 80 && !v.exposed) {
        v.exposed = true;
        g.log(`${v.name} has been exposed as a TRAITOR!`, 'bad');
        g.announce(`🗡 ${v.name} is a traitor!`);
      } else if (!v.exposed) {
        g.log(`Whispers say ${v.name} is behaving suspiciously.`, 'event');
      }
    }
  }
  s.leaks = Math.max(0, (s.leaks || 0) - 0.2);
}

/** Accuse someone. Right: they are exposed. Wrong: an innocent is shamed. */
export function accuse(g, v) {
  if (v.traitor) {
    v.exposed = true;
    v.suspicion = 100;
    g.addResource('influence', 10);
    g.log(`The accusation is true: ${v.name} confesses to treason! +10 influence`, 'good');
    return { text: `${v.name} is a traitor!` };
  }
  v.happy = clamp(v.happy - 25, 0, 100);
  v.suspicion = 0;
  for (const x of g.state.villagers) x.happy = clamp(x.happy - 4, 0, 100);
  g.addKarma(-2);
  g.log(`${v.name} was falsely accused. The people are uneasy.`, 'bad');
  return { text: `${v.name} was innocent.` };
}

export function punishTraitor(g, v, how) {
  const s = g.state;
  switch (how) {
    case 'imprison':
      if (!g.hasBuilding('prison') && !g.hasBuilding('jail')) return { error: 'Build a Jail or Prison first' };
      v.jailed = true;
      v.traitor = false;
      v.job = 'prisoner';
      v._task = null;
      g.log(`${v.name} is locked away.`, 'event');
      break;
    case 'exile':
      s.villagers = s.villagers.filter(x => x !== v);
      onVillagerGone(g, v);
      g.log(`The traitor ${v.name} is banished from the realm.`, 'event');
      break;
    case 'execute':
      g.addKarma(v.traitor ? -3 : -12);
      g.killVillager(v, v.traitor ? 'was executed for treason' : 'was executed — though innocent');
      break;
    case 'pardon':
      v.suspicion = 0;
      v.exposed = false;
      v.happy = clamp(v.happy + 30, 0, 100);
      v.jailed = false;
      if (v.job === 'prisoner') v.job = 'idle';
      if (chance(0.4)) { v.traitor = false; if (!has(v, 'loyal')) v.traits.push('loyal'); g.log(`Moved by mercy, ${v.name} swears loyalty.`, 'good'); }
      else g.log(`${v.name} is pardoned.`, 'event');
      g.addKarma(2);
      break;
  }
  g.emit('change');
  return { ok: true };
}

export function damageBuilding(g, b, prefix = 'Sabotage at the') {
  const def = BUILDINGS[b.type];
  if (!def) return;
  if (sizeOf(b) >= 3 || chance(0.4)) {
    b.built = false;
    b.progress = 0.35;   // needs rebuilding
    g.log(`${prefix} ${def.name}! It must be repaired.`, 'bad');
  } else {
    g.state.buildings = g.state.buildings.filter(x => x !== b);
    g.log(`${prefix} ${def.name}! It burned to the ground.`, 'bad');
  }
  g.puff(g.buildingCenter(b), 'effects/flame', 14);
  g.recalc();
  g.emit('change');
}

export function destroyBuildings(g, n, cause) {
  const targets = g.builtBuildings().filter(b => !['campfire'].includes(b.type));
  for (let i = 0; i < n && targets.length; i++) {
    const b = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
    damageBuilding(g, b, cause);
  }
}

// ------------------------------------------------------------------ bombs

/** Blast a point: heavy damage to every hostile creature nearby. */
export function blast(g, x, y, power = 70, radius = TILE * 1.8) {
  let hits = 0;
  for (const c of [...g.state.creatures]) {
    if (!CREATURES[c.t]?.hostile) continue;
    if (Math.hypot(c.x - x, c.y - y) > radius) continue;
    c.hp = (c.hp ?? CREATURES[c.t].hp) - power;
    c._hurtFlash = 0.3;
    if (c.hp <= 0) {
      g.state.creatures = g.state.creatures.filter(k => k !== c);
      const battle = c.attackId && g.state.battles?.[c.attackId];
      if (battle) battle.killed = (battle.killed || 0) + 1;
    }
    hits++;
  }
  g.puff({ x, y }, 'effects/explosion', 10, 30);
  g.puff({ x, y }, 'effects/smoke', 8, 40);
  g.fx.shake = Math.max(g.fx.shake, 1.2);
  return hits;
}

/** Cannon towers fire bombs at clusters of invaders during a battle. */
export function updateBombDefense(g, dt) {
  const s = g.state;
  if (!sum(g, 'bombDefense') || s.resources.bombs < 1) return;
  if (!Object.keys(s.battles || {}).length && !s.creatures.some(c => c.raid && CREATURES[c.t]?.hostile)) return;
  g._bombTimer = (g._bombTimer || 0) - dt;
  if (g._bombTimer > 0) return;
  g._bombTimer = 4 / sum(g, 'bombDefense');
  const cen = g.center;
  const foes = s.creatures.filter(c => c.raid && CREATURES[c.t]?.hostile && Math.hypot(c.x - cen.x, c.y - cen.y) < TILE * 14);
  if (!foes.length) return;
  // aim where the most invaders stand together
  const target = foes.map(c => [c, foes.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < TILE * 1.8).length]).sort((a, b) => b[1] - a[1])[0][0];
  s.resources.bombs -= 1;
  const hits = blast(g, target.x, target.y, 60);
  if (!g.offline) g.float(target.x, target.y - TILE, `💥 Cannon fire! ${hits} hit`, '#ffb44a');
}

export function throwBomb(g, target) {
  if (g.state.resources.bombs < 1) return { error: 'No bombs — build a Powder Mill' };
  g.state.resources.bombs -= 1;
  const hits = blast(g, target.x, target.y, 90);
  return { text: `Boom! ${hits} enemies caught in the blast.` };
}

// ------------------------------------------------------------------ the future

/** Robot factories build robot workers. */
export function dailyMachines(g) {
  const s = g.state;
  const cap = sum(g, 'robots');
  const robots = s.villagers.filter(v => v.robot).length;
  if (robots < cap && chance(0.5)) {
    const v = g.addWanderer();
    v.robot = true;
    v.name = `Unit-${Math.floor(100 + Math.random() * 900)}`;
    v.age = 20;
    v.traits = ['hardworking', 'loyal'];
    v.skills = Object.fromEntries(Object.keys(v.skills).map(k => [k, 4]));
    v.skills.stealth = 0;
    v.job = 'build';
    g.log(`The Robot Factory activates ${v.name}.`, 'good');
  }
  const science = sum(g, 'fertility');
  if (science) s.modifiers.push({ id: 'cloning', fertility: science, until: s.time + DAY_LENGTH });
}

export const hasMissiles = g => g.builtBuildings().some(b => BUILDINGS[b.type].missile);
export const hasOrbital = g => g.builtBuildings().some(b => BUILDINGS[b.type].orbital);
export const MISSILE_COST = { science: 200, iron: 60, bombs: 10 };

/** How far an aimed strike reaches, in tiles. */
export const strikeRadius = orbital => (orbital ? 5 : 3.5);

/** The seconds a missile takes to fall once it appears over the target. */
export const STRIKE_FALL = 2.4;

/**
 * A missile coming down on this realm. With an aim point it falls there (a warning ring shows where)
 * and hits everything in its radius; without one it hits at random, like before.
 */
export function sufferStrike(g, from, orbital, aim = null) {
  if (g.builtBuildings().some(b => BUILDINGS[b.type].missileShield)) {
    g.log(`A missile from ${from} was destroyed by the Shield Generator!`, 'good');
    g.announce('🛡 Missile intercepted!');
    return { blocked: true };
  }
  if (!aim || !Number.isFinite(aim.tx) || !Number.isFinite(aim.ty)) return randomStrike(g, from, orbital);
  if (g.offline) return landStrike(g, { from, orbital, tx: aim.tx, ty: aim.ty });
  (g.strikes ||= []).push({ from, orbital, tx: aim.tx, ty: aim.ty, life: STRIKE_FALL, max: STRIKE_FALL });
  g.announce(`☢ Incoming ${orbital ? 'orbital strike' : 'missile'} from ${from}!`);
  g.log(`☢ A ${orbital ? 'beam from orbit' : 'missile'} from ${from} is coming down!`, 'bad', { x: (aim.tx + 0.5) * TILE, y: (aim.ty + 0.5) * TILE });
  return { blocked: false, pending: true };
}

/** Advance falling missiles; each one hits when its timer runs out. */
export function updateStrikes(g, dt) {
  if (!g.strikes?.length) return;
  for (const st of g.strikes) {
    st.life -= dt;
    if (st.life <= 0 && !st.hit) { st.hit = true; st.result = landStrike(g, st); st.flash = 0.7; }
    if (st.hit) st.flash -= dt;
  }
  g.strikes = g.strikes.filter(st => !st.hit || st.flash > 0);
}

/** The blast itself: every building and person within the radius of the aim point. */
export function landStrike(g, { from, orbital, tx, ty }) {
  const s = g.state;
  const r = strikeRadius(orbital);
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  const shelter = sum(g, 'shelter') ? 0.5 : 1;
  const hitB = s.buildings.filter(b => {
    const c = g.buildingCenter(b);
    return Math.hypot(c.x - cx, c.y - cy) <= (r + sizeOf(b) / 2) * TILE;
  });
  const cause = `${orbital ? 'An orbital strike' : 'A missile'} from ${from} hit the`;
  let destroyed = 0;
  for (const b of hitB) {
    const c = g.buildingCenter(b);
    const close = Math.hypot(c.x - cx, c.y - cy) <= r * TILE * 0.5;
    if (close && b.type !== 'campfire') {
      s.buildings = s.buildings.filter(x => x !== b);
      g.log(`${cause} ${BUILDINGS[b.type]?.name || 'building'}! Nothing is left.`, 'bad');
      g.puff(c, 'effects/flame', 16);
    } else {
      b.built = false;
      b.progress = Math.min(b.progress ?? 1, 0.35);
      g.log(`${cause} ${BUILDINGS[b.type]?.name || 'building'}! It must be rebuilt.`, 'bad');
      g.puff(c, 'effects/flame', 10);
    }
    destroyed++;
  }
  const victims = s.villagers.filter(v => !v.away && Math.hypot(v.x - cx, v.y - cy) <= r * TILE && Math.random() < 0.85 * shelter);
  for (const v of victims) g.killVillager(v, `died in the ${orbital ? 'orbital strike' : 'missile strike'} from ${from}`);
  // the land itself burns: trees and rocks near the centre are gone
  s.objects = s.objects.filter(o => Math.hypot((o.x + 0.5) * TILE - cx, (o.y + 0.5) * TILE - cy) > r * TILE * 0.6);
  blast(g, cx, cy, 400, r * TILE);
  for (let i = 0; i < 3; i++) g.puff({ x: cx + (Math.random() - 0.5) * TILE * r, y: cy + (Math.random() - 0.5) * TILE * r }, 'effects/flame', 12);
  g.recalc();
  g.fx.shake = orbital ? 6 : 4;
  g.announce(from === OWN
    ? `☢ Impact! ${blastHits(destroyed, victims.length)}`
    : `☢ ${from} struck your realm! ${blastHits(destroyed, victims.length)}`);
  g.emit('change');
  return { blocked: false, buildings: destroyed, dead: victims.length };
}

const OWN = 'your own silo';
const blastHits = (b, d) => `${b} building${b === 1 ? '' : 's'} hit, ${d} dead`;

/**
 * Fire at your own land: clear monsters, raiders, rocks and forest, or knock down what you no longer want.
 * Costs the same as a strike abroad, but only a little karma (and the Shield Generator does not stop your own).
 */
export function strikeOwnLand(g, orbital, aim) {
  if (orbital ? !hasOrbital(g) : !hasMissiles(g)) return { error: `You need a ${orbital ? 'Orbital Cannon' : 'Missile Silo'}` };
  if (!aim || aim.tx < 0 || aim.ty < 0 || aim.tx >= g.world.w || aim.ty >= g.world.h) return { error: 'Pick a spot on your land' };
  if (!g.spend(MISSILE_COST)) return { error: `Needs ${Object.entries(MISSILE_COST).map(([k, n]) => `${n} ${k}`).join(', ')}` };
  g.addKarma(-3);
  (g.strikes ||= []).push({ from: OWN, orbital, tx: aim.tx, ty: aim.ty, life: STRIKE_FALL, max: STRIKE_FALL });
  g.log(`☢ ${orbital ? 'The Orbital Cannon fires' : 'A missile launches'} at our own land. −3 karma.`, 'event', { x: (aim.tx + 0.5) * TILE, y: (aim.ty + 0.5) * TILE });
  g.emit('change');
  return { ok: true };
}

/** What an aim point would hit right now (for the targeting screen). */
export function strikePreview(buildings, villagers, tx, ty, orbital, center) {
  const r = strikeRadius(orbital);
  const b = buildings.filter(x => { const c = center(x); return Math.hypot(c.x / TILE - (tx + 0.5), c.y / TILE - (ty + 0.5)) <= r + sizeOf(x) / 2; });
  const v = villagers.filter(x => Math.hypot(x.x / TILE - (tx + 0.5), x.y / TILE - (ty + 0.5)) <= r).length;
  return { buildings: b, people: v };
}

function randomStrike(g, from, orbital) {
  const s = g.state;
  const shelter = sum(g, 'shelter') ? 0.5 : 1;
  destroyBuildings(g, orbital ? 5 : 3, 'A missile struck the');
  const dead = Math.round((orbital ? 8 : 4) * shelter);
  const victims = [...s.villagers].sort(() => Math.random() - 0.5).slice(0, dead);
  for (const v of victims) g.killVillager(v, `died in the ${orbital ? 'orbital strike' : 'missile strike'} from ${from}`);
  g.fx.shake = 3;
  g.announce(`☢ ${from} struck your realm!`);
  return { blocked: false, dead: victims.length };
}
