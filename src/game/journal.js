/*
 * The Journal: a free chest every day, three daily challenges, and achievements that give you a title to show
 * under your name. Days are real days (they reset at midnight on your device), so there is a reason to come back.
 */
import { giveEgg } from './pets.js';
import { rpgOf, rollGear, takeGear, RARITY, CATALOG } from './rpg.js';
import { toolsOf, TOOLS } from './tools.js';
import { giveItem } from './consumables.js';
import { gameTheme } from './worldTypes.js';
import { ORE_RESOURCE } from './loot.js';
import { CREATURES, OBJECTS } from '../data/objects.js';

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = list => list[Math.floor(Math.random() * list.length)];
const nice = k => k.replace(/_ore$/, '').replace(/_/g, ' ');

// ------------------------------------------------------------------ daily challenges

/** Makes one challenge of each of three different kinds. */
function rollChallenges(g) {
  const ores = (gameTheme(g).ores || []).filter(k => OBJECTS[k] && ORE_RESOURCE[k]);
  const pool = [
    () => { const n = rand(12, 25); return { kind: 'mine', need: n, text: `Mine ${n} ores` }; },
    () => { const o = pick(ores.length ? ores : ['iron_ore']); const n = rand(4, 8); return { kind: 'mineType', type: o, need: n, text: `Mine ${n} ${nice(o)} ore` }; },
    () => { const n = rand(8, 16); return { kind: 'slay', need: n, text: `Defeat ${n} monsters` }; },
    () => { const n = rand(2, 4); return { kind: 'forge', need: n, text: `Forge ${n} things` }; },
    () => ({ kind: 'enchant', need: 1, text: 'Enchant something' }),
    () => { const n = rand(10, 30); return { kind: 'sell', need: n, text: `Sell ${n} materials at a Market Stall` }; },
    () => ({ kind: 'explore', need: 2, text: 'Visit 2 different biomes' }),
    () => ({ kind: 'boss', need: 1, text: 'Defeat a boss' }),
  ];
  const out = [];
  const used = new Set();
  while (out.length < 3) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    const c = pool[i]();
    c.id = `c${out.length}`; c.have = 0; c.claimed = false;
    c.reward = { gold: rand(40, 90) * (c.kind === 'boss' ? 3 : 1), gems: c.kind === 'boss' || c.kind === 'enchant' ? rand(3, 6) : rand(0, 2) };
    out.push(c);
  }
  return out;
}

/** Today's journal page (a new one each real day). */
export function dailyOf(g) {
  const r = rpgOf(g);
  const d = (r.daily ||= {});
  if (d.day !== todayKey()) {
    d.day = todayKey();
    d.chest = false;
    d.challenges = rollChallenges(g);
    d.bonus = false;
    d.biomes = [];
    d.streak = d.lastDay && isYesterday(d.lastDay) ? (d.streak || 0) + 1 : 1;
  }
  return d;
}
const isYesterday = key => { const y = new Date(); y.setDate(y.getDate() - 1); return key === `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`; };

/** Something happened: count it toward today's challenges. */
export function dailyProgress(g, kind, detail = {}) {
  if (!g?.state?.rpg && !rpgOf(g)) return;
  const d = dailyOf(g);
  let changed = false;
  if (kind === 'explore') {
    if (!detail.type || d.biomes.includes(detail.type)) return;
    d.biomes.push(detail.type);
  }
  for (const c of d.challenges) {
    if (c.have >= c.need) continue;
    const hit = c.kind === kind || (c.kind === 'mine' && kind === 'mineType') || (c.kind === 'slay' && kind === 'slayType') || (c.kind === 'boss' && kind === 'slayType' && CREATURES[detail.type]?.boss);
    if (!hit || (c.kind === 'mineType' && detail.type !== c.type)) continue;
    c.have = Math.min(c.need, c.have + (detail.n || 1));
    changed = true;
    if (c.have >= c.need) g.emit?.('challengeDone', c);
  }
  if (changed) g.emit?.('change');
}

