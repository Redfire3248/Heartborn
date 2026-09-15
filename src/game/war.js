import { TILE, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { chance, clamp, pick, irange } from '../core/rng.js';
import { WARBAND_NAMES } from '../data/objects.js';

/*
 * Armies march on villages — barbarian warbands (local, game time) and other players
 * (multiplayer, real time; see net/multiplayer.js). Scouts and watchtowers see them coming.
 * When an army arrives its soldiers appear in the world as "invader" creatures tagged with
 * an attackId; the battle ends when none of them are left (killed or fled with loot).
 */

export const SIGHT_RANGE = 420;   // seconds before arrival an army can first be spotted
export const SWEEP_SECONDS = 20;  // scouts get one chance to spot each army per sweep
export const DUST_SECONDS = 10;   // everyone sees the dust cloud at the very end

/**
 * Chance per sweep that the borders are watched well enough to spot a marching army.
 * A realm that invests in scouts sees armies coming; one that doesn't gets ambushed.
 */
export function spotChance(g) {
  const scouts = g.state.villagers.filter(v => v.job === 'scout' && !v.away && v.age >= ADULT_AGE).length;
  const towers = g.builtBuildings().filter(b => b.type === 'watchtower').length;
  return clamp(0.04 + scouts * 0.12 + towers * 0.08 + (g.hasBuilding('castle') ? 0.05 : 0) + (g.spotBonus || 0), 0.04, 0.9);
}

export function scoutSummary(g) {
  const scouts = g.state.villagers.filter(v => v.job === 'scout' && !v.away).length;
  const towers = g.builtBuildings().filter(b => b.type === 'watchtower').length;
  return { scouts, towers, chance: spotChance(g) };
}

/** Roll a scouting sweep for one army. `track` remembers when the next sweep happens (same clock as `now`). */
export function trySpot(g, remaining, track, now) {
  if (remaining > SIGHT_RANGE) return false;
  if (remaining <= DUST_SECONDS) return true;
  if (now < (track.nextSweep || 0)) return false;
  track.nextSweep = now + SWEEP_SECONDS;
  return Math.random() < spotChance(g);
}

/** Called once per in-game day. */
export function maybeScheduleWarband(g) {
  const s = g.state;
  const pop = s.villagers.length;
  if (pop < 7 || g.day < 6 || s.incoming.some(i => i.kind === 'warband')) return;
  if (!chance(0.09 + s.era * 0.04)) return;
  s.incoming.push({
    id: `w${Date.now().toString(36)}${irange(0, 999)}`,
    kind: 'warband',
    name: pick(WARBAND_NAMES),
    // real armies: they grow with your village and your era
    count: clamp(4 + Math.floor(pop / 4) + s.era * 3, 4, 80),
    scale: 0.85 + s.era * 0.15,
    arrivesAt: s.time + DAY_LENGTH * (0.5 + Math.random() * 1.2),
    warned: false,
  });
}

export function updateWar(g, dt) {
  const s = g.state;
  for (const inc of [...s.incoming]) {
    const remaining = inc.arrivesAt - s.time;
    if (!inc.warned && trySpot(g, remaining, inc, s.time)) {
      inc.warned = true;
      if (!g.offline) {
        g.emit('scoutReport', { ...inc, kind: 'warband', seconds: Math.max(0, remaining), ref: inc });
        g.log(remaining <= DUST_SECONDS
          ? `Dust on the horizon — ${inc.name} is almost upon us! Nobody saw them coming.`
          : `Scouts report: ${inc.name} (${inc.count} soldiers) marches on the village!`, 'bad');
      }
      if (g.autoRally && !s.rallied) rally(g);
    }
    if (remaining <= 0) {
      s.incoming = s.incoming.filter(x => x !== inc);
      spawnArmy(g, { id: inc.id, kind: 'warband', name: inc.name, count: inc.count, scale: inc.scale });
    }
  }

  // battle bookkeeping
  s.battles ||= {};
  for (const [id, b] of Object.entries(s.battles)) {
    const alive = s.creatures.some(c => c.attackId === id);
    if (alive) continue;
    delete s.battles[id];
    const plundered = Object.values(b.loot || {}).some(v => v > 0);
    const result = { id, kind: b.kind, name: b.name, defenderWon: !plundered, loot: b.loot || {}, killed: b.killed || 0, spawned: b.spawned };
    if (b.kind === 'warband') {
      if (result.defenderWon) {
        const inf = g.addResource('influence', 5 + b.spawned * 2);
        g.log(`${b.name} was driven off! ${b.killed} of their soldiers fell. +${inf} influence`, 'good');
        if (!g.offline) g.announce(`Victory over ${b.name}!`);
      } else {
        g.log(`${b.name} plundered the village and escaped.`, 'bad');
      }
    }
    g.emit('battleEnd', result);
    g.emit('change');
  }

  // stand the militia down once the danger has passed
  if (s.rallied && !Object.keys(s.battles).length && !s.incoming.some(i => i.warned) && !(g.mpThreats?.length)) {
    s.rallied.calm = (s.rallied.calm || 0) + dt;
    if (s.rallied.calm > 15) standDown(g);
  } else if (s.rallied) {
    s.rallied.calm = 0;
  }
}

export function spawnArmy(g, { id, kind, name, count, scale }) {
  const s = g.state;
  const base = g.randomLandTile(14, 19) || g.center;
  for (let i = 0; i < count; i++) {
    const type = kind === 'warband' && i % 3 === 2 ? 'bandit' : 'invader';
    const c = g.spawnCreature(type, base.x + (Math.random() - 0.5) * TILE * 3, base.y + (Math.random() - 0.5) * TILE * 3,
      { raid: true, born: s.time, attackId: id });
    if (c) { c.scale = scale; c.hp = null; if (kind === 'player' && s.era >= 4) c.sprite = s.era >= 6 ? 'units/robot_soldier' : 'units/rifleman'; }
  }
  s.battles ||= {};
  s.battles[id] = { kind, name, spawned: count, killed: 0, loot: {}, startedAt: s.time };
  if (!g.offline) {
    g.announce(`⚔ ${name} attacks!`);
    g.fx.shake = 1.2;
  }
  g.log(`${name} has reached the village with ${count} soldiers!`, 'bad');
  g.emit('change');
}

/** Every able adult picks up a weapon. */
/** Someone whose occupation is fighting. */
export const isSoldier = v => v.calling === 'soldier' || v.trained || v.job === 'recruit' || v.job === 'warrior';

export function rally(g) {
  const s = g.state;
  let n = 0;
  for (const v of s.villagers) {
    if (v.away || v.office || v.ruling || v.age < ADULT_AGE || v.hp < 30 || v.job === 'warrior' || v.job === 'scout') continue;
    // only soldiers answer the call: the Soldier calling, trained fighters and recruits — farmers keep farming
    if (!isSoldier(v)) continue;
    v.prevJob = v.job;
    v.job = 'warrior';
    v._task = null;
    n++;
  }
  s.rallied = { at: s.time, calm: 0 };
  const armed = s.villagers.filter(v => v.prevJob && s.resources.weapons > 0 && !v.armed && (s.resources.weapons -= 1, v.armed = true)).length;
  g.log(`The militia is called! ${n} villagers take up arms${n ? ` (${armed} with real weapons)` : ''}.`, 'event');
  g.emit('change');
  return n;
}

export function standDown(g) {
  const s = g.state;
  for (const v of s.villagers) {
    if (v.prevJob) {
      if (v.armed && v.prevJob !== 'warrior') { v.armed = false; s.resources.weapons += 1; }
      v.job = v.prevJob; delete v.prevJob; v._task = null;
    }
  }
  s.rallied = null;
  g.log('The militia stands down and returns to work.', 'info');
  g.emit('change');
}

export function tributeCost(g) {
  const r = g.state.resources;
  return { food: Math.floor(r.food * 0.3), gold: Math.floor(r.gold * 0.3) };
}

/** Buy off a barbarian warband before it arrives. */
export function payWarbandTribute(g, inc) {
  const s = g.state;
  if (!s.incoming.includes(inc)) return { error: 'They are already here!' };
  const cost = tributeCost(g);
  g.spend(cost);
  s.incoming = s.incoming.filter(x => x !== inc);
  g.log(`Paid ${cost.food} food and ${cost.gold} gold to ${inc.name}. They turn back… for now.`, 'event');
  g.emit('change');
  return { text: `${inc.name} takes the tribute and leaves.` };
}
