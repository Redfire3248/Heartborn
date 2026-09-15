import { TILE } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';

/*
 * The player's own progression, RPG style. You are your avatar: you level up from fights, bounties and quests,
 * spend points on Might, Vigor and Agility, and wear gear that drops from monsters in four rarities.
 * Progress belongs to you (state.rpg), so it stays when you choose a different villager to play as.
 */

export const RARITY = [
  { name: 'Common', color: '#d9d4c7', mult: 1 },
  { name: 'Rare', color: '#5aa9ff', mult: 1.25 },
  { name: 'Epic', color: '#c77dff', mult: 1.55 },
  { name: 'Legendary', color: '#ffb347', mult: 2 },
];

// dmg per hit, range in tiles, speed = seconds between swings, arc = swing width in radians
export const WEAPONS = {
  fists: { name: 'Fists', dmg: 6, range: 1.0, speed: 0.4, arc: 1.4, icon: null },
  hammer: { name: 'War Hammer', dmg: 24, range: 1.05, speed: 0.85, arc: 1.5, stun: 0.5, icon: 'gear/war_hammer' },
  axe: { name: 'Battle Axe', dmg: 19, range: 1.15, speed: 0.7, arc: 1.8, icon: 'gear/battle_axe' },
  pickaxe: { name: 'Pick', dmg: 13, range: 1.0, speed: 0.6, arc: 1.2, icon: 'items/pickaxe' },
  hoe: { name: 'Hoe', dmg: 9, range: 1.2, speed: 0.55, arc: 1.2, icon: 'items/hoe' },
  spear: { name: 'Spear', dmg: 13, range: 1.8, speed: 0.6, arc: 0.8, icon: 'gear/spear' },
  sword: { name: 'Sword', dmg: 16, range: 1.3, speed: 0.48, arc: 1.9, icon: 'gear/sword_common' },
  bow: { name: 'Bow', dmg: 12, range: 8, speed: 0.75, ranged: true, icon: 'gear/bow_common' },
};
export const ARMORS = {
  leather: { name: 'Leather Armour', armor: 0.12, icon: 'gear/leather_armor' },
  chain: { name: 'Chain Mail', armor: 0.25, icon: 'gear/chain_mail' },
  plate: { name: 'Plate Armour', armor: 0.38, icon: 'gear/plate_armor' },
};
export const TRINKETS = {
  ring: { name: 'Ring of Might', bonus: { dmg: 0.12 }, icon: 'gear/ring' },
  boots: { name: 'Swift Boots', bonus: { speed: 0.12 }, icon: 'gear/boots' },
  amulet: { name: 'Amulet of Vigor', bonus: { hp: 30 }, icon: 'gear/amulet' },
};

const START = { level: 1, xp: 0, points: 0, might: 0, vigor: 0, agility: 0, gear: { weapon: null, armor: null, trinket: null }, bag: [], quests: [], questsDone: 0 };

export function rpgOf(g) {
  const s = g.state;
  if (!s.rpg) s.rpg = JSON.parse(JSON.stringify(START));
  return s.rpg;
}

/** Swords and bows show their rarity: plain, glowing blue, runed purple, golden flame. */
export function weaponIcon(base, rarity) {
  if (base === 'sword') return `gear/sword_${['common', 'rare', 'epic', 'legendary'][rarity] || 'common'}`;
  if (base === 'bow') return rarity ? 'gear/bow_rare' : 'gear/bow_common';
  return WEAPONS[base]?.icon || null;
}

export const xpToNext = level => Math.round(60 * Math.pow(level, 1.5));

/** Everything derived from level, points and gear. */
export function heroStats(g) {
  const r = rpgOf(g);
  const bonus = { dmg: 0, hp: 0, speed: 0 };
  for (const it of Object.values(r.gear)) for (const [k, n] of Object.entries(it?.bonus || {})) bonus[k] = (bonus[k] || 0) + n;
  const armor = r.gear.armor ? r.gear.armor.armor : 0;
  return {
    maxHp: Math.round(100 + (r.level - 1) * 10 + r.vigor * 12 + bonus.hp),
    maxStamina: Math.round(100 + r.agility * 8 + (r.level - 1) * 3),
    dmgMult: 1 + r.might * 0.08 + (r.level - 1) * 0.04 + bonus.dmg,
    speed: 1 + r.agility * 0.03 + bonus.speed,
    crit: 0.05 + r.agility * 0.012,
    armor: Math.min(0.7, armor),
  };
}

/** The weapon in your hand: your equipped gear, or whatever your villager carries. */
export function heroWeapon(g, v) {
  const w = rpgOf(g).gear.weapon;
  if (w) return { ...WEAPONS[w.base], ...w, dmg: w.dmg };
  const pack = v?.inv?.pack || {};
  const key = pack.sword ? 'sword' : pack.spear ? 'spear' : v?.armed ? 'spear' : pack.axe ? 'axe' : pack.hammer ? 'hammer' : pack.pickaxe ? 'pickaxe' : pack.bow ? 'bow' : 'fists';
  return { ...WEAPONS[key], base: key, rarity: 0 };
}

