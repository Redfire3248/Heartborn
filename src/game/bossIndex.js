/*
 * The Boss Index: a page for every great foe in the world, and the story of how you beat it.
 *
 * A boss fight starts the moment you draw blood and ends when it falls. We keep the clock, the level you were,
 * how many blows you took and how deep you were, and grade the run S to D. Four records are kept for every boss —
 * your fastest, the lowest level you ever won at, the cleanest run and the highest-levelled one you have felled —
 * so there is always another way to beat your old self. Nothing here is ever overwritten by a worse run.
 */
import { CREATURES } from '../data/objects.js';
import { rpgOf } from './rpg.js';

/** Every boss the game can show you, the ones you meet early first. */
export const BOSS_KEYS = Object.keys(CREATURES).filter(k => CREATURES[k].boss && !CREATURES[k].noIndex)
  .sort((a, b) => (CREATURES[a].deepBoss ? 1 : 0) - (CREATURES[b].deepBoss ? 1 : 0) || CREATURES[a].hp - CREATURES[b].hp);

const title = k => k.replace(/_/g, ' ').replace(/(^|\s)\w/g, m => m.toUpperCase());
export const bossName = k => CREATURES[k]?.name || (k === 'ashen_knight' ? 'Varek, the Ashen Knight' : title(k));
export const isDeep = k => !!CREATURES[k]?.deepBoss;

/** Where every record lives (inside your character, so it travels with you into dungeons and into your save). */
export const bossLog = g => (rpgOf(g).bossLog ||= {});
export const bossRecord = (g, key) => bossLog(g)[key] || null;

/** S for a fast, clean win against something above your level; D for scraping through. */
export const RANKS = { S: '#ffd76a', A: '#8aff9a', B: '#9fd4ff', C: '#c8b4ff', D: '#9aa3b2' };
export function rankOf(run) {
  let p = 0;
  if (run.t <= 20) p += 3; else if (run.t <= 45) p += 2; else if (run.t <= 90) p += 1;
  if (!run.hits) p += 3; else if (run.hits <= 2) p += 2; else if (run.hits <= 5) p += 1;
  const gap = (run.bossLvl || 1) - (run.lvl || 1);   // putting down something above your level is the proud part
  if (gap >= 10) p += 3; else if (gap >= 4) p += 2; else if (gap >= 0) p += 1;
  return p >= 8 ? 'S' : p >= 6 ? 'A' : p >= 4 ? 'B' : p >= 2 ? 'C' : 'D';
}

