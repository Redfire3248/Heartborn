// World objects that sit on a tile. `work` = which villager job uses them.
// size = drawn size in tiles. charges = uses before depleting.
export const OBJECTS = {
  tree_oak:        { sprite: 'nature/tree_oak',        size: 1.7, work: 'chop', wood: [4, 7], stump: true },
  tree_pine:       { sprite: 'nature/tree_pine',       size: 1.8, work: 'chop', wood: [5, 8], stump: true },
  tree_apple:      { sprite: 'nature/tree_apple',      size: 1.7, work: 'chop', wood: [3, 5], food: [3, 6], stump: true },
  tree_palm:       { sprite: 'nature/tree_palm',       size: 1.8, work: 'chop', wood: [3, 5], stump: true },
  tree_dead:       { sprite: 'nature/tree_dead',       size: 1.6, work: 'chop', wood: [2, 4] },
  tree_snowy_pine: { sprite: 'nature/tree_snowy_pine', size: 1.8, work: 'chop', wood: [5, 8], stump: true },
  fallen_log:      { sprite: 'nature/fallen_log',      size: 1.0, work: 'chop', wood: [2, 3] },
  tree_stump:      { sprite: 'nature/tree_stump',      size: 0.8, growsInto: 'sapling', growDays: 3 },
  sapling:         { sprite: 'nature/sapling',         size: 0.8, growsInto: 'tree_oak', growDays: 3 },

  berry_bush:      { sprite: 'nature/berry_bush',      size: 0.9, work: 'gather', food: [2, 4], charges: 4, regrowDays: 2 },
  mushroom:        { sprite: 'nature/mushroom',        size: 0.6, work: 'gather', food: [1, 3], charges: 1, poison: 0.25 },
  pumpkin:         { sprite: 'nature/pumpkin',         size: 0.7, work: 'gather', food: [5, 8], charges: 1 },
  carrot:          { sprite: 'nature/carrot',          size: 0.7, work: 'gather', food: [2, 4], charges: 1 },
  wheat:           { sprite: 'nature/wheat',           size: 0.8, work: 'gather', food: [2, 4], charges: 2 },
  tall_grass:      { sprite: 'nature/tall_grass',      size: 0.7 },
  flowers:         { sprite: 'nature/flowers',         size: 0.7 },
  reeds:           { sprite: 'nature/reeds',           size: 0.8 },
  cactus:          { sprite: 'nature/cactus',          size: 0.9 },

  rock:            { sprite: 'nature/rock',            size: 0.9, work: 'mine', stone: [3, 6], charges: 3 },
  coal_ore:        { sprite: 'nature/coal_ore',        size: 0.9, work: 'mine', stone: [1, 2], coal: [2, 4], charges: 3 },
  iron_ore:        { sprite: 'nature/iron_ore',        size: 0.9, work: 'mine', stone: [1, 2], iron: [1, 3], charges: 3 },
  gold_ore:        { sprite: 'nature/gold_ore',        size: 0.9, work: 'mine', stone: [1, 2], gold: [1, 3], charges: 2 },
  gem_ore:         { sprite: 'nature/gem_ore',         size: 0.9, work: 'mine', stone: [1, 2], gems: [1, 1], charges: 2 },
  crystal_cluster: { sprite: 'nature/crystal_cluster', size: 1.0, work: 'mine', gems: [1, 2], influence: [5, 10], charges: 1 },

  grave:           { sprite: 'buildings/grave',        size: 0.8 },
  ruins:           { sprite: 'buildings/ruins',        size: 1.4, work: 'explore' },
};

// Creatures roam freely (world units, not tiles).
export const CREATURES = {
  deer:          { sprite: 'characters/deer',          size: 0.9, hp: 20, speed: 30, food: [6, 10], flees: true },
  rabbit:        { sprite: 'characters/rabbit',        size: 0.5, hp: 6,  speed: 34, food: [2, 3], flees: true },
  boar:          { sprite: 'characters/boar',          size: 0.8, hp: 30, speed: 26, food: [7, 11], damage: 6 },
  chicken:       { sprite: 'characters/chicken',       size: 0.5, hp: 5,  speed: 18, food: [2, 3], tame: true },
  cow:           { sprite: 'characters/cow',           size: 1.0, hp: 30, speed: 12, food: [10, 15], tame: true },
  sheep:         { sprite: 'characters/sheep',         size: 0.8, hp: 20, speed: 14, food: [6, 9], tame: true },
  pig:           { sprite: 'characters/pig',           size: 0.8, hp: 20, speed: 14, food: [8, 12], tame: true },
  horse:         { sprite: 'characters/horse',         size: 1.0, hp: 35, speed: 40, food: [10, 14], tame: true },
  fish:          { sprite: 'characters/fish',          size: 0.5, hp: 4,  speed: 20, food: [3, 5], water: true },
  snake:         { sprite: 'characters/snake',         size: 0.6, hp: 10, speed: 20, hostile: true, damage: 5 },
  wolf:          { sprite: 'characters/wolf',          size: 0.9, hp: 35, speed: 42, hostile: true, damage: 8, food: [4, 6] },
  bear:          { sprite: 'characters/bear',          size: 1.2, hp: 70, speed: 30, hostile: true, damage: 14, food: [12, 18] },
  giant_spider:  { sprite: 'characters/giant_spider',  size: 1.0, hp: 40, speed: 34, hostile: true, damage: 9 },
  slime:         { sprite: 'characters/slime',         size: 0.7, hp: 25, speed: 16, hostile: true, damage: 5 },
  goblin:        { sprite: 'characters/goblin',        size: 0.9, hp: 30, speed: 32, hostile: true, damage: 8, steals: true },
  bandit:        { sprite: 'characters/bandit',        size: 1.0, hp: 45, speed: 34, hostile: true, damage: 10, steals: true },
  skeleton:      { sprite: 'characters/skeleton',      size: 1.0, hp: 40, speed: 26, hostile: true, damage: 9 },
  ghost:         { sprite: 'characters/ghost',         size: 0.9, hp: 30, speed: 24, hostile: true, damage: 7, night: true },
  cave_troll:    { sprite: 'characters/cave_troll',    size: 1.4, hp: 120, speed: 22, hostile: true, damage: 18 },
  forest_spirit: { sprite: 'characters/forest_spirit', size: 1.1, hp: 80, speed: 28, hostile: true, damage: 12 },
  dragon:        { sprite: 'characters/dragon',        size: 2.6, hp: 400, speed: 46, hostile: true, damage: 35, flying: true },
  // soldiers of an enemy army (another player or a barbarian warband)
  invader:       { sprite: 'characters/warrior',       size: 1.0, hp: 50, speed: 32, hostile: true, damage: 9, steals: true, tint: '#ff3a3a' },
};

