import { CHARACTERS, characterById, isCharacter, hasCharacter } from './characters.js';
import { spriteAvailable } from '../core/assets.js';
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
    name: 'Human', color: '#ffd76a', tier: 0, weight: 24,
    desc: 'Ordinary, and better for it: nothing to overcome and a little of everything.',
    mult: { hp: 1.05, dmg: 1.05, speed: 1.03, stamina: 1.05, crit: 1 },
    passive: 'Adaptable: you earn 10% more experience from everything.',
    looks: ['human_m', 'human_f'],
    names: ['Bren the Sellsword', 'Mira the Ashcaller'],
  },
  elf: {
    name: 'Elf', color: '#8aff9a', tier: 0, weight: 20,
    desc: 'Quick and keen-eyed, but slight of frame.',
    mult: { hp: 0.9, dmg: 1.05, speed: 1.14, stamina: 1.15, crit: 1.5 },
    passive: 'Keen Eye: half again as likely to land a critical hit, and your dash costs nothing.',
    looks: ['elf_m', 'elf_f'],
    names: ['Aeloth the Pale Sage', 'Sylvaen of the Green'],
  },
  dwarf: {
    name: 'Dwarf', color: '#e0a35a', tier: 0, weight: 20,
    desc: 'Stone-boned and stubborn. Slow, and very hard to put down.',
    mult: { hp: 1.3, dmg: 1.05, speed: 0.88, stamina: 1.2, crit: 0.8 },
    passive: 'Stonehide: every blow that reaches you is cut by a further 12%, and ore veins give you one extra.',
    looks: ['dwarf_m', 'dwarf_f'],
    names: ['Durgan Ironbeard', 'Hilda Stonefoot'],
  },
  orc: {
    name: 'Orc', color: '#7ac74f', tier: 0, weight: 18,
    desc: 'Born for the fight and worst when cornered.',
    mult: { hp: 1.2, dmg: 1.18, speed: 0.96, stamina: 1.1, crit: 0.9 },
    passive: 'Blood Rage: below half health you hit 35% harder.',
    looks: ['orc_m', 'orc_f'],
    names: ['Grum the Tusked', 'Zakka Spiritspeaker'],
  },
  demon: {
    name: 'Demon', color: '#ff6b5b', tier: 2, weight: 6,
    desc: 'Fire runs where blood should. It burns what you touch and what touches you.',
    mult: { hp: 1.05, dmg: 1.2, speed: 1.05, stamina: 1, crit: 1.1 },
    passive: 'Hellfire: everything you strike burns, and fire cannot hurt you.',
    looks: ['demon_m', 'demon_f'],
    names: ['Vharn the Red', 'Liressa Thornhorn'],
  },
  archdemon: {
    name: 'Arch Demon', color: '#ff3a2a', tier: 4, weight: 1,
    desc: 'A crown of horns and a furnace for a heart. Terrible, and slow to move.',
    mult: { hp: 1.35, dmg: 1.3, speed: 0.85, stamina: 0.95, crit: 1 },
    passive: 'Cinder Crown: your blows burn fiercely, fire cannot hurt you, and every kill leaves a patch of flame.',
    looks: ['archdemon_m', 'archdemon_f'],
    names: ['Malgroth the Cinder King', 'Nyxareth the Cold Flame'],
  },
  angel: {
    name: 'Angel', color: '#fff3b0', tier: 2, weight: 6,
    desc: 'Light in the veins. Slow to fall and quick to rise.',
    mult: { hp: 1.1, dmg: 1, speed: 1.08, stamina: 1.1, crit: 1 },
    passive: 'Grace: you heal steadily whenever nothing has hurt you for four seconds.',
    looks: ['angel_m', 'angel_f'],
    names: ['Tobiel the Mender', 'Serelis the Watcher'],
  },
  archangel: {
    name: 'Archangel', color: '#ffe9a0', tier: 4, weight: 1,
    desc: 'Four wings and a judgement. Holy things obey you; the undead do not survive you.',
    mult: { hp: 1.2, dmg: 1.12, speed: 1.05, stamina: 1.15, crit: 1.1 },
    passive: 'Judgement: double damage against the undead, and you heal faster the longer you are unhurt.',
    looks: ['archangel_m', 'archangel_f'],
    names: ['Uriellon the Dawnblade', 'Sariah of the Silver Choir'],
  },
  fallen: {
    name: 'Demonic Angel', color: '#c08aff', tier: 3, weight: 2,
    desc: 'One white wing, one black. Neither side will have you, and both gave you something.',
    mult: { hp: 1.1, dmg: 1.15, speed: 1.06, stamina: 1.05, crit: 1.2 },
    passive: 'Two Natures: your blows burn, you heal while unhurt, and fire cannot touch you.',
    looks: ['fallen_m', 'fallen_f'],
    names: ['Kaelith the Fallen', 'Vespera Ashwing'],
  },
  skeleton: {
    name: 'Skeleton', color: '#e8e4d8', tier: 1, weight: 10,
    desc: 'Nothing left to poison, nothing left to drown. Also nothing to cushion a blow.',
    mult: { hp: 0.85, dmg: 1.08, speed: 1.1, stamina: 1.25, crit: 1.15 },
    passive: 'Bare Bones: poison, bleeding and hunger cannot touch you, and you never run out of breath dashing.',
    looks: ['skeleton_m', 'skeleton_f'],
    names: ['Rattle-Sir Orlan', 'Grell the Hollow'],
  },
  zombie: {
    name: 'Zombie', color: '#9ab87a', tier: 1, weight: 10,
    desc: 'Too stupid to stop. You keep walking long after you should not.',
    mult: { hp: 1.45, dmg: 0.95, speed: 0.82, stamina: 0.9, crit: 0.8 },
    passive: 'Undying: once every two minutes a killing blow leaves you on one health instead. Poison does nothing.',
    looks: ['zombie_m', 'zombie_f'],
    names: ['Old Marrek', 'Pale Annet'],
  },
  vampire: {
    name: 'Vampire', color: '#ff5b6b', tier: 2, weight: 5,
    desc: 'You take your health from other people. Daylight does not agree with you.',
    mult: { hp: 1, dmg: 1.15, speed: 1.1, stamina: 1.05, crit: 1.25 },
    passive: 'Bloodthirst: 12% of the damage you deal comes back as health. By day you take 15% more.',
    looks: ['vampire_m', 'vampire_f'],
    names: ['Count Dravik', 'Lady Ysolde'],
  },
  god: {
    name: 'God', color: '#ffffff', tier: 4, weight: 0, admin: true,
    desc: 'Two demon wings and two angel wings, and a crown that is not metal. Only the people who run this world wear it.',
    mult: { hp: 2, dmg: 2, speed: 1.3, stamina: 2, crit: 2 },
    passive: 'Almighty: every passive in the game at once, and nothing burns, poisons or drowns you.',
    looks: ['god_m', 'god_f'],
    names: ['The Maker', 'The Mother'],
  },
};

