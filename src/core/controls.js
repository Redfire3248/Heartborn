/*
 * Key bindings. Every action has a default key; players can change them in Settings → Controls.
 * Saved on this device. Arrow keys always move as well, whatever movement is bound to.
 */

export const ACTIONS = [
  { id: 'up', label: 'Move up', group: 'Moving', def: 'w' },
  { id: 'down', label: 'Move down', group: 'Moving', def: 's' },
  { id: 'left', label: 'Move left', group: 'Moving', def: 'a' },
  { id: 'right', label: 'Move right', group: 'Moving', def: 'd' },
  { id: 'dash', label: 'Dash', group: 'Moving', def: 'shift' },
  { id: 'attack', label: 'Attack / use held item', group: 'Fighting', def: ' ' },
  { id: 'block', label: 'Block (hold)', group: 'Fighting', def: 'q' },
  { id: 'potion', label: 'Drink a potion', group: 'Fighting', def: 't' },
  { id: 'drop', label: 'Drop the held item', group: 'Fighting', def: 'z' },
  { id: 'ability', label: 'Weapon ability', group: 'Fighting', def: 'f' },
  { id: 'backpack', label: 'Backpack, and use what you stand at', group: 'Screens', def: 'e' },
  { id: 'character', label: 'Character', group: 'Screens', def: 'g' },
  { id: 'inventory', label: 'Inventory (also on ~)', group: 'Screens', def: 'i' },
  { id: 'index', label: 'Index', group: 'Screens', def: 'n' },
  { id: 'journal', label: 'Journal (daily and achievements)', group: 'Screens', def: 'o' },
  { id: 'bosses', label: 'Hall of Bosses (records and rematches)', group: 'Screens', def: 'h' },
  { id: 'pets', label: 'Pets', group: 'Screens', def: 'p' },
  { id: 'map', label: 'World map', group: 'Screens', def: 'v' },
  { id: 'build', label: 'Build menu', group: 'Screens', def: 'b' },
  { id: 'craft', label: 'Craft menu', group: 'Screens', def: 'c' },
  { id: 'jobs', label: 'People', group: 'Screens', def: 'j', feature: 'people' },
  { id: 'court', label: 'Court', group: 'Screens', def: 'u', feature: 'court' },
  { id: 'deeds', label: 'Laws', group: 'Screens', def: 'k', feature: 'laws' },
  { id: 'log', label: 'Chronicle', group: 'Screens', def: 'l', feature: 'chronicle' },
  { id: 'world', label: 'World', group: 'Screens', def: 'm' },
  { id: 'demolish', label: 'Demolish tool', group: 'Building', def: 'x' },
  { id: 'rebuild', label: 'Build the last building again', group: 'Building', def: 'r' },
  ...Array.from({ length: 9 }, (_, i) => ({ id: `hot${i + 1}`, label: `Hotbar slot ${i + 1}`, group: 'Hotbar', def: String(i + 1) })),
];
export const CONTROL_GROUPS = [...new Set(ACTIONS.map(a => a.group))];

const STORE = 'hb-controls';
let cache = null;

export function binds() {
  if (cache) return cache;
  cache = Object.fromEntries(ACTIONS.map(a => [a.id, a.def]));
  try { Object.assign(cache, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch {}
  return cache;
}

const save = () => {
  const b = binds();
  const changed = Object.fromEntries(ACTIONS.filter(a => b[a.id] !== a.def).map(a => [a.id, b[a.id]]));
  try { localStorage.setItem(STORE, JSON.stringify(changed)); } catch {}
};

export const keyOf = id => binds()[id];
/** Is this key (lower-case e.key) bound to the action? */
export const is = (k, id) => k === binds()[id];
/** Is the action's key held down in this set of keys? */
export const held = (keys, id) => keys.has(binds()[id]);
/** Which action a key is bound to (or null). */
export const actionOf = k => ACTIONS.find(a => binds()[a.id] === k)?.id || null;

/** Bind a key. If another action had that key, the two swap. */
export function setBind(id, key) {
  const b = binds();
  const other = ACTIONS.find(a => a.id !== id && b[a.id] === key);
  if (other) b[other.id] = b[id];
  b[id] = key;
  save();
  return other ? other.id : null;
}

export function resetBinds() {
  cache = Object.fromEntries(ACTIONS.map(a => [a.id, a.def]));
  save();
}

const NAMES = { ' ': 'Space', shift: 'Shift', control: 'Ctrl', alt: 'Alt', meta: 'Cmd', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', enter: 'Enter', tab: 'Tab', backspace: 'Backspace' };
export const keyLabel = k => NAMES[k] || (k?.length === 1 ? k.toUpperCase() : k ? k[0].toUpperCase() + k.slice(1) : '—');

/** Keys that cannot be bound (they already do something everywhere). */
export const RESERVED = new Set(['escape', 'f2', '/', 'h']);