/** Claim a finished challenge's reward. */
export function claimChallenge(g, id) {
  const d = dailyOf(g);
  const c = d.challenges.find(x => x.id === id);
  if (!c || c.have < c.need || c.claimed) return { ok: false };
  c.claimed = true;
  for (const [k, n] of Object.entries(c.reward)) g.state.resources[k] = (g.state.resources[k] || 0) + n;
  const r = rpgOf(g);
  r.challengesDone = (r.challengesDone || 0) + 1;
  g.emit('change');
  return { ok: true, reward: c.reward };
}

/** All three done: a bonus chest with a piece of Rare-or-better gear. */
export function claimBonus(g, hero = null) {
  const d = dailyOf(g);
  if (d.bonus || !d.challenges.every(c => c.claimed)) return { ok: false };
  d.bonus = true;
  let it = null;
  for (let i = 0; i < 6 && (!it || it.rarity < 1); i++) it = rollGear(g, { boss: true });
  if (it) takeGear(g, it, hero);
  g.state.resources.gems = (g.state.resources.gems || 0) + 5;
  if (Math.random() < 0.2) giveEgg(g, 1);
  g.emit('change');
  return { ok: true, item: it };
}

/** The free daily chest: gold, potions, sometimes a material or gear. Better on a streak. */
export function openDailyChest(g, hero = null) {
  const d = dailyOf(g);
  if (d.chest) return { ok: false, why: 'Come back tomorrow' };
  d.chest = true;
  d.lastDay = d.day;
  const streak = Math.min(7, d.streak || 1);
  const got = [];
  const gold = rand(30, 70) + streak * 15;
  g.state.resources.gold = (g.state.resources.gold || 0) + gold; got.push(`${gold} gold`);
  const pots = rand(1, 2) + (streak >= 3 ? 1 : 0);
  rpgOf(g).potions = (rpgOf(g).potions || 0) + pots; got.push(`${pots} Health Potion${pots > 1 ? 's' : ''}`);
  if (Math.random() < 0.5) { const k = pick(['speed_potion', 'strength_potion', 'mana_potion', 'golden_apple']); giveItem(g, k, 1); got.push(nice(k)); }
  if (Math.random() < 0.35 + streak * 0.05) { const gems = rand(2, 5); g.state.resources.gems = (g.state.resources.gems || 0) + gems; got.push(`${gems} gems`); }
  let item = null;
  if (Math.random() < 0.15 + streak * 0.05) { item = rollGear(g); if (item) { takeGear(g, item, hero); got.push(item.name); } }
  g.emit('change');
  return { ok: true, got, item, streak };
}

// ------------------------------------------------------------------ achievements and titles

const indexCount = (r, cat) => Object.keys(r.index?.[cat] || {}).length;
const indexSum = (r, cat) => Object.values(r.index?.[cat] || {}).reduce((a, b) => a + b, 0);
const bossKills = r => Object.entries(r.index?.mob || {}).filter(([k]) => CREATURES[k]?.boss).reduce((a, [, n]) => a + n, 0);
const bestPick = g => Math.max(0, ...Object.keys(toolsOf(g)).filter(k => TOOLS[k]?.kind === 'pickaxe').map(k => TOOLS[k].power || 0));
const owns = (g, test) => { const r = rpgOf(g); return [...Object.values(r.gear || {}), ...(r.bag || [])].some(it => it && test(it)); };
const allIndex = () => Object.values(CATALOG).reduce((a, l) => a + Object.values(l).filter(d => !d.admin && !d.noLoot && d.icon !== null).length, 0);