export const RACE_KEYS = Object.keys(RACES);
/** The races the wheel may land on. A race marked `admin` is handed out, never rolled. */
export const ROLLABLE_RACES = RACE_KEYS.filter(k => !RACES[k].admin);
export const isAdminRace = key => !!RACES[key]?.admin;
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
/*
 * There are two people in this game, and a race is a version of one of them. The zombie you is the same person
 * as the human you, dead; the archangel you is the same person with wings. So your look is never chosen on its
 * own: it is your base character (`m` or `f`, picked when you start a world) as whatever race you are wearing.
 */
export const BASES = CHARACTERS;   // Adam, Eve and everyone you can earn (characters.js)
const LAST_BASE = 'hb_base';
const validBase = id => isCharacter(id) && hasCharacter(id);

/** Which person you are. Kept per world, and remembered for the next one. */
export function baseOf(g) {
  const r = g?.state?.rpg;
  if (r && !isCharacter(r.base)) r.base = lastBase();
  return r?.base || lastBase();
}
export function setBase(g, id) {
  if (!validBase(id)) return false;
  const r = (g.state.rpg ||= {});
  r.base = id;
  r.look = lookFor(raceOf(g), id);
  try { localStorage.setItem(LAST_BASE, id); } catch { /* private window */ }
  g.emit?.('change');
  return true;
}
export function lastBase() {
  try { const b = localStorage.getItem(LAST_BASE); return b && isCharacter(b) ? b : 'm'; } catch { return 'm'; }
}
/** Remember the person to start the next world as (the menu's Character page). */
export function chooseBase(id) {
  if (!validBase(id)) return false;
  try { localStorage.setItem(LAST_BASE, id); } catch { /* private window */ }
  return true;
}

