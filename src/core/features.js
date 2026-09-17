import { BUILDINGS } from '../data/buildings.js';

/*
 * Which parts of the game are switched on. Systems switched off keep all their code (nothing is deleted):
 * their menus, buildings, pop-ups and daily upkeep simply stay out of the game until switched back on here.
 */
export const FEATURES = {
  people: false,        // People & Jobs menu (villagers are set aside in solo mode)
  court: false,         // Court: officials and offices
  laws: false,          // Laws menu
  empire: false,        // kingdoms, diplomacy, vassals
  chronicle: false,     // the event log menu
  storyEvents: false,   // pop-up story events with choices
  goals: false,         // the era goals list
  tutorial: false,      // the step-by-step tutorial
  autoPick: false,      // automatic appointments and laws (and their messages)
  sailing: false,       // boats, the Open Sea, invasions by sea
  spies: false,         // spy missions, infiltration, traitors
  missiles: false,      // missile silos, orbital cannons, strikes
  housesOnly: true,     // the build menu offers homes only (every kind, from the start)
  notifications: false, // the bell, the message feed and pop-up toasts about events
  warbands: false,      // barbarian armies marching on your land (and their warnings)
};

export const on = key => FEATURES[key] !== false;

/** Buildings that only belong to switched-off systems stay out of the build menu. */
export const BUILDING_FEATURE = {
  shipyard: 'sailing',
  spy_den: 'spies',
  missile_silo: 'missiles', orbital_cannon: 'missiles',
  courthouse: 'court', embassy: 'empire', employment_office: 'people',
};
export const buildingOn = type => {
  if (on('housesOnly')) return !!BUILDINGS[type]?.housing && type !== 'campfire';
  return !BUILDING_FEATURE[type] || on(BUILDING_FEATURE[type]);
};
/** In houses-only mode every home can be built whatever the era. */
export const eraFree = type => on('housesOnly') && !!BUILDINGS[type]?.housing;
