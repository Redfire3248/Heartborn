import { SAVE_VERSION, TILE } from '../core/constants.js';
import { World, populateWorld } from './world.js';
import { makeVillager } from './villagers.js';

/** Brand-new village: 3 ordinary humans and nothing else. */
export function newState({ uid, name, villageName }) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const world = new World(seed);
  const { objects, creatures, start } = populateWorld(world);

  const state = {
    version: SAVE_VERSION,
    seed,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    owner: { uid, name, villageName },
    time: 90 * 0.3,          // dawn of day one
    center: start,
    resources: { food: 25, wood: 15, stone: 10, coal: 0, iron: 0, weapons: 0, bombs: 0, gold: 0, gems: 0, science: 0, influence: 20 },
    karma: 0,
    era: 0,
    villagers: [],
    buildings: [],
    objects,
    creatures,
    stats: { births: 0, deaths: 0, treesCut: 0, raidsWon: 0, raidsLost: 0, events: 0, maxPop: 3, relics: 0 },
    log: [],
    // a new village's founding spirit: faster work and more wanderers for the first three days
    modifiers: [{ id: 'founding_spirit', work: 0.5, join: 0.25, happy: 10, until: 90 * 3 }],
    goals: { claimed: [], chests: [] },
    finds: [],
    tradeFix: 1,
    toolsGiven: 1,
    skillsGiven: 1,
    incoming: [],
    court: {},
    tutorial: { step: 0, done: false },
    laws: { government: 'council', economy: 'barter', military: 'peace', faith: 'old_gods' },
    lawChangedAt: {},
    nextEventAt: 90 * 1.2,
    lastDay: 0,
    shieldUntil: Date.now() + 3 * 24 * 3600 * 1000,
    lastRaidAt: 0,
    camera: { x: start.x, y: start.y, zoom: 2 },
  };

  // the founders: a warrior who will be king, a blacksmith and a woodcutter, each with the tools of their trade
  const founders = [
    { sex: 'm', age: 26, profession: 'warrior', job: 'warrior', skill: ['combat', 5], pack: { sword: 1 }, trained: true, traits: ['brave'] },
    { sex: 'm', age: 24, profession: 'smith', job: 'smith', skill: ['craft', 4], pack: { hammer: 1 } },
    { sex: 'f', age: 21, profession: 'chop', job: 'chop', skill: ['chop', 4], pack: { axe: 1 } },
  ];
  founders.forEach((f, i) => {
    const v = makeVillager(state, { sex: f.sex, age: f.age });
    v.x = start.x + (i - 1) * TILE;
    v.y = start.y + TILE * 0.5;
    v.job = f.job;
    v.profession = f.profession;
    v.skills[f.skill[0]] = f.skill[1];
    v.inv.pack = { ...f.pack };
    v.trained = !!f.trained;
    v.traits = f.traits || [];
    state.villagers.push(v);
  });
  state.ruler = { heirId: state.villagers[0].id };   // the warrior is crowned first
  return state;
}

/** Strip transient runtime fields (keys starting with "_") for saving. */
export function serialize(state) {
  return JSON.stringify(state, (k, v) => (k.startsWith('_') ? undefined : v));
}

export function deserialize(json) {
  const state = typeof json === 'string' ? JSON.parse(json) : json;
  // future migrations go here, keyed on state.version
  state.version = SAVE_VERSION;
  state.modifiers ||= [];
  state.goals ||= { claimed: [], chests: [] };
  state.goals.chests ||= [];
  state.finds ||= [];
  state.incoming ||= [];
  state.court ||= {};
  state.tutorial ||= { step: 0, done: true };   // saves from before the tutorial skip it
  state.resources.weapons ??= 0;
  state.resources.bombs ??= 0;
  state.resources.science ??= 0;
  for (const v of state.villagers || []) v.skills.stealth ??= 0;
  for (const v of state.villagers || []) v.skills.craft ??= 0;
  state.laws ||= { government: 'council', economy: 'barter', military: 'peace', faith: 'old_gods' };
  state.lawChangedAt ||= {};
  state.stats ||= {};
  state.log ||= [];
  return state;
}
