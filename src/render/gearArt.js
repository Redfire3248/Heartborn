import { sprite, spriteAvailable } from '../core/assets.js';
import { CATALOG, slotOf } from '../game/rpg.js';

/** The picture for a piece of gear: its own art if it is in, otherwise a close stand-in, so new types work right away. */
/**
 * Real art that exists (a sheet that is not sliced yet only has placeholders). It asks whether the picture EXISTS,
 * not whether it has finished downloading: pictures load on demand now, and asking "is it loaded" made the hotbar
 * pick a stand-in (the iron-looking pickaxe) on its first draw and only show the real wooden one once it was
 * redrawn. sprite() starts the download; an <img> points straight at the file, and the canvas draws it next frame.
 */
export const hasArt = k => { if (!k || !spriteAvailable(k)) return false; sprite(k); return true; };

export function gearIconKey(it) {
  if (!it) return null;
  const def = CATALOG[it.slot || slotOf(it.base)]?.[it.base];
  // its own art, else the type's plain art, else the closest existing picture
  return [it.icon, def?.icon, def?.fallbackIcon].find(k => hasArt(k)) || def?.fallbackIcon || def?.icon || it.icon || null;
}