export const WARBAND_NAMES = ['The Red Hand', 'Ashfang Raiders', 'The Iron Wolves', 'Crowmarch Horde', 'Sons of the Pale Moon', 'The Bone Riders', 'Black Tide Reavers', 'The Hollow Crown'];

// Villager sprite by life stage / role.
let spriteEra = 0;
export const setSpriteEra = era => { spriteEra = era; };

// Profession sprites with a man and a woman each (sheet "people"). Switched on once that sheet is sliced.
let peopleSprites = false;
export const setPeopleSprites = on => { peopleSprites = !!on; };
const JOB_PROFESSION = {
  gather: 'gatherer', chop: 'woodcutter', mine: 'miner', farm: 'farmer', fish: 'fisher', hunt: 'hunter', build: 'builder',
  smith: 'smith', spy: 'spy', recruit: 'recruit', warrior: 'warrior', scout: 'scout', explore: 'explorer', mage: 'mage',
};
const OFFICE_PROFESSION = { steward: 'noble', master_builder: 'builder', marshal: 'knight', spymaster: 'spy', treasurer: 'clerk', high_priest: 'priest' };
const FIGHTING_JOBS = new Set(['warrior', 'recruit', 'scout', 'spy']);

function professionSprite(v) {
  const sx = v.sex === 'f' ? 'f' : 'm';
  if (v.age < 12) return `people/child_${sx}`;
  if (v.ruling) return null;                                  // kings and queens keep their royal sprites
  let prof = v.office ? OFFICE_PROFESSION[v.office] : JOB_PROFESSION[v.job];
  // a warrior with no weapon handed out yet has nothing to carry: they look like a recruit
  if (prof === 'warrior' && !v.office && !v.armed) prof = 'recruit';
  if (prof) return `people/${prof}_${sx}`;
  if (v.age >= 55) return `people/elder_${sx}`;
  return null;
}

export function villagerSprite(v) {
  if (v.robot) return v.job === 'warrior' ? 'units/robot_soldier' : 'units/robot_worker';
  if (v.jailed) return 'units/prisoner';
  if (v.exposed) return 'units/traitor';
  if (v.away?.missionId && v.job === 'spy') return 'units/assassin';   // spies out on a mission wear black
  // knights always look like knights, whatever work they are doing
  if (v.traits?.includes('knighted') && v.age >= 12 && !v.ruling) return peopleSprites ? `people/knight_${v.sex === 'f' ? 'f' : 'm'}` : 'characters/warrior';
  if (v.role === 'warrior' && spriteEra >= 4) return spriteEra >= 6 ? 'units/cyborg' : spriteEra >= 5 ? 'units/rifleman' : 'units/musketeer';
  if (peopleSprites) { const p = professionSprite(v); if (p) return p; }
  if (v.age < 12) return 'characters/child';
  if (v.job === 'spy' && (v.skills?.stealth || 0) >= 3) return 'units/spy';
  if (v.role && ROLE_SPRITES[v.role]) return ROLE_SPRITES[v.role];
  if (v.age >= 55) return 'characters/elder';
  return v.sex === 'f' ? 'characters/woman' : 'characters/man';
}

const ROLE_SPRITES = {
  office_steward: 'characters/elder', office_master_builder: 'characters/blacksmith', office_marshal: 'characters/warrior',
  office_spymaster: 'characters/hunter', office_treasurer: 'characters/merchant', office_high_priest: 'characters/priest',
  farmer: 'characters/farmer', miner: 'characters/miner', hunter: 'characters/hunter',
  warrior: 'characters/warrior', scout: 'characters/hunter', blacksmith: 'characters/blacksmith', healer: 'characters/healer',
  priest: 'characters/priest', king: 'characters/king', queen: 'characters/queen',
};
