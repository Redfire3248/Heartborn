import { spriteAvailable } from '../core/assets.js';
/*
 * The heroes you can look like. Each has front, back and side art (public/assets/avatars/<id>_<view>.png), with
 * empty hands: your real sword, shield and tools are drawn on top. The choice is kept per world, and a new world
 * starts with the look you picked last.
 */
export const AVATARS = [
  { id: 'king', name: 'King' },
  { id: 'queen', name: 'Queen' },
  { id: 'knight_boy', name: 'Knight' },
  { id: 'knight_girl', name: 'Dame Knight' },
  { id: 'adventurer_boy', name: 'Adventurer' },
  { id: 'adventurer_girl', name: 'Wanderer' },
  { id: 'wizard', name: 'Wizard' },
  { id: 'rogue', name: 'Rogue' },
];

const LAST_KEY = 'hb_avatar';
const valid = id => AVATARS.some(a => a.id === id);

export function lastAvatar() {
  try { const id = localStorage.getItem(LAST_KEY); return valid(id) ? id : 'king'; } catch { return 'king'; }
}

/** Your look in this world (new worlds take the last one you picked). */
export function avatarId(g) {
  if (!valid(g.state.avatar)) g.state.avatar = valid(g.state.rpg?.avatar) ? g.state.rpg.avatar : lastAvatar();
  return g.state.avatar;
}

export function setLook(g, id) {
  if (!valid(id)) return false;
  g.state.avatar = id;
  try { localStorage.setItem(LAST_KEY, id); } catch { /* private mode */ }
  return true;
}

/**
 * What your hero actually looks like. A character chosen from a race wears that race's art, which has one pose,
 * so every view uses it; anyone still on an old avatar keeps their three-view art.
 */
export function heroLook(g, view = 'front') {
  const r = g?.state?.rpg;
  // your race as the person you are - worked out here, not just read, because a fresh world has no look stored
  // until something asks, and without one you were drawn as the old crowned avatar instead of your character
  let base = r?.base;
  if (base !== 'm' && base !== 'f') { try { base = localStorage.getItem('hb_base') === 'f' ? 'f' : 'm'; } catch { base = 'm'; } }
  const look = r?.look && spriteAvailable(`races/${r.look}`) ? r.look : `${r?.race || 'human'}_${base}`;
  if (spriteAvailable(`races/${look}`)) return `races/${look}`;
  return avatarArt(avatarId(g), view);
}

/** Art key for a view: 'front', 'back' or 'side' (side faces right). */
export const avatarArt = (id, view = 'front') => `avatars/${valid(id) ? id : 'king'}_${view}`;
