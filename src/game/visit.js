import { DAY_LENGTH, SAVE_VERSION, TILE } from '../core/constants.js';
import { World, populateWorld } from './world.js';
import { Game } from './game.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { DEFAULT_LAWS } from '../data/laws.js';

/** Compact public snapshot of a village so other players can come and look at it. */
export function villageSnapshot(g) {
  const s = g.state;
  return {
    // Firestore does not allow nested arrays, so each entry is a compact comma string
    buildings: s.buildings.slice(0, 250).map(b => [b.type, b.tx, b.ty, b.built ? 1 : 0].join(',')),
    villagers: s.villagers.filter(v => !v.away).slice(0, 80).map(v => [Math.round(v.x), Math.round(v.y), v.sex, Math.floor(v.age), v.job, v.role || ''].join(',')),
    time: Math.round(s.time),
  };
}

/**
 * A read-only copy of another player's land, rebuilt from their seed and snapshot.
 * The island is regenerated from the seed; villagers wander around their homes.
 */
export function makeVisitGame(profile) {
  if (!profile?.seed || !profile.snapshot) throw new Error(`${profile?.villageName || 'That realm'} has not been mapped yet — they need to play once more.`);
  const world = new World(profile.seed);
  const { objects, start } = populateWorld(world);
  const snap = profile.snapshot;

  const split = e => (Array.isArray(e) ? e : String(e).split(','));
  const buildings = (snap.buildings || []).map(split).map(([type, tx, ty, built], i) => ({ id: `vb${i}`, type, tx: Number(tx), ty: Number(ty), built: built === 1 || built === '1', progress: 1 }))
    .filter(b => BUILDINGS[b.type]);
  const covered = new Set();
  for (const b of buildings) {
    const size = sizeOf(b);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) covered.add(`${b.tx + x},${b.ty + y}`);
  }

  const villagers = (snap.villagers || []).map(split).map(([x, y, sex, age, job, role], i) => ({
    id: `vv${i}`, name: '', sex, age: Number(age), x: Number(x), y: Number(y), hp: 100, hunger: 100, happy: 70,
    skills: { chop: 3, mine: 3, gather: 3, farm: 3, fish: 3, hunt: 3, build: 3, combat: 3 },
    traits: [], job: job === 'warrior' || job === 'scout' ? job : 'idle', role: role || null, partner: null, parents: null, gen: 1, sick: 0,
  }));

  const state = {
    version: SAVE_VERSION, seed: profile.seed, createdAt: 0, updatedAt: 0,
    owner: { uid: profile.uid, name: profile.name, villageName: profile.villageName },
    time: DAY_LENGTH * 0.4, center: start,
    resources: { food: 999, wood: 0, stone: 0, coal: 0, iron: 0, gold: 0, gems: 0, influence: 0 },
    karma: profile.karma || 0, era: profile.era || 0,
    villagers, buildings,
    objects: objects.filter(o => !covered.has(`${o.x},${o.y}`)),
    creatures: [], stats: {}, log: [], modifiers: [], incoming: [], battles: {},
    laws: { ...DEFAULT_LAWS }, lawChangedAt: {},
    nextEventAt: Infinity, lastDay: 0, shieldUntil: 0,
    camera: { x: start.x, y: start.y, zoom: 2 },
  };

  const g = new Game(state);
  g.offline = true;        // no logs, events or effects
  g.visiting = true;
  // keep the view calm: no wildlife raids or births while you look around
  g.newDay = () => {};
  return g;
}

export function visitCenter(g) {
  const fire = g.state.buildings.find(b => b.type === 'campfire');
  if (fire) return g.buildingCenter(fire);
  if (g.state.buildings.length) return g.buildingCenter(g.state.buildings[0]);
  return g.state.center || { x: 48 * TILE, y: 48 * TILE };
}
