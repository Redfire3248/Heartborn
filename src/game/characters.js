/*
 * The people you can be.
 *
 * Every character is one person, and every race is a version of that person (see races.js): Kai the zombie is
 * still Kai. Adam and Eve are there from the start; everyone else is earned, each through one of the game's
 * achievements. Earning a character belongs to your ACCOUNT, not to one world: it is kept on this device and in
 * your private account record in the cloud, so Kai earned in one world is yours in every world, on every device.
 * An admin has them all.
 */

/**
 * `id` is the art suffix (races/<race>_<id>.png). `sex` picks the Adam or Eve version of a race whose art this
 * person does not have yet, so nobody is ever drawn with a missing picture. `achievement` is the id of the
 * achievement in journal.js that unlocks them (null: free).
 */
export const CHARACTERS = [
  { id: 'm', name: 'Adam', sex: 'm', desc: 'The first man. Broad, dark-haired, steady.', achievement: null },
  { id: 'f', name: 'Eve', sex: 'f', desc: 'The first woman. Slighter, fair-haired, quick.', achievement: null },
  { id: 'nia', name: 'Nia', sex: 'f', desc: 'Sharp green eyes and a black bob. Never without her gold earrings.', achievement: 'lv10', how: 'Reach level 10' },
  { id: 'bram', name: 'Bram', sex: 'm', desc: 'A big ginger bear of a man with braided wristbands.', achievement: 'miner', how: 'Mine 50 ores' },
  { id: 'luna', name: 'Luna', sex: 'f', desc: 'Pink pigtails, star clips and far more nerve than her size.', achievement: 'smith', how: 'Forge 10 things' },
  { id: 'zed', name: 'Zed', sex: 'm', desc: 'Quick on his feet, orange headband always on.', achievement: 'delver', how: 'Reach dungeon floor 5' },
  { id: 'sable', name: 'Sable', sex: 'f', desc: 'A long purple braid and a silver crescent. Says little.', achievement: 'boss', how: 'Defeat a boss' },
  { id: 'ivy', name: 'Ivy', sex: 'f', desc: 'Green hair, a daisy behind her ear and no patience at all.', achievement: 'rampage', how: 'Kill 20 in a row' },
  { id: 'rook', name: 'Rook', sex: 'm', desc: 'Bald, bearded and one-eyed. Has seen everything twice.', achievement: 'lv25', how: 'Reach level 25' },
  { id: 'kai', name: 'Kai', sex: 'm', desc: 'White hair, red eyes and a long red scarf.', achievement: 'hall10', how: 'Fell 10 different bosses' },
];
export const CHARACTER_IDS = CHARACTERS.map(c => c.id);
export const characterById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
export const isCharacter = id => CHARACTER_IDS.includes(id);

// ------------------------------------------------------------------ what you have earned

const KEY = 'hb_chars';
let admin = false;
/** An admin has every character. Set once the account is known to be one. */
export const setCharAdmin = on => { admin = !!on; };

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private window */ }
}

/** Characters you may pick: the free ones, the ones you earned, or all of them for an admin. */
export const hasCharacter = id => admin || !characterById(id).achievement || !!read()[id];
export const earnedCharacters = () => ({ ...read() });

/** Newly earned characters you have not opened the Character page to see yet (the badge on the menu). */
export const unseenCharacters = () => Object.entries(read()).filter(([, v]) => v && !v.seen).map(([k]) => k);
export function markCharactersSeen() {
  const all = read();
  for (const k of Object.keys(all)) all[k] = { ...(typeof all[k] === 'object' ? all[k] : { at: all[k] }), seen: true };
  write(all);
}

/** Merge characters earned elsewhere (the cloud record) into this device. Returns true if anything was new. */
export function mergeCharacters(fromCloud = {}) {
  const all = read();
  let changed = false;
  for (const [k, v] of Object.entries(fromCloud || {})) if (isCharacter(k) && !all[k]) { all[k] = typeof v === 'object' ? v : { at: v }; changed = true; }
  if (changed) write(all);
  return changed;
}

/**
 * Unlock the characters an achievement opens. Returns the characters newly earned (so the game can celebrate),
 * and `onEarn` (set by the game) stores them in your account record in the cloud.
 */
let onEarn = null;
export const onCharacterEarned = fn => { onEarn = fn; };
export function unlockForAchievement(achId) {
  const all = read();
  const fresh = CHARACTERS.filter(c => c.achievement === achId && !all[c.id]);
  if (!fresh.length) return [];
  for (const c of fresh) all[c.id] = { at: Date.now(), seen: false };
  write(all);
  try { onEarn?.(read()); } catch { /* offline: it stays on this device and goes up next time */ }
  return fresh;
}

/** Everything a world has already achieved unlocks its characters too (worlds from before characters existed). */
export function unlockFromAchievements(achievements = {}) {
  const fresh = [];
  for (const id of Object.keys(achievements || {})) fresh.push(...unlockForAchievement(id));
  return fresh;
}
