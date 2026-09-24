/*
 * Races: what you were born as, and what it does for you.
 *
 * A race is not just a face. Every one gives flat bonuses that fold straight into your stats, and a passive that
 * changes how a fight goes — an Orc hits harder the more hurt it is, a Vampire takes health back out of what it
 * kills, a Skeleton feels no poison at all. You pick one when you choose your character and it stays with you.
 *
 * Each race has four looks (two men, two women) from public/assets/races. Nothing here touches your points: the
 * numbers stack on top of what you have trained, so the choice matters without deciding the whole game for you.
 */

/**
 * `mult` values are multipliers folded into heroStats. `passive` is the text; the code that makes each one happen
 * is keyed on the race id in hero.js and rpg.js, so a race never quietly does nothing.
 */
export const RACES = {
  human: {
    name: 'Human', color: '#ffd76a',
    desc: 'Ordinary, and better for it: nothing to overcome and a little of everything.',
    mult: { hp: 1.05, dmg: 1.05, speed: 1.03, stamina: 1.05, crit: 1 },
    passive: 'Adaptable: you earn 10% more experience from everything.',
    looks: ['human_m', 'human_f', 'human_m2', 'human_f2'],
  },
  elf: {
    name: 'Elf', color: '#8aff9a',
    desc: 'Quick and keen-eyed, but slight of frame.',
    mult: { hp: 0.9, dmg: 1.05, speed: 1.14, stamina: 1.15, crit: 1.5 },
    passive: 'Keen Eye: half again as likely to land a critical hit, and your dash costs nothing.',
    looks: ['elf_m', 'elf_f', 'elf_m2', 'elf_f2'],
  },
  dwarf: {
    name: 'Dwarf', color: '#e0a35a',
    desc: 'Stone-boned and stubborn. Slow, and very hard to put down.',
    mult: { hp: 1.3, dmg: 1.05, speed: 0.88, stamina: 1.2, crit: 0.8 },
    passive: 'Stonehide: every blow that reaches you is cut by a further 12%, and ore veins give you one extra.',
    looks: ['dwarf_m', 'dwarf_f', 'dwarf_m2', 'dwarf_f2'],
  },
  orc: {
    name: 'Orc', color: '#7ac74f',
    desc: 'Born for the fight and worst when cornered.',
    mult: { hp: 1.2, dmg: 1.18, speed: 0.96, stamina: 1.1, crit: 0.9 },
    passive: 'Blood Rage: below half health you hit 35% harder.',
    looks: ['orc_m', 'orc_f', 'orc_m2', 'orc_f2'],
  },
  demon: {
    name: 'Demon', color: '#ff6b5b',
    desc: 'Fire runs where blood should. It burns what you touch and what touches you.',
    mult: { hp: 1.05, dmg: 1.2, speed: 1.05, stamina: 1, crit: 1.1 },
    passive: 'Hellfire: everything you strike burns, and fire cannot hurt you.',
    looks: ['demon_m', 'demon_f', 'demon_m2', 'demon_f2'],
  },
  archdemon: {
    name: 'Arch Demon', color: '#ff3a2a',
    desc: 'A crown of horns and a furnace for a heart. Terrible, and slow to move.',
    mult: { hp: 1.35, dmg: 1.3, speed: 0.85, stamina: 0.95, crit: 1 },
    passive: 'Cinder Crown: your blows burn fiercely, fire cannot hurt you, and every kill leaves a patch of flame.',
    looks: ['archdemon_m', 'archdemon_f', 'archdemon_m2', 'archdemon_f2'],
  },
  angel: {
    name: 'Angel', color: '#fff3b0',
    desc: 'Light in the veins. Slow to fall and quick to rise.',
    mult: { hp: 1.1, dmg: 1, speed: 1.08, stamina: 1.1, crit: 1 },
    passive: 'Grace: you heal steadily whenever nothing has hurt you for four seconds.',
    looks: ['angel_m', 'angel_f', 'angel_m2', 'angel_f2'],
  },
  archangel: {
    name: 'Archangel', color: '#ffe9a0',
    desc: 'Four wings and a judgement. Holy things obey you; the undead do not survive you.',
    mult: { hp: 1.2, dmg: 1.12, speed: 1.05, stamina: 1.15, crit: 1.1 },
    passive: 'Judgement: double damage against the undead, and you heal faster the longer you are unhurt.',
    looks: ['archangel_m', 'archangel_f', 'archangel_m2', 'archangel_f2'],
  },
  fallen: {
    name: 'Demonic Angel', color: '#c08aff',
    desc: 'One white wing, one black. Neither side will have you, and both gave you something.',
    mult: { hp: 1.1, dmg: 1.15, speed: 1.06, stamina: 1.05, crit: 1.2 },
    passive: 'Two Natures: your blows burn, you heal while unhurt, and fire cannot touch you.',
    looks: ['fallen_m', 'fallen_f', 'fallen_m2', 'fallen_f2'],
  },
  skeleton: {
    name: 'Skeleton', color: '#e8e4d8',
    desc: 'Nothing left to poison, nothing left to drown. Also nothing to cushion a blow.',
    mult: { hp: 0.85, dmg: 1.08, speed: 1.1, stamina: 1.25, crit: 1.15 },
    passive: 'Bare Bones: poison, bleeding and hunger cannot touch you, and you never run out of breath dashing.',
    looks: ['skeleton_m', 'skeleton_f', 'skeleton_m2', 'skeleton_f2'],
  },
  zombie: {
    name: 'Zombie', color: '#9ab87a',
    desc: 'Too stupid to stop. You keep walking long after you should not.',
    mult: { hp: 1.45, dmg: 0.95, speed: 0.82, stamina: 0.9, crit: 0.8 },
    passive: 'Undying: once every two minutes a killing blow leaves you on one health instead. Poison does nothing.',
    looks: ['zombie_m', 'zombie_f', 'zombie_m2', 'zombie_f2'],
  },
  vampire: {
    name: 'Vampire', color: '#ff5b6b',
    desc: 'You take your health from other people. Daylight does not agree with you.',
    mult: { hp: 1, dmg: 1.15, speed: 1.1, stamina: 1.05, crit: 1.25 },
    passive: 'Bloodthirst: 12% of the damage you deal comes back as health. By day you take 15% more.',
    looks: ['vampire_m', 'vampire_f', 'vampire_m2', 'vampire_f2'],
  },
};

