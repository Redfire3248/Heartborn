import { TILE } from '../core/constants.js';
import { rpgOf, heroStats } from './rpg.js';
import { addItemToHotbar } from './tools.js';

/*
 * Consumables: potions, bombs and food you carry in stacks, put in your hotbar and use with your swing.
 * Buffs last a while (speed, strength, invisibility, ammo); bombs and dynamite are thrown and explode.
 */
export const CONSUMABLES = {
  mana_potion:         { name: 'Mana Potion',         does: 'Fills your stamina and doubles its recovery for 20s' },
  speed_potion:        { name: 'Speed Potion',        does: 'Move 50% faster for 30s' },
  strength_potion:     { name: 'Strength Potion',     does: 'Deal 50% more damage for 30s' },
  invisibility_potion: { name: 'Invisibility Potion', does: 'Monsters cannot see you for 15s' },
  antidote:            { name: 'Antidote',            does: 'Cures poison, burning and slowness' },
  bomb:                { name: 'Bomb',                does: 'Throw it: explodes for 80 damage around where it lands', throw: { dmg: 80, radius: 2, range: 4 } },
  dynamite:            { name: 'Dynamite',            does: 'Throw it: a huge blast for 160 damage', throw: { dmg: 160, radius: 3.2, range: 4.5 } },
  med_kit:             { name: 'Med Kit',             does: 'Heals you completely' },
  golden_apple:        { name: 'Golden Apple',        does: 'Heals half your health, then 5 health a second for 10s' },
  ammo_box:            { name: 'Ammo Box',            does: 'Guns, bows and staffs deal 30% more damage for 60s' },
};
for (const [k, c] of Object.entries(CONSUMABLES)) c.icon = `armory/${k}`;

export const itemsOf = g => (rpgOf(g).items ||= {});
export const buffActive = (g, name) => (g.hero?.buffs?.[name] || 0) > g.state.time;

export function giveItem(g, key, n = 1) {
  if (!CONSUMABLES[key]) return false;
  const items = itemsOf(g);
  const isNew = !items[key];
  items[key] = (items[key] || 0) + n;
  if (isNew) addItemToHotbar(g, `item:${key}`);
  g.emit?.('change');
  return true;
}

/** Use one from your stack. Returns true if it was used. */
export function useItem(g, v, key) {
  const items = itemsOf(g);
  const c = CONSUMABLES[key];
  const h = g.hero;
  if (!c || !h || !(items[key] > 0)) return false;
  const st = heroStats(g);
  const now = g.state.time;
  const buff = (name, secs, text, color) => { (h.buffs ||= {})[name] = now + secs; g.float(v.x, v.y - TILE * 1.5, text, color); };
  switch (key) {
    case 'mana_potion': h.stamina = st.maxStamina; buff('stamina', 20, 'Stamina restored!', '#7ab8ff'); break;
    case 'speed_potion': buff('speed', 30, 'Speed!', '#8fe07a'); break;
    case 'strength_potion': buff('strength', 30, 'Strength!', '#ff6a5a'); break;
    case 'invisibility_potion': buff('invis', 15, 'Invisible...', '#d8e0ff'); break;
    case 'antidote': h.dot = null; h.slow = null; g.float(v.x, v.y - TILE * 1.5, 'Cured', '#ffe07a'); break;
    case 'med_kit':
      if (v.hp >= st.maxHp) { g.float(v.x, v.y - TILE * 1.3, 'Already at full health', '#d9d4c7'); return false; }
      v.hp = st.maxHp; g.float(v.x, v.y - TILE * 1.5, 'Fully healed', '#ff9f9f'); break;
    case 'golden_apple': v.hp = Math.min(st.maxHp, v.hp + st.maxHp * 0.5); buff('regen', 10, 'Golden!', '#ffd76a'); break;
    case 'ammo_box': buff('ammo', 60, 'Locked and loaded', '#ffcf5a'); break;
    case 'bomb': case 'dynamite': {
      const t = c.throw;
      const a = h.facing || 0;
      (h.arrows ||= []).push({ kind: key, x: v.x, y: v.y - 10, vx: Math.cos(a) * TILE * 6, vy: Math.sin(a) * TILE * 6, left: TILE * t.range, dmg: t.dmg, explode: t.radius, explodeAtEnd: true, sprite: `armory/${key}`, spin: true, lob: true, hitIds: [] });
      break;
    }
  }
  items[key]--;
  if (!items[key]) delete items[key];
  g.anim('combat/parry', v.x, v.y - 12, { size: 26, dur: 0.25 });
  g.emit('change');
  return true;
}

/** Buff upkeep each frame: healing over time. */
export function updateBuffs(g, v, dt) {
  const h = g.hero;
  if (!h?.buffs) return;
  if (buffActive(g, 'regen')) v.hp = Math.min(heroStats(g).maxHp, v.hp + 5 * dt);
}
