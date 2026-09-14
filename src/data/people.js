// Callings: the path you nudge a child toward. It shapes their skills, traits and first job.
export const CALLINGS = {
  none:     { label: 'Let them choose', icon: 'characters/child', desc: 'The child finds their own way.', job: 'gather', skills: {}, traits: {} },
  soldier:  { label: 'Soldier',  icon: 'items/sword',    desc: 'Drills with sticks from a young age. Grows up already trained for war.', job: 'warrior', skills: { combat: 0.35 }, traits: { brave: 0.25, strong: 0.15, cruel: 0.05 } },
  farmer:   { label: 'Farmer',   icon: 'items/hoe',      desc: 'Learns the fields and the seasons.', job: 'farm', skills: { farm: 0.35, gather: 0.2 }, traits: { hardworking: 0.25, strong: 0.1 } },
  crafter:  { label: 'Crafter',  icon: 'items/hammer',   desc: 'Apprentice at the forge and the building site.', job: 'smith', skills: { craft: 0.3, build: 0.25 }, traits: { hardworking: 0.2, clever: 0.1 } },
  hunter:   { label: 'Hunter',   icon: 'items/bow',      desc: 'Tracks game and scouts the wilds.', job: 'hunt', skills: { hunt: 0.35, combat: 0.1 }, traits: { nimble: 0.25, brave: 0.1 } },
  scholar:  { label: 'Scholar',  icon: 'items/scroll',   desc: 'Studies with the elders. Quick minds make wise rulers.', job: 'build', skills: { build: 0.15 }, traits: { clever: 0.35, genius: 0.08, ambitious: 0.15 } },
  priest:   { label: 'Priest',   icon: 'buildings/shrine', desc: 'Raised in prayer and service.', job: 'gather', skills: { gather: 0.15 }, traits: { devout: 0.45, kind: 0.2, honest: 0.15 } },
  leader:   { label: 'Leader',   icon: 'items/crown_leader', desc: 'Taught to speak, judge and command. Best choice for an heir.', job: 'build', skills: { combat: 0.1, build: 0.1 }, traits: { charismatic: 0.35, ambitious: 0.2, honest: 0.1, cruel: 0.05 } },
};

// Ruler types come from the ruler's traits and skills. Each shapes the whole realm.
export const RULER_TYPES = {
  warlord:  { label: 'Warlord',  icon: 'items/war',          desc: 'Rules by the sword.', effects: { combat: 0.25, defense: 10, raid: 0.15 }, score: { brave: 3, cruel: 2, veteran: 3, knighted: 2, strong: 1 }, skill: 'combat' },
  builder:  { label: 'Builder',  icon: 'items/hammer',       desc: 'Raises walls and halls.', effects: { build: 0.35, storage: 150 }, score: { hardworking: 3, strong: 2 }, skill: 'build' },
  sage:     { label: 'Sage',     icon: 'items/scroll',       desc: 'Knowledge above all.', effects: { learn: 0.5, fate: 0.05 }, score: { genius: 3, clever: 3, wise: 3 } },
  diplomat: { label: 'Diplomat', icon: 'items/alliance',     desc: 'Loved at home, welcome abroad.', effects: { happy: 10, join: 0.12 }, score: { charismatic: 3, kind: 2, honest: 1 } },
  zealot:   { label: 'Zealot',   icon: 'buildings/shrine',   desc: 'The gods walk beside the throne.', effects: { fate: 0.15, influence: 3 }, score: { devout: 4, blessed: 2 } },
  merchant: { label: 'Merchant Prince', icon: 'items/icon_gold', desc: 'Every coin counts.', effects: { gold: 0.4, influence: 1 }, score: { greedy: 3, clever: 1, ambitious: 2 } },
  tyrant:   { label: 'Tyrant',   icon: 'items/karma_evil',   desc: 'Obey or suffer.', effects: { work: 0.25, happy: -15, karma: -0.5 }, score: { cruel: 4, greedy: 1, ambitious: 1 } },
  just:     { label: 'Just Ruler', icon: 'items/karma_good', desc: 'Fair laws, honest courts.', effects: { happy: 5, karma: 0.4, lawful: 1 }, score: { honest: 3, loyal: 2, kind: 1, wise: 1 } },
  chieftain:{ label: 'Chieftain', icon: 'characters/king',   desc: 'A plain leader of plain folk.', effects: { happy: 3 }, score: {} },
};

export const RULER_TITLES = [
  ['Chieftain', 'Chieftess'],   // Primitive
  ['Lord', 'Lady'],             // Village
  ['Duke', 'Duchess'],          // Town
  ['King', 'Queen'],            // Kingdom
  ['Emperor', 'Empress'],       // Industrial
  ['President', 'President'],   // Atomic
  ['Chancellor', 'Chancellor'], // Future
];

// Personal belongings shown in a villager's inventory.
export const ITEMS = {
  // tools (equipped automatically for their job; iron versions once a Blacksmith stands)
  axe:       { label: 'Axe',           icon: 'items/axe',      slot: 'tool' },
  pickaxe:   { label: 'Pickaxe',       icon: 'items/pickaxe',  slot: 'tool' },
  hoe:       { label: 'Hoe',           icon: 'items/hoe',      slot: 'tool' },
  hammer:    { label: 'Hammer',        icon: 'items/hammer',   slot: 'tool' },
  bow:       { label: 'Hunting Bow',   icon: 'items/bow',      slot: 'tool' },
  spear_t:   { label: 'Fishing Spear', icon: 'items/spear',    slot: 'tool' },
  // weapons and armour (from the village armoury)
  spear:     { label: 'Spear',         icon: 'items/spear',    slot: 'weapon' },
  sword:     { label: 'Sword',         icon: 'items/sword',    slot: 'weapon' },
  shield:    { label: 'Shield & Mail', icon: 'items/shield',   slot: 'armor', desc: 'Takes 30% less damage' },
  // pack
  herbs:     { label: 'Healing Herbs', icon: 'effects/plus_heal', desc: 'Used automatically when sick' },
  pelt:      { label: 'Fine Pelt',     icon: 'items/icon_food',  desc: 'Worth 3 gold at the market' },
  trinket:   { label: 'Old Trinket',   icon: 'items/relic',      desc: 'A keepsake from the wilds. Makes its owner happy' },
  relic:     { label: 'Ancient Relic', icon: 'items/relic',      desc: 'Priceless. +5% luck for the village while carried' },
  potion:    { label: 'Potion',        icon: 'items/potion',     desc: 'Heals 40 health when badly hurt' },
};

export const TOOL_FOR_JOB = { chop: 'axe', mine: 'pickaxe', farm: 'hoe', build: 'hammer', smith: 'hammer', hunt: 'bow', fish: 'spear_t' };
