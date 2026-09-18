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
  tree_stump:      { sprite: 'nature/tree_stump',      size: 0.8, growsInto: 'sapling', growDays: 1 },   // a stump sprouts a sapling after a day
  sapling:         { sprite: 'nature/stump_sprout',    size: 0.8, growsInto: 'tree_oak', growDays: 2 },  // and grows back into the tree it was

  berry_bush:      { sprite: 'nature/berry_bush',      size: 0.9, work: 'gather', food: [2, 4], charges: 4, regrowDays: 2 },
  mushroom:        { sprite: 'nature/mushroom',        size: 0.6, work: 'gather', food: [1, 3], charges: 1, poison: 0.25 },
  pumpkin:         { sprite: 'nature/pumpkin',         size: 0.7, work: 'gather', food: [5, 8], charges: 1 },
  carrot:          { sprite: 'nature/carrot',          size: 0.7, work: 'gather', food: [2, 4], charges: 1 },
  wheat:           { sprite: 'nature/wheat',           size: 0.8, work: 'gather', food: [2, 4], charges: 2 },
  // plants you cut down with a swing (your hands, a blade or a sickle)
  tall_grass:      { sprite: 'nature/tall_grass',      size: 0.7, work: 'cut', food: [1, 2], charges: 1 },
  flowers:         { sprite: 'nature/flowers',         size: 0.7, work: 'cut', influence: [1, 2], charges: 1 },
  reeds:           { sprite: 'nature/reeds',           size: 0.8, work: 'cut', wood: [1, 2], charges: 1 },
  cactus:          { sprite: 'nature/cactus',          size: 0.9, work: 'cut', wood: [1, 2], charges: 1 },   // cactus gives a little wood, not food

  rock:            { sprite: 'nature/rock',            size: 0.9, work: 'mine', stone: [2, 4], charges: 3 },
  coal_ore:        { sprite: 'nature/coal_ore',        size: 0.9, work: 'mine', stone: [1, 2], coal: [2, 4], charges: 3, tier: 1, rarity: 'Common' },
  iron_ore:        { sprite: 'nature/iron_ore',        size: 0.9, work: 'mine', stone: [1, 2], iron: [1, 3], charges: 3, tier: 2, rarity: 'Common' },
  gold_ore:        { sprite: 'nature/gold_ore',        size: 0.9, work: 'mine', stone: [1, 2], gold: [1, 3], charges: 2, tier: 5, rarity: 'Uncommon' },
  gem_ore:         { sprite: 'nature/gem_ore',         size: 0.9, work: 'mine', stone: [1, 2], gems: [1, 1], charges: 2, tier: 6, rarity: 'Rare' },