/** How long a run took, the way it reads on a card. */
export const fmtRun = s => (s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s` : `${s.toFixed(1)}s`);

/** A whole run in one line: "Level 15 - 15.4s - no hits". */
export const runText = run => `Level ${run.lvl} · ${fmtRun(run.t)} · ${run.hits ? `${run.hits} hit${run.hits === 1 ? '' : 's'} taken` : 'no hits'}${run.floor ? ` · floor ${run.floor}` : ''}`;

const isBoss = c => !!CREATURES[c?.t]?.boss;

/** You drew blood: the clock starts. Called for every blow, but only the first one counts. */
export function bossFightStart(g, c) {
  if (!isBoss(c) || c._run) return;
  c._run = { at: g.state.time, lvl: rpgOf(g).level || 1, hits0: g.hero?.hitsTaken || 0 };
}

/**
 * It fell. Writes the run into the Index and says which of your records it broke, so the screen can shout about it.
 * Returns null for anything that is not a boss.
 */
export function noteBossKill(g, c, v) {
  if (!isBoss(c)) return null;
  const key = c.t;
  const start = c._run || { at: g.state.time, lvl: rpgOf(g).level || 1, hits0: g.hero?.hitsTaken || 0 };
  const run = {
    t: Math.max(0.1, g.state.time - start.at),
    lvl: start.lvl,
    bossLvl: c.lvl || 1,
    hits: Math.max(0, (g.hero?.hitsTaken || 0) - start.hits0),
    floor: g.dungeon?.depth || 0,
    when: Date.now(),
  };
  run.rank = rankOf(run);
  const log = bossLog(g);
  const rec = (log[key] ||= { kills: 0, first: run.when });
  rec.kills++;
  rec.last = run;
  const beats = [];
  const better = (field, isBetter, label) => {
    if (rec[field] && !isBetter(rec[field])) return;
    if (rec[field]) beats.push(label);
    rec[field] = run;
  };
  const first = rec.kills === 1;
  better('fast', old => run.t < old.t, 'Fastest yet');
  better('low', old => run.lvl < old.lvl, 'Lowest level yet');
  better('clean', old => run.hits < old.hits, 'Cleanest yet');
  better('high', old => run.bossLvl > old.bossLvl, 'Strongest one yet');
  if (!rec.bestRank || 'SABCD'.indexOf(run.rank) < 'SABCD'.indexOf(rec.bestRank)) {
    if (!first) beats.push(`New best rank: ${run.rank}`);
    rec.bestRank = run.rank;
  }
  delete c._run;
  const result = { key, name: bossName(key), run, beats, first, kills: rec.kills, rush: null };
  result.rush = advanceRush(g, key, v);
  g.emit?.('bossDown', result);
  g.emit?.('change');
  return result;
}

/** How much of the Index you have filled in. */
export function bossProgress(g) {
  const log = bossLog(g);
  const slain = BOSS_KEYS.filter(k => log[k]?.kills);
  const ranks = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const k of slain) ranks[log[k].bestRank || 'D']++;
  const fastest = slain.map(k => ({ k, run: log[k].fast })).filter(x => x.run).sort((a, b) => a.run.t - b.run.t)[0] || null;
  return { found: slain.length, total: BOSS_KEYS.length, kills: slain.reduce((a, k) => a + log[k].kills, 0), ranks, fastest };
}

// ------------------------------------------------------------------ rematches and the gauntlet

/** A clear patch of ground a few steps away, so a boss never lands inside a wall. */
function arenaSpot(g, v) {
  for (const d of [5, 6, 7, 4, 8]) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = v.x + Math.cos(a) * d * 32, y = v.y + Math.sin(a) * d * 32;
    if (g.world.walkable(x, y)) return { x, y };
  }
  return { x: v.x + 160, y: v.y };
}

/**
 * Call one out again: it appears in front of you at the level you name, and the clock starts when you swing.
 * You can only call back something you have already put down once.
 */
export function challengeBoss(g, key, level = null, v = null) {
  if (!CREATURES[key]?.boss) return { ok: false, why: 'That is not a boss' };
  if (!bossRecord(g, key)?.kills) return { ok: false, why: `You have never beaten ${bossName(key)}` };
  const me = v || g.state.villagers.find(x => x.id === g.hero?.id);
  if (!me) return { ok: false, why: 'Only out in the world' };
  if (g.state.creatures.some(c => c._challenge)) return { ok: false, why: 'One challenge at a time' };
  const p = arenaSpot(g, me);
  const c = g.spawnCreature(key, p.x, p.y, { _challenge: true, _eliteRolled: true });
  if (!c) return { ok: false, why: 'No room for it here' };
  const lvl = level == null ? Math.max(1, rpgOf(g).level || 1) : Math.max(1, Math.min(99, Math.floor(level)));
  c.lvl = lvl;
  c.dmgMult = (c.dmgMult || 1) * (1 + (lvl - 1) * 0.035);
  c.hp = null;
  c.hunting = true;
  g.fx.shake = Math.max(g.fx.shake || 0, 2.5);
  g.announce?.(`${bossName(key)} answers your challenge — level ${lvl}`);
  return { ok: true, creature: c, level: lvl };
}

/** The gauntlet: a line of bosses you have already beaten, one after another, on one clock. */
export function startBossRush(g, { count = 5, level = null, v = null } = {}) {
  const beaten = BOSS_KEYS.filter(k => bossLog(g)[k]?.kills);
  if (beaten.length < 3) return { ok: false, why: 'Beat at least three different bosses first' };
  const pool = [...beaten].sort(() => Math.random() - 0.5).slice(0, Math.max(2, Math.min(count, beaten.length)));
  const r = rpgOf(g);
  r.rush = { queue: pool, i: 0, at: g.state.time, level, hits0: g.hero?.hitsTaken || 0, done: false };
  const first = challengeBoss(g, pool[0], level, v);
  if (!first.ok) { r.rush = null; return first; }
  g.announce?.(`Boss Rush: ${pool.length} of them, one after another. Go!`);
  return { ok: true, queue: pool };
}

/** A boss fell during a rush: bring out the next one, or close the run and keep the time. */
function advanceRush(g, key, v) {
  const r = rpgOf(g);
  const rush = r.rush;
  if (!rush || rush.done || rush.queue[rush.i] !== key) return null;
  rush.i++;
  if (rush.i < rush.queue.length) {
    const next = rush.queue[rush.i];
    setTimeout(() => { if (rpgOf(g).rush === rush && !rush.done) challengeBoss(g, next, rush.level, v); }, 2200);
    return { left: rush.queue.length - rush.i, next, name: bossName(next), total: rush.queue.length, at: rush.i };
  }
  rush.done = true;
  const total = g.state.time - rush.at;
  const hits = Math.max(0, (g.hero?.hitsTaken || 0) - rush.hits0);
  const best = r.rushBest;
  const record = !best || total < best.t;
  if (record) r.rushBest = { t: total, n: rush.queue.length, hits, lvl: rpgOf(g).level || 1, when: Date.now() };
  r.rush = null;
  return { finished: true, t: total, hits, n: rush.queue.length, record };
}

/** Give up on a gauntlet part-way through. */
export function stopBossRush(g) {
  const r = rpgOf(g);
  if (!r.rush) return false;
  r.rush = null;
  g.state.creatures = g.state.creatures.filter(c => !c._challenge);
  g.announce?.('Boss Rush abandoned');
  return true;
}