/**
 * The art for a race worn by a person. A person whose picture for that race is not drawn yet wears Adam's or
 * Eve's (by their sex), so nobody is ever shown as a blank or a placeholder.
 */
export function lookFor(race, base) {
  const own = `${race}_${base}`;
  if (spriteAvailable(`races/${own}`)) return own;
  return `${race}_${characterById(base).sex}`;
}

/** What you look like: your person, as your race. Never one without the other. */
export function lookOf(g) {
  const look = lookFor(raceOf(g), baseOf(g));
  const r = g?.state?.rpg;
  if (r) r.look = look;
  return look;
}

/** That race's art for the person you are: the preview a race shows you. */
export const previewOf = (g, race) => `races/${lookFor(race, baseOf(g))}`;

export const raceArt = look => `races/${look}`;

/** Every character in the game, in race order. Any of them can be worn by anybody. */
export const ALL_LOOKS = RACE_KEYS.flatMap(k => RACES[k].looks);
export const allCharacters = () => RACE_KEYS.flatMap(k => RACES[k].looks.map((look, i) => ({ look, race: k, name: RACES[k].names?.[i] || RACES[k].name })));

/** The name of one character, and the race it belongs to. Every face in the game is somebody. */
export function characterOf(look) {
  for (const key of RACE_KEYS) {
    const i = RACES[key].looks.indexOf(look);
    if (i >= 0) return { race: key, name: RACES[key].names?.[i] || RACES[key].name, index: i, base: i === 1 ? 'f' : 'm' };
  }
  return { race: 'human', name: 'Someone', index: 0, base: 'm' };
}
export const characterName = look => characterOf(look).name;

/** Every character you could be right now: the four faces of each race you are holding. */
export function myCharacters(g) {
  const i = baseOf(g) === 'f' ? 1 : 0;
  return raceSlots(g).map(key => ({ look: lookFor(key, baseOf(g)), race: key, name: RACES[key].names?.[i] || RACES[key].name }));
}

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
  // the person stays the same person: a race only changes what they are
  if (isCharacter(look) && hasCharacter(look)) r.base = look;
  r.look = lookFor(id, baseOf(g));
  try { localStorage.setItem(LAST_RACE, id); localStorage.setItem(LAST_LOOK, r.look); } catch { /* private window */ }
  g.emit?.('change');
  return true;
}

/** Just the look, keeping the race. */
/** Kept for anything that still names a whole look: it sets the person, and the race decides the rest. */
export function setLookOnly(g, look) {
  const base = String(look || '').endsWith('_f') ? 'f' : String(look || '').endsWith('_m') ? 'm' : null;
  return base ? setBase(g, base) : false;
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
  god: ['learner', 'freeDash', 'tough', 'richVeins', 'rage', 'burn', 'bigBurn', 'fireproof', 'deathFlame',
    'regen', 'fastRegen', 'smiteUndead', 'noPoison', 'undying', 'lifesteal'],
};

// ------------------------------------------------------------------ Race Stones

/** How rare each band feels, and what it is called when you land on it. */
export const RACE_TIERS = [
  { name: 'Common', color: '#cfc6e0' },
  { name: 'Uncommon', color: '#8aff9a' },
  { name: 'Rare', color: '#9fd4ff' },
  { name: 'Epic', color: '#c08aff' },
  { name: 'Legendary', color: '#ffd76a' },
];
export const tierOf = key => RACE_TIERS[RACES[key]?.tier || 0];

/** The Race Stone's own picture: the drawn stone once its art is in, the dice of fate until then (never a material's icon). */
export const STONE_ART = 'races/race_stone';
export const stoneIcon = has => (has(STONE_ART) ? STONE_ART : 'items/dice_fate');

export const stonesOf = g => Math.max(0, Math.floor(g?.state?.rpg?.raceStones || 0));
export function addStones(g, n = 1) {
  const r = (g.state.rpg ||= {});
  r.raceStones = Math.max(0, (r.raceStones || 0) + n);
  g.emit?.('change');
  return r.raceStones;
}