// ------------------------------------------------------------------ experience

export function gainXp(g, n, v = null) {
  const r = rpgOf(g);
  n = Math.max(1, Math.round(n));
  r.xp += n;
  if (v) g.float(v.x + 10, v.y - TILE * 1.5, `+${n} XP`, '#9fd4ff');
  let levels = 0;
  while (r.xp >= xpToNext(r.level)) {
    r.xp -= xpToNext(r.level);
    r.level++;
    r.points += 3;
    levels++;
  }
  if (levels) {
    const st = heroStats(g);
    if (v) { v.hp = st.maxHp; g.puff({ x: v.x, y: v.y - 10 }, 'effects/spark', 24, 30); }
    g.announce(`Level ${r.level}! +${3 * levels} points to spend`);
    g.log(`You reached level ${r.level}. Open your Character sheet to spend your points.`, 'good');
    g.emit('levelUp', r.level);
  }
  g.emit('change');
  return levels;
}

export function spendPoint(g, stat) {
  const r = rpgOf(g);
  if (r.points <= 0 || !['might', 'vigor', 'agility'].includes(stat)) return false;
  r.points--;
  r[stat]++;
  g.emit('change');
  return true;
}

// ------------------------------------------------------------------ loot

const pickRarity = (g, boss) => {
  const lvl = rpgOf(g).level;
  const roll = Math.random() * 100 - Math.min(20, lvl) - g.state.era * 2 - (boss ? 45 : 0);
  return roll < 2 ? 3 : roll < 12 ? 2 : roll < 38 ? 1 : 0;
};

/** A new piece of gear: weapon, armour or trinket, stronger with rarity. */
export function rollGear(g, { boss = false, slot = null } = {}) {
  const rarity = pickRarity(g, boss);
  const R = RARITY[rarity];
  const kind = slot || (Math.random() < 0.55 ? 'weapon' : Math.random() < 0.6 ? 'armor' : 'trinket');
  const id = `gear${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`;
  if (kind === 'weapon') {
    const base = ['sword', 'axe', 'hammer', 'spear', 'bow'][Math.floor(Math.random() * 5)];
    const W = WEAPONS[base];
    return { id, slot: 'weapon', base, rarity, name: `${R.name === 'Common' ? '' : R.name + ' '}${W.name}`, dmg: Math.round(W.dmg * R.mult * (1 + g.state.era * 0.08)), icon: weaponIcon(base, rarity) };
  }
  if (kind === 'armor') {
    const base = ['leather', 'chain', 'plate'][Math.min(2, Math.floor(Math.random() * (1.5 + rarity)))];
    const A = ARMORS[base];
    return { id, slot: 'armor', base, rarity, name: `${R.name === 'Common' ? '' : R.name + ' '}${A.name}`, armor: Math.round(A.armor * R.mult * 100) / 100, icon: A.icon };
  }
  const base = ['ring', 'boots', 'amulet'][Math.floor(Math.random() * 3)];
  const T = TRINKETS[base];
  const bonus = Object.fromEntries(Object.entries(T.bonus).map(([k, n]) => [k, Math.round(n * R.mult * 100) / 100]));
  return { id, slot: 'trinket', base, rarity, name: `${R.name === 'Common' ? '' : R.name + ' '}${T.name}`, bonus, icon: T.icon };
}

/** How good a piece of gear is, to compare with what you wear. */
export const gearScore = it => (it ? (it.dmg || 0) + (it.armor || 0) * 60 + Object.values(it.bonus || {}).reduce((n, b) => n + b * (b < 1 ? 80 : 0.5), 0) + it.rarity * 3 : 0);

/** Picked up: better than what you wear goes straight on, anything else into your bag. */
export function takeGear(g, it, v = null) {
  const r = rpgOf(g);
  const worn = r.gear[it.slot];
  if (gearScore(it) > gearScore(worn)) {
    if (worn) r.bag.push(worn);
    r.gear[it.slot] = it;
    if (v) g.float(v.x, v.y - TILE * 1.4, `Equipped ${it.name}`, RARITY[it.rarity].color);
  } else {
    r.bag.push(it);
    if (r.bag.length > 24) r.bag.shift();
    if (v) g.float(v.x, v.y - TILE * 1.4, `+ ${it.name}`, RARITY[it.rarity].color);
  }
  g.emit('change');
}

export function equip(g, id) {
  const r = rpgOf(g);
  const i = r.bag.findIndex(x => x.id === id);
  if (i < 0) return false;
  const [it] = r.bag.splice(i, 1);
  if (r.gear[it.slot]) r.bag.push(r.gear[it.slot]);
  r.gear[it.slot] = it;
  g.emit('change');
  return true;
}

export function unequip(g, slot) {
  const r = rpgOf(g);
  if (!r.gear[slot]) return false;
  r.bag.push(r.gear[slot]);
  r.gear[slot] = null;
  g.emit('change');
  return true;
}

