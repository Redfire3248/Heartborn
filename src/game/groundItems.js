import { TILE } from '../core/constants.js';
import { ITEMS } from '../data/people.js';
import { addItem, takeItem } from './dynasty.js';
import { takeGear } from './rpg.js';

/*
 * Items lying on the ground: dropped from a pack (drag it off onto the map), or by the admin `drop` command.
 * Drag one onto a villager to give it to them, drag it somewhere else to move it,
 * or walk over it with your avatar to pick it up.
 */

export const groundItems = g => (g.state.groundItems ||= []);

export function dropItem(g, item, count, x, y) {
  if (!ITEMS[item] || count < 1) return null;
  const it = { id: `gi${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, item, count: Math.floor(count), x, y };
  groundItems(g).push(it);
  g.puff({ x, y }, 'effects/spark', 3, 8);
  g.emit('change');
  return it;
}

/** Take items out of someone's pack and put them on the ground. */
export function dropFromPack(g, v, item, count, x, y) {
  let n = 0;
  while (n < count && takeItem(v, item)) n++;
  return n ? dropItem(g, item, n, x, y) : null;
}

export function itemAt(g, x, y, r = TILE * 0.7) {
  let best = null, bd = r;
  for (const it of groundItems(g)) {
    const d = Math.hypot(it.x - x, it.y - TILE * 0.2 - y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

export function pickUp(g, v, it) {
  const list = groundItems(g);
  if (!list.includes(it)) return false;
  g.state.groundItems = list.filter(x => x !== it);
  // loot from a fight: weapons, armour and trinkets are yours (the player's), whoever picks them up
  if (it.gear) { takeGear(g, it.gear, v); return true; }
  addItem(v, it.item, it.count);
  g.float(it.x, it.y - TILE, `${v.name}: +${it.count} ${ITEMS[it.item]?.label || it.item}`, '#ffe7a0');
  g.emit('change');
  return true;
}

export function moveItem(g, it, x, y) {
  if (!groundItems(g).includes(it)) return;
  it.x = x; it.y = y;
}
