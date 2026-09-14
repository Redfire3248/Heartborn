// Traits change how villagers work, fight, learn and how fate treats them.
// earned: gained through life, never inherited at birth.
export const TRAITS = {
  brave:       { label: 'Brave',       good: true,  desc: '+50% combat damage, never flees' },
  strong:      { label: 'Strong',      good: true,  desc: 'Chops and mines 30% faster' },
  genius:      { label: 'Genius',      good: true,  desc: 'Learns skills twice as fast' },
  clever:      { label: 'Clever',      good: true,  desc: 'Learns skills 50% faster' },
  hardworking: { label: 'Hardworking', good: true,  desc: 'Works 20% faster' },
  nimble:      { label: 'Nimble',      good: true,  desc: 'Moves 20% faster' },
  kind:        { label: 'Kind',        good: true,  desc: 'Lifts the spirits of everyone around them' },
  charismatic: { label: 'Charismatic', good: true,  desc: 'A natural leader. Makes a beloved ruler' },
  devout:      { label: 'Devout',      good: true,  desc: 'Favoured by the gods: prayers go better' },
  loyal:       { label: 'Loyal',       good: true,  desc: 'Never abandons the village, however hard times get' },
  honest:      { label: 'Honest',      good: true,  desc: 'Never steals and keeps greedy neighbours in line' },
  fertile:     { label: 'Fertile',     good: true,  desc: 'More likely to have children' },
  blessed:     { label: 'Blessed',     good: true,  desc: 'Good outcomes are more likely' },
  ambitious:   { label: 'Ambitious',   good: true,  desc: 'Learns 25% faster, but grows unhappy without an important role' },
  lazy:        { label: 'Lazy',        good: false, desc: 'Works 30% slower' },
  greedy:      { label: 'Greedy',      good: false, desc: 'Sometimes steals from the treasury' },
  cruel:       { label: 'Cruel',       good: false, desc: '+20% combat, but feared: a cruel ruler makes people miserable' },
  glutton:     { label: 'Glutton',     good: false, desc: 'Eats 50% more food' },
  sickly:      { label: 'Sickly',      good: false, desc: 'Falls ill more often' },
  coward:      { label: 'Coward',      good: false, desc: 'Runs from every fight' },
  cursed:      { label: 'Cursed',      good: false, desc: 'Bad outcomes are more likely' },
  // earned through life
  veteran:     { label: 'Veteran',     good: true,  earned: true, desc: 'Survived many fights: +30% combat' },
  scarred:     { label: 'Scarred',     good: false, earned: true, desc: 'Nearly died once. Tougher, but haunted (−10 happiness)' },
  wise:        { label: 'Wise',        good: true,  earned: true, desc: 'Decades of experience. A wise ruler brings good fortune' },
  knighted:    { label: 'Knight',      good: true,  earned: true, desc: 'Knighted by the ruler: +25% combat, never flees' },
  versatile:   { label: 'Jack of all trades', good: true, earned: true, desc: 'Can work in any job. Everyone else sticks to their own trade' },
};

export const BIRTH_TRAITS = ['brave', 'strong', 'genius', 'clever', 'hardworking', 'nimble', 'kind', 'charismatic', 'devout', 'loyal', 'honest',
  'fertile', 'ambitious', 'lazy', 'greedy', 'cruel', 'glutton', 'sickly', 'coward'];

export const MALE_NAMES = ['Aran', 'Bram', 'Cael', 'Doran', 'Edric', 'Finn', 'Garr', 'Hale', 'Ivo', 'Jory', 'Kael', 'Lorn', 'Milo', 'Nash', 'Orin', 'Pell', 'Rhun', 'Soren', 'Tobin', 'Ulric', 'Vale', 'Wren', 'Yorick', 'Zane', 'Asher', 'Beck', 'Cyrus', 'Dax', 'Emrys', 'Galen', 'Hugo', 'Idris', 'Jarek', 'Lucan', 'Marek', 'Osric', 'Rowan', 'Silas', 'Theo', 'Wulf'];
export const FEMALE_NAMES = ['Aila', 'Brynn', 'Cora', 'Dela', 'Elsa', 'Fern', 'Gwen', 'Hana', 'Isla', 'Juno', 'Kira', 'Lyra', 'Mira', 'Nell', 'Ona', 'Pia', 'Rosa', 'Sela', 'Tess', 'Una', 'Vera', 'Wynn', 'Yara', 'Zia', 'Ada', 'Bree', 'Cleo', 'Dara', 'Esme', 'Faye', 'Greta', 'Ilse', 'Jora', 'Liv', 'Maren', 'Nia', 'Runa', 'Sigrid', 'Thea', 'Wren'];
export const DYNASTY_NAMES = ['Ashborn', 'Emberhall', 'Stormvale', 'Ironwood', 'Goldmere', 'Ravencrest', 'Oakheart', 'Frostholm', 'Brightwater', 'Stonebrook', 'Wolfsbane', 'Dawnridge'];