export const RACE_KEYS = Object.keys(RACES);
export const UNDEAD_RACES = new Set(['skeleton', 'zombie', 'vampire']);

const LAST_RACE = 'hb_race', LAST_LOOK = 'hb_look';
const validRace = id => !!RACES[id];

/** Your race in this world. A world saved before races existed is Human. */
export function raceOf(g) {
  const r = g?.state?.rpg;
  if (r && !validRace(r.race)) r.race = lastRace();
  return r?.race || 'human';
}
export const raceDef = g => RACES[raceOf(g)] || RACES.human;

/** Which of that race's four looks you wear. */
export function lookOf(g) {
  const r = g?.state?.rpg;
  const looks = (RACES[raceOf(g)] || RACES.human).looks;
  if (r && !looks.includes(r.look)) r.look = looks[0];
  return r?.look || looks[0];
}

export const raceArt = look => `races/${look}`;

export function lastRace() {
  try { const id = localStorage.getItem(LAST_RACE); return validRace(id) ? id : 'human'; } catch { return 'human'; }
}
export function lastLook() {
  try { return localStorage.getItem(LAST_LOOK) || null; } catch { return null; }
}

/** Choose who you are. Returns false for a race that does not exist. */
export function setRace(g, id, look = null) {
  if (!validRace(id)) return false;
  const r = (g.state.rpg ||= {});
  r.race = id;
  r.look = RACES[id].looks.includes(look) ? look : RACES[id].looks[0];
  try { localStorage.setItem(LAST_RACE, id); localStorage.setItem(LAST_LOOK, r.look); } catch { /* private window */ }
  g.emit?.('change');
  return true;
}

/** Just the look, keeping the race. */
export function setLookOnly(g, look) {
  const r = g.state.rpg;
  if (!r || !RACES[raceOf(g)].looks.includes(look)) return false;
  r.look = look;
  try { localStorage.setItem(LAST_LOOK, look); } catch { /* private window */ }
  g.emit?.('change');
  return true;
}

/** The multipliers heroStats folds in. Always a full set, so a missing race can never break a stat. */
export function raceMult(g) {
  const m = (RACES[raceOf(g)] || RACES.human).mult;
  return { hp: m.hp ?? 1, dmg: m.dmg ?? 1, speed: m.speed ?? 1, stamina: m.stamina ?? 1, crit: m.crit ?? 1 };
}

/** Does this race do the thing? Used by the passives scattered through combat. */
export const has = (g, trait) => TRAITS[raceOf(g)]?.includes(trait) || false;

/** What each race actually does, as flags the fight code checks. */
const TRAITS = {
  human: ['learner'],
  elf: ['freeDash'],
  dwarf: ['tough', 'richVeins'],
  orc: ['rage'],
  demon: ['burn', 'fireproof'],
  archdemon: ['burn', 'bigBurn', 'fireproof', 'deathFlame'],
  angel: ['regen'],
  archangel: ['regen', 'fastRegen', 'smiteUndead'],
  fallen: ['burn', 'fireproof', 'regen'],
  skeleton: ['noPoison', 'freeDash'],
  zombie: ['noPoison', 'undying'],
  vampire: ['lifesteal', 'sunburn'],
};
