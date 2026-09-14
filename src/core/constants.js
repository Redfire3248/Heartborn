// World
export const TILE = 32;            // world units per tile
export const MAP_W = 96;
export const MAP_H = 96;

// Time (seconds of real time at 1x speed)
export const DAY_LENGTH = 90;
export const DAYS_PER_SEASON = 2;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

// Villagers
export const ADULT_AGE = 12;
export const ELDER_AGE = 55;
export const HUNGER_PER_DAY = 70;    // hunger points lost per day (100 = full)
export const FOOD_PER_MEAL = 1;
export const MEAL_RESTORES = 45;
export const WALK_SPEED = 38;        // world units per second
export const MAX_SKILL = 10;

// Economy
export const BASE_STORAGE = 100;
export const BASE_HOUSING = 6;       // sleeping under the stars
export const RESOURCES = ['food', 'wood', 'stone', 'coal', 'iron', 'weapons', 'bombs', 'gold', 'gems', 'science', 'influence'];

// Saving / multiplayer
export const AUTOSAVE_SECONDS = 30;
export const OFFLINE_CAP_SECONDS = 60 * 60 * 4;   // at most 4h of offline progress
export const NEW_PLAYER_SHIELD_MS = 3 * 24 * 3600 * 1000;
export const RAID_SHIELD_MS = 12 * 3600 * 1000;
export const SAVE_VERSION = 1;
