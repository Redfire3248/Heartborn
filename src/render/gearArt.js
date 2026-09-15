import { sprite, spriteAvailable } from '../core/assets.js';
import { CATALOG, slotOf } from '../game/rpg.js';

/** The picture for a piece of gear: its own art if it is in, otherwise a close stand-in, so new types work right away. */
/** Real art that exists (a sheet that is not sliced yet only has placeholders). */
export const hasArt = k => !!k && spriteAvailable(k) && !!sprite(k);

export function gearIconKey(it) {
  if (!it) return null;
  const def = CATALOG[it.slot || slotOf(it.base)]?.[it.base];
  // its own art, else the type's plain art, else the closest existing picture
  return [it.icon, def?.icon, def?.fallbackIcon].find(k => k && spriteAvailable(k) && sprite(k)) || def?.fallbackIcon || def?.icon || it.icon || null;
}
