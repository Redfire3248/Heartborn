// World
export const TILE = 32;            // world units per tile
export const MAP_W = 96;
export const MAP_H = 96;
export const TERRAIN_VERSION = 5;   // raise this when world generation changes: every world, old ones too, gets the new land once
export const NEW_MAP_SIZE = 160;   // new worlds are bigger and have many biomes (older worlds keep 96)

// Time (seconds of real time at 1x speed)
export const DAY_LENGTH = 90;
export const SAFE_TILES = 5;   // a small ring of quiet where you start; everywhere else is fair game
export const DAYS_PER_SEASON = 2;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

// Villagers
export const ADULT_AGE = 12;
// ageing: grown-ups gain a year every game day, children four (they grow up in about three days)
export const ADULT_YEARS_PER_DAY = 1;
export const CHILD_YEARS_PER_DAY = 4;
export const ELDER_AGE = 55;
export const HUNGER_PER_DAY = 70;    // hunger points lost per day (100 = full)
export const FOOD_PER_MEAL = 1;
export const MEAL_RESTORES = 45;
export const WALK_SPEED = 38;        // world units per second
export const MAX_SKILL = 10;

// Economy
export const BASE_STORAGE = 100;
export const BASE_HOUSING = 6;       // sleeping under the stars
export const RESOURCES = ['food', 'wood', 'stone', 'coal', 'iron', 'weapons', 'bombs', 'gold', 'gems', 'science', 'influence', 'copper', 'silver', 'obsidian', 'mythril', 'frostite', 'magmite', 'troll_hide', 'slime_core', 'spider_silk', 'spirit_bark', 'golem_heart', 'lich_soul', 'dragon_scale', 'ashen_ember', 'jade', 'cobalt', 'moonstone', 'titanium', 'sunstone', 'voidstone'];

// Saving / multiplayer
export const AUTOSAVE_SECONDS = 30;
export const OFFLINE_CAP_SECONDS = 60 * 60 * 4;   // at most 4h of offline progress
// Offline progress (villages growing and gathering while you are away, then a "While you were away" summary).
// Switched off: villages stay exactly as you left them. Set to true to turn it back on.
export const OFFLINE_PROGRESS = false;
export const NEW_PLAYER_SHIELD_MS = 3 * 24 * 3600 * 1000;
export const RAID_SHIELD_MS = 12 * 3600 * 1000;
export const SAVE_VERSION = 1;