// biome ores (placeholder art is recoloured iron ore until the real sheet is in)
  copper_ore:      { sprite: 'nature/copper_ore',      size: 0.9, work: 'mine', stone: [1, 2], copper: [2, 4], charges: 3, tier: 1, rarity: 'Common' },
  silver_ore:      { sprite: 'nature/silver_ore',      size: 0.9, work: 'mine', stone: [1, 2], silver: [1, 3], charges: 3, tier: 4, rarity: 'Uncommon' },
  obsidian_ore:    { sprite: 'nature/obsidian_ore',    size: 0.9, work: 'mine', obsidian: [1, 3], charges: 2, tier: 7, rarity: 'Rare' },
  frostite_ore:    { sprite: 'nature/frostite_ore',    size: 0.9, work: 'mine', frostite: [1, 2], gems: [0, 1], charges: 2, tier: 6, rarity: 'Epic' },
  magmite_ore:     { sprite: 'nature/magmite_ore',     size: 0.9, work: 'mine', magmite: [1, 2], coal: [1, 3], charges: 2, tier: 9, rarity: 'Legendary' },
  mythril_ore:     { sprite: 'nature/mythril_ore',     size: 0.9, work: 'mine', mythril: [1, 2], gems: [0, 1], charges: 2, tier: 8, rarity: 'Mythical' },
  jade_ore:        { sprite: 'nature/jade_ore',        size: 0.9, work: 'mine', stone: [1, 2], jade: [1, 3], charges: 3, tier: 3, rarity: 'Uncommon' },
  cobalt_ore:      { sprite: 'nature/cobalt_ore',      size: 0.9, work: 'mine', stone: [1, 2], cobalt: [1, 3], charges: 3, tier: 5, rarity: 'Rare' },
  moonstone_ore:   { sprite: 'nature/moonstone_ore',   size: 0.9, work: 'mine', moonstone: [1, 2], charges: 2, tier: 5, rarity: 'Rare' },
  titanium_ore:    { sprite: 'nature/titanium_ore',    size: 0.9, work: 'mine', stone: [1, 2], titanium: [1, 2], charges: 2, tier: 6, rarity: 'Epic' },
  sunstone_ore:    { sprite: 'nature/sunstone_ore',    size: 0.9, work: 'mine', sunstone: [1, 2], gold: [0, 2], charges: 2, tier: 6, rarity: 'Epic' },
  voidstone_ore:   { sprite: 'nature/voidstone_ore',   size: 0.9, work: 'mine', voidstone: [1, 1], gems: [0, 1], charges: 1, tier: 9, rarity: 'Mythical' },
  amethyst_ore:    { sprite: 'nature/amethyst_ore',    size: 0.9, work: 'mine', stone: [1, 2], gems: [1, 3], charges: 2, tier: 5, rarity: 'Rare' },
  ruby_ore:        { sprite: 'nature/ruby_ore',        size: 0.9, work: 'mine', gems: [2, 3], gold: [0, 2], charges: 2, tier: 7, rarity: 'Epic' },
  crystal_cluster: { sprite: 'nature/crystal_cluster', size: 1.0, work: 'mine', gems: [1, 2], influence: [5, 10], charges: 1, tier: 8, rarity: 'Epic' },

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
  // ranged: { shot, range, min (keeps this far away), every (seconds), windup, count, spread, dmg (x damage) }
  // slam: a ground pound on a warning circle; summons: calls helpers
  giant_spider:  { sprite: 'characters/giant_spider',  size: 1.0, hp: 40, speed: 34, hostile: true, damage: 9, ranged: { shot: 'web_ball', range: 5, every: 5, dmg: 0.3 } },
  slime:         { sprite: 'characters/slime',         size: 0.7, hp: 25, speed: 16, hostile: true, damage: 5, ranged: { shot: 'poison_spit', range: 3.5, every: 4, dmg: 0.5 } },
  goblin:        { sprite: 'characters/goblin',        size: 0.9, hp: 30, speed: 32, hostile: true, damage: 8, steals: true, ranged: { shot: 'rock', range: 8, min: 2.2, every: 2.6, windup: 0.5, dmg: 0.8 } },
  bandit:        { sprite: 'characters/bandit',        size: 1.0, hp: 45, speed: 34, hostile: true, damage: 10, steals: true, ranged: { shot: 'throwing_knife', range: 6, every: 3.5, dmg: 0.7 } },
  skeleton:      { sprite: 'characters/skeleton',      size: 1.0, hp: 40, speed: 26, hostile: true, damage: 9, ranged: { shot: 'arrow', range: 7, min: 2.5, every: 2.8, dmg: 0.9 } },
  ghost:         { sprite: 'characters/ghost',         size: 0.9, hp: 30, speed: 24, hostile: true, damage: 7, night: true, ranged: { shot: 'magic_bolt', range: 6, every: 3.2, dmg: 1 } },
  cave_troll:    { sprite: 'characters/cave_troll',    size: 1.4, hp: 260, speed: 22, hostile: true, damage: 22, armor: 0.3, boss: true, slam: { every: 5, range: 4, radius: 1.8, delay: 0.9, dmg: 1.3 }, ranged: { shot: 'boulder', range: 8, min: 3, every: 6, windup: 0.8, dmg: 1 } },
  forest_spirit: { sprite: 'characters/forest_spirit', size: 1.1, hp: 160, speed: 28, hostile: true, damage: 14, armor: 0.2, boss: true, ranged: { shot: 'magic_bolt', range: 7, every: 3, count: 3, spread: 0.35, dmg: 0.8 } },
  // dungeon folk (their own art once DungeonMonsters.png is in; until then a recoloured cousin)
  skeleton_archer: { sprite: 'characters/skeleton_archer', fallback: { sprite: 'characters/skeleton', tint: '#d8c8a0' }, size: 1.0, hp: 32, speed: 24, hostile: true, damage: 7, ranged: { shot: 'arrow', range: 8, min: 3, every: 2, dmg: 1 } },
  dark_mage:     { sprite: 'characters/dark_mage',     fallback: { sprite: 'characters/bandit', tint: '#8a4aff' }, size: 1.0, hp: 38, speed: 22, hostile: true, damage: 6, ranged: { shot: 'dark_orb', range: 7, min: 3.5, every: 2.8, windup: 0.6, dmg: 1.4 } },
  bat:           { sprite: 'characters/bat',           fallback: { sprite: 'characters/ghost', tint: '#3a3040' }, size: 0.6, hp: 12, speed: 55, hostile: true, damage: 4, ranged: { shot: 'sonic_wave', range: 4, every: 3, dmg: 0.8 } },
  rat:           { sprite: 'characters/rat',           fallback: { sprite: 'characters/rabbit', tint: '#6a6a72' }, size: 0.55, hp: 10, speed: 44, hostile: true, damage: 4 },
  zombie:        { sprite: 'characters/zombie',        fallback: { sprite: 'characters/skeleton', tint: '#6fae5a' }, size: 1.0, hp: 60, speed: 14, hostile: true, damage: 12, ranged: { shot: 'poison_spit', range: 3, every: 5, dmg: 0.5 } },
  mimic:         { sprite: 'characters/mimic',         fallback: { sprite: 'gear/chest_closed' }, size: 0.9, hp: 70, speed: 30, hostile: true, damage: 14, ambush: 2 },
  cave_spider:   { sprite: 'characters/cave_spider',   fallback: { sprite: 'characters/giant_spider', tint: '#8a4ab0' }, size: 0.6, hp: 18, speed: 40, hostile: true, damage: 5, ranged: { shot: 'web_ball', range: 4.5, every: 4.5, dmg: 0.3 } },
  fire_imp:      { sprite: 'characters/fire_imp',      fallback: { sprite: 'characters/goblin', tint: '#ff5a3a' }, size: 0.7, hp: 24, speed: 36, hostile: true, damage: 6, ranged: { shot: 'fireball', range: 7, min: 2.5, every: 2.6, dmg: 1.2 } },
  lich:          { sprite: 'characters/lich',          fallback: { sprite: 'characters/skeleton', tint: '#7affb0' }, size: 1.5, hp: 420, speed: 20, hostile: true, damage: 18, armor: 0.3, boss: true, ranged: { shot: 'dark_orb', range: 8, every: 3, count: 5, spread: 0.3, windup: 0.7, dmg: 0.8 }, summons: { type: 'skeleton', every: 12, count: 2 } },
  stone_golem:   { sprite: 'characters/stone_golem',   fallback: { sprite: 'characters/cave_troll', tint: '#9aa4b8' }, size: 1.6, hp: 520, speed: 16, hostile: true, damage: 26, armor: 0.45, boss: true, slam: { every: 4, range: 5, radius: 2.2, delay: 1, dmg: 1.4 }, ranged: { shot: 'boulder', range: 9, min: 3, every: 5, windup: 0.9, dmg: 1 } },
  spider_queen:  { sprite: 'characters/spider_queen',  fallback: { sprite: 'characters/giant_spider', tint: '#c03a3a' }, size: 2.0, hp: 380, speed: 30, hostile: true, damage: 16, armor: 0.2, boss: true, ranged: { shot: 'web_ball', range: 7, every: 3.5, count: 3, spread: 0.4, dmg: 0.4 }, summons: { type: 'cave_spider', every: 10, count: 3 } },
  slime_king:    { sprite: 'characters/slime_king',    fallback: { sprite: 'characters/slime', tint: '#5ae07a' }, size: 2.0, hp: 360, speed: 14, hostile: true, damage: 14, boss: true, ranged: { shot: 'poison_spit', range: 6, every: 3, count: 5, spread: 0.5, dmg: 0.6 }, slam: { every: 6, range: 3.5, radius: 2, delay: 1, dmg: 1.2 }, summons: { type: 'slime', every: 14, count: 2 } },
  // armor: share of every blow shrugged off (a real weapon halves it); breath: fire that burns everyone near it
  // an Elden Ring style boss: delayed swings, long combos, a thrust across the arena, shockwave slams, and a burning second phase
  ashen_knight:  { sprite: 'characters/ashen_knight', fallback: { sprite: 'characters/warrior', tint: '#3a2e44' }, size: 1.7, hp: 650, speed: 30, hostile: true, damage: 28, armor: 0.35, boss: true, elden: true },
  dragon:        { sprite: 'characters/dragon',        size: 2.6, hp: 1500, speed: 46, hostile: true, damage: 36, flying: true, armor: 0.6, boss: true, breath: { every: 4.5, radius: 2.5, damage: 18 }, ranged: { shot: 'fireball', range: 10, min: 3, every: 5, count: 3, spread: 0.25, dmg: 0.6 } },
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
  // soldiers, spies and wizards look like what they are doing; everyone else wears the clothes of their trade,
  // so changing someone's trade changes their look (a Jack of all trades dresses for the job at hand)
  const byJob = FIGHTING_JOBS.has(v.job) || v.job === 'mage' || (v.traits?.includes('versatile') && v.job !== 'idle');
  let prof = v.office ? OFFICE_PROFESSION[v.office] : (byJob ? JOB_PROFESSION[v.job] : JOB_PROFESSION[v.profession] || JOB_PROFESSION[v.job]);
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