/**
 * Race slots. You can keep three races at a time and swap between them for nothing; a fourth roll has to push one
 * of them out, so what you hold is a real choice rather than a collection that only ever grows.
 */
export const RACE_SLOTS = 3;

export function raceSlots(g) {
  const r = g?.state?.rpg;
  if (!r) return ['human'];
  if (!Array.isArray(r.raceSlots)) r.raceSlots = [raceOf(g)];
  if (!r.raceSlots.includes(raceOf(g))) r.raceSlots.unshift(raceOf(g));
  if (r.raceSlots.length > RACE_SLOTS) r.raceSlots.length = RACE_SLOTS;
  return r.raceSlots;
}
export const unlockedRaces = raceSlots;                       // what you may wear is what you are holding
export const isUnlocked = (g, key) => raceSlots(g).includes(key);
export const slotsFull = g => raceSlots(g).length >= RACE_SLOTS;

/** Puts a race into a slot. With no index it takes a free one; with one, it replaces what was there. */
export function storeRace(g, key, index = null) {
  if (!validRace(key)) return false;
  const list = raceSlots(g);
  if (list.includes(key)) return true;
  if (index == null) {
    if (list.length >= RACE_SLOTS) return false;
    list.push(key);
  } else {
    list[Math.max(0, Math.min(RACE_SLOTS - 1, index))] = key;
  }
  g.emit?.('change');
  return true;
}

/** Drops one you no longer want, freeing its slot. You always keep at least one. */
export function dropRace(g, key) {
  const list = raceSlots(g);
  if (list.length <= 1 || !list.includes(key)) return false;
  const next = list.find(k => k !== key);
  g.state.rpg.raceSlots = list.filter(k => k !== key);
  if (raceOf(g) === key) setRace(g, next);
  g.emit?.('change');
  return true;
}

/** The whole wheel, rarest last, so the reel always reads the same way. */
export const rollOrder = () => [...ROLLABLE_RACES].sort((a, b) => (RACES[a].tier - RACES[b].tier) || (RACES[b].weight - RACES[a].weight));

/** Picks a race by weight. Rolling one you already have is a real outcome, not a bug. */
export function rollWeighted() {
  const total = ROLLABLE_RACES.reduce((n, k) => n + (RACES[k].weight || 1), 0);
  let x = Math.random() * total;
  for (const k of ROLLABLE_RACES) { x -= RACES[k].weight || 1; if (x <= 0) return k; }
  return 'human';
}

/**
 * Spends one stone and decides the roll - but does not hand it over. The wheel shows the spin first and gives you
 * the race when it lands (applyRoll). The result is kept on your hero until then, so closing the window mid-spin
 * cannot lose it or roll it again: it is handed over the next time anything asks.
 */
export function decideRoll(g) {
  if (stonesOf(g) < 1) return { error: 'You have no Race Stones' };
  applyRoll(g);   // anything left over from before goes first
  addStones(g, -1);
  const key = rollWeighted();
  const look = RACES[key].looks[Math.floor(Math.random() * RACES[key].looks.length)];
  const held = isUnlocked(g, key);
  const res = { ok: true, key, look, fresh: !held, tier: RACES[key].tier, needsSlot: !held && slotsFull(g) };
  g.state.rpg.pendingRoll = res;
  return res;
}

/** Hands over a decided roll (when the wheel lands). Returns what was handed over, or null if nothing was waiting. */
export function applyRoll(g) {
  const r = g?.state?.rpg;
  const res = r?.pendingRoll;
  if (!res) return null;
  r.pendingRoll = null;
  if (!RACES[res.key]) return null;
  if (res.needsSlot) return res;   // no room: the player says which slot it replaces (acceptRoll)
  if (!res.fresh) setRace(g, res.key, lookOf(g) && RACES[res.key].looks.includes(lookOf(g)) ? lookOf(g) : res.look);
  else { storeRace(g, res.key); setRace(g, res.key, res.look); }
  return res;
}

/** Spends one stone and rolls, handing it over at once (the admin command and anything without a wheel). */
export function rollRace(g) {
  const res = decideRoll(g);
  if (res.error) return res;
  applyRoll(g);
  return res;
}

/** Takes the race a full-slot roll produced, in place of one you are holding. */
export function acceptRoll(g, key, look, index) {
  if (!storeRace(g, key, index)) return false;
  setRace(g, key, look);
  return true;
}
