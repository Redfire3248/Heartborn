import { TILE } from '../core/constants.js';
import { ITEMS } from '../data/people.js';
import { addItem, takeItem } from './dynasty.js';
import { takeGear, rpgOf } from './rpg.js';
import { TOOLS, toolsOf, dropTool, giveTool, hotbarOf } from './tools.js';
import { CONSUMABLES, itemsOf, giveItem } from './consumables.js';

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

/**
 * Drop what is in a hotbar slot (or an inventory key) in front of you: tools, potions, bombs... It lands on the
 * ground, and after a moment you (or anyone) can pick it up again by walking over it.
 */
export function dropStack(g, v, key, count = 1) {
  if (!v || !key || key === 'weapon') return null;
  const a = g.hero?.facing ?? Math.PI / 2;
  const x = v.x + Math.cos(a) * TILE * 2.2, y = v.y + Math.sin(a) * TILE * 2.2;
  const base = { id: `gi${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, x, y, noPickUntil: g.state.time + 1.2 };
  let it = null;
  if (key === 'potion') {
    const r = rpgOf(g);
    const n = Math.min(count, r.potions || 0);
    if (!n) return null;
    r.potions -= n;
    it = { ...base, potion: true, count: n };
  } else if (key.startsWith('item:')) {
    const k = key.slice(5), bag = itemsOf(g);
    const n = Math.min(count, bag[k] || 0);
    if (!n) return null;
    bag[k] -= n;
    if (!bag[k]) { delete bag[k]; const bar = hotbarOf(g); const i = bar.indexOf(key); if (i >= 0) bar[i] = null; }
    it = { ...base, consumable: k, count: n };
  } else if (TOOLS[key]) {
    const n = Math.min(count, toolsOf(g)[key] || 0);
    if (!n || !dropTool(g, key, n)) return null;
    it = { ...base, tool: key, count: n };
  }
  if (!it) return null;
  groundItems(g).push(it);
  g.puff({ x, y }, 'effects/dust', 3, 6);
  g.emit('change');
  return it;
}

export const stackIcon = it => (it.tool ? TOOLS[it.tool]?.icon : it.consumable ? CONSUMABLES[it.consumable]?.icon : it.potion ? 'gear/health_potion' : ITEMS[it.item]?.icon);
export const stackName = it => (it.tool ? TOOLS[it.tool]?.name : it.consumable ? CONSUMABLES[it.consumable]?.name : it.potion ? 'Health Potion' : it.gear ? it.gear.name : ITEMS[it.item]?.label || it.item);

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
  if (it.res) {   // a popped resource
    const got = g.addResource(it.res, it.count) ?? it.count;
    const now = g.state.time;
    // one float per resource while you scoop up a pile
    const f = (g._pickFloat ||= {});
    if (f[it.res] && now - f[it.res].at < 0.6) { f[it.res].n += got; f[it.res].fx.text = `+${f[it.res].n} ${it.res}`; f[it.res].fx.life = f[it.res].fx.max || 2.2; f[it.res].at = now; }
    else { g.float(v.x, v.y - TILE * 1.2, `+${got} ${it.res}`, '#ffe7a0'); f[it.res] = { n: got, at: now, fx: g.fx?.floaters?.[g.fx.floaters.length - 1] || {} }; }
    g._pickSound = true;
    g.emit('change');
    return true;
  }
  if (it.tool || it.consumable || it.potion) {
    if (it.tool) giveTool(g, it.tool, it.count);
    else if (it.consumable) giveItem(g, it.consumable, it.count);
    else rpgOf(g).potions = (rpgOf(g).potions || 0) + it.count;
    g.float(it.x, it.y - TILE, `+${it.count > 1 ? it.count + ' ' : ''}${stackName(it)}`, '#ffe7a0');
    g.emit('change');
    return true;
  }
  addItem(v, it.item, it.count);
  g.float(it.x, it.y - TILE, `${v.name}: +${it.count} ${ITEMS[it.item]?.label || it.item}`, '#ffe7a0');
  g.emit('change');
  return true;
}

export function moveItem(g, it, x, y) {
  if (!groundItems(g).includes(it)) return;
  it.x = x; it.y = y;
}