export function scrapGear(g, id) {
  const r = rpgOf(g);
  const i = r.bag.findIndex(x => x.id === id);
  if (i < 0) return 0;
  const [it] = r.bag.splice(i, 1);
  const gold = 8 * (1 + it.rarity * it.rarity * 2);
  g.addResource('gold', gold);
  g.emit('change');
  return gold;
}

// ------------------------------------------------------------------ quests

const QUEST_KILLS = [['wolf', 'wolves'], ['boar', 'boars'], ['bandit', 'bandits'], ['goblin', 'goblins'], ['skeleton', 'skeletons'], ['giant_spider', 'giant spiders'], ['slime', 'slimes']];

function newQuest(g) {
  const r = rpgOf(g);
  const lvl = r.level;
  const roll = Math.random();
  const id = `q${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  if (roll < 0.5) {
    const n = 3 + Math.floor(Math.random() * 3) + Math.floor(lvl / 3);
    return { id, kind: 'slay', need: n, have: 0, text: `Slay ${n} beasts or raiders`, xp: 40 + lvl * 15, gold: 20 + lvl * 8 };
  }
  if (roll < 0.7) {
    const [type, plural] = QUEST_KILLS[Math.floor(Math.random() * QUEST_KILLS.length)];
    const n = 2 + Math.floor(Math.random() * 2);
    return { id, kind: 'slayType', type, need: n, have: 0, text: `Hunt down ${n} ${plural}`, xp: 60 + lvl * 18, gold: 30 + lvl * 10, spawn: true };
  }
  if (roll < 0.85) return { id, kind: 'bounty', need: 1, have: 0, text: 'Claim a bounty', xp: 120 + lvl * 25, gold: 40 + lvl * 12 };
  const n = 4 + Math.floor(Math.random() * 4);
  return { id, kind: 'gather', need: n, have: 0, text: `Chop or mine ${n} times`, xp: 30 + lvl * 10, gold: 15 + lvl * 5 };
}

/** Keep three quests on the board; quests that ask for a certain beast make sure some are out there. */
export function updateQuests(g) {
  const r = rpgOf(g);
  for (let tries = 0; r.quests.length < 3 && tries < 12; tries++) {
    const q = newQuest(g);
    if (r.quests.some(x => x.kind === q.kind && x.type === q.type)) continue;   // no two of the same
    r.quests.push(q);
    if (q.spawn && CREATURES[q.type]) {
      for (let i = 0; i < q.need; i++) {
        const p = g.randomLandTile(8, 18);
        if (p) g.spawnCreature(q.type, p.x, p.y, { questId: q.id });
      }
    }
  }
}

export function questProgress(g, kind, detail = {}) {
  const r = rpgOf(g);
  let finished = false;
  for (const q of r.quests) {
    if (q.have >= q.need) continue;
    // any kill counts for "slay beasts"; a hunt needs that very beast
    const hit = (q.kind === kind && (q.kind !== 'slayType' || detail.type === q.type)) || (q.kind === 'slay' && kind === 'slayType');
    if (!hit) continue;
    q.have++;
    if (q.have >= q.need) finished = true;
  }
  if (finished) completeQuests(g, detail.v);
}

function completeQuests(g, v) {
  const r = rpgOf(g);
  for (const q of r.quests.filter(x => x.have >= x.need)) {
    r.questsDone++;
    g.addResource('gold', q.gold);
    g.log(`Quest complete: ${q.text}. +${q.xp} XP, +${q.gold} gold`, 'good');
    g.announce(`Quest complete: ${q.text}`);
    gainXp(g, q.xp, v);
    if (Math.random() < 0.5) takeGear(g, rollGear(g), v);
  }
  r.quests = r.quests.filter(x => x.have < x.need);
  updateQuests(g);
}

// ------------------------------------------------------------------ kills

/** You killed something: experience, maybe loot on the ground, and quest progress. */
export function onHeroKill(g, c, v) {
  const def = CREATURES[c.t];
  if (!def) return;
  const boss = !!def.boss || !!c.bounty;
  gainXp(g, (def.hp * (c.scale || 1)) / 3 * (boss ? 2 : 1) + (def.hostile ? 5 : 1), v);
  if (def.hostile) questProgress(g, 'slayType', { type: c.t, v });
  if (c.bounty) questProgress(g, 'bounty', { v });
  const chance = boss ? 1 : def.hostile ? 0.2 : 0.03;
  if (Math.random() < chance) {
    const it = rollGear(g, { boss });
    (g.state.groundItems ||= []).push({ id: it.id, gear: it, item: null, count: 1, x: c.x + (Math.random() - 0.5) * 10, y: c.y + (Math.random() - 0.5) * 10 });
    g.float(c.x, c.y - TILE * 1.2, `${RARITY[it.rarity].name} loot!`, RARITY[it.rarity].color);
  }
}