/** Every achievement: its test, and the title it gives. */
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first monster', title: 'the Brave', test: (g, r) => indexSum(r, 'mob') >= 1 },
  { id: 'hunter', name: 'Monster Hunter', desc: 'Defeat 100 monsters', title: 'the Hunter', test: (g, r) => indexSum(r, 'mob') >= 100 },
  { id: 'slayer', name: 'Slayer', desc: 'Defeat 500 monsters', title: 'the Slayer', test: (g, r) => indexSum(r, 'mob') >= 500 },
  { id: 'boss', name: 'Boss Breaker', desc: 'Defeat a boss', title: 'Boss Breaker', test: (g, r) => bossKills(r) >= 1 },
  { id: 'dragon', name: 'Dragon Slayer', desc: 'Defeat the Dragon', title: 'Dragon Slayer', test: (g, r) => (r.index?.mob?.dragon || 0) >= 1 },
  { id: 'miner', name: 'Miner', desc: 'Mine 50 ores', title: 'the Miner', test: (g, r) => indexSum(r, 'ore') >= 50 },
  { id: 'deep_miner', name: 'Deep Miner', desc: 'Own a pickaxe of power 10 or more', title: 'Deepdelver', test: g => bestPick(g) >= 10 },
  { id: 'delver', name: 'Dungeon Delver', desc: 'Reach dungeon floor 5', title: 'the Delver', test: (g, r) => (r.deepest || 0) >= 5 },
  { id: 'smith', name: 'Smith', desc: 'Forge 10 things', title: 'the Smith', test: (g, r) => (r.forged || 0) >= 10 },
  { id: 'forgemaster', name: 'Forgemaster', desc: 'Forge 50 things', title: 'Forgemaster', test: (g, r) => (r.forged || 0) >= 50 },
  { id: 'enchanter', name: 'Enchanter', desc: 'Enchant 10 times', title: 'the Enchanter', test: (g, r) => (r.enchanted || 0) >= 10 },
  { id: 'merchant', name: 'Merchant', desc: 'Earn 1000 gold at the Market Stall', title: 'the Merchant', test: (g, r) => (r.soldGold || 0) >= 1000 },
  { id: 'rich', name: 'Rich', desc: 'Hold 5000 gold at once', title: 'the Wealthy', test: g => (g.state.resources.gold || 0) >= 5000 },
  { id: 'legend', name: 'Legendary', desc: 'Own a Legendary item', title: 'the Legendary', test: g => owns(g, it => it.rarity >= 3) },
  { id: 'mythic', name: 'Mythic', desc: 'Own a Mythic item', title: 'the Mythic', test: g => owns(g, it => it.rarity === 4) },
  { id: 'lv10', name: 'Seasoned', desc: 'Reach level 10', title: 'the Seasoned', test: (g, r) => (r.level || 1) >= 10 },
  { id: 'lv25', name: 'Veteran', desc: 'Reach level 25', title: 'the Veteran', test: (g, r) => (r.level || 1) >= 25 },
  { id: 'collector', name: 'Collector', desc: 'Find 100 things for your Index', title: 'the Collector', test: (g, r) => ['ore', 'mat', 'mob', 'gear', 'tool'].reduce((a, c) => a + indexCount(r, c), 0) >= 100 },
  { id: 'daily', name: 'Dedicated', desc: 'Finish 15 daily challenges', title: 'the Dedicated', test: (g, r) => (r.challengesDone || 0) >= 15 },
  { id: 'streak', name: 'Regular', desc: 'Open the daily chest 7 days in a row', title: 'the Regular', test: (g, r) => (r.daily?.streak || 0) >= 7 },
];

/** Check for new achievements; returns the ones just unlocked. */
export function checkAchievements(g) {
  const r = rpgOf(g);
  const have = (r.achievements ||= {});
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (have[a.id]) continue;
    let ok = false;
    try { ok = a.test(g, r); } catch { ok = false; }
    if (ok) { have[a.id] = Date.now(); fresh.push(a); }
  }
  return fresh;
}

/** Your chosen title ('' for none). */
export const titleOf = g => { const r = rpgOf(g); const a = ACHIEVEMENTS.find(x => x.id === r.title && r.achievements?.[x.id]); return a ? a.title : ''; };
export function setTitle(g, id) { const r = rpgOf(g); r.title = id && r.achievements?.[id] ? id : null; g.emit('change'); }

