/*
 * The Hall of Bosses: a wall of every great foe in the game. The ones you have felled hang in colour with the
 * story of the fight — your fastest run, the lowest level you ever won at, the cleanest and the strongest one you
 * have put down. The ones you have not met are dark shapes. From here you can call one out again at any level,
 * or take on the gauntlet: five of them, one after another, on a single clock.
 */
import { CREATURES } from '../data/objects.js';
import { h, icon, modal, closeIfOpen } from './dom.js';
import { hasArt } from '../render/gearArt.js';
import { spriteAvailable } from '../core/assets.js';
import { rpgOf } from '../game/rpg.js';
import { BOSS_KEYS, bossName, bossLog, bossProgress, isDeep, RANKS, fmtRun, runText, challengeBoss, startBossRush, stopBossRush } from '../game/bossIndex.js';
import { play } from '../core/sound.js';

const art = key => {
  const def = CREATURES[key] || {};
  return !spriteAvailable(def.sprite) && def.fallback ? def.fallback.sprite : def.sprite;
};
const ago = ts => {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const rankChip = r => h('span.boss-rank', { style: { color: RANKS[r], borderColor: `${RANKS[r]}66` } }, r);

export function openBossBook(hud, focus = null) {
  if (toggleMenu('boss-modal', { sameView: true })) return null;
  const g = hud.game;
  const m = modal([], { cls: 'boss-modal', closeX: true });
  let picked = focus;

  const record = key => bossLog(g)[key] || null;

  // ---------------------------------------------------------------- one boss, in full
  const detail = key => {
    const rec = record(key);
    const def = CREATURES[key];
    const lvlInput = h('input.input.boss-lvl', { type: 'number', min: 1, max: 99, value: String(Math.max(1, rpgOf(g).level || 1)), style: { width: '76px' } });
    const rows = [
      ['Fastest', rec?.fast, '#ffd76a', 'Beat your own clock'],
      ['Lowest level', rec?.low, '#9fd4ff', 'Win it again with less to your name'],
      ['Cleanest', rec?.clean, '#8aff9a', 'Take fewer blows than last time'],
      ['Strongest felled', rec?.high, '#ff8a7a', 'Call out a higher level than you have beaten'],
    ];
    return [
      h('div.boss-detail-head',
        h('button.btn.sm.ghost', { onclick: () => { picked = null; render(); } }, 'Back to the hall'),
        h('div.spacer'),
        rec?.bestRank ? rankChip(rec.bestRank) : null),
      h('div.boss-hero',
        h('div.boss-hero-art', icon(art(key), 96)),
        h('div.boss-hero-text',
          h('h3', bossName(key)),
          h('div.faint', isDeep(key) ? 'A deep guardian: it waits on the floors below six' : def.deepBoss === undefined && key === 'ashen_knight' ? 'He walks every fifth floor' : 'A guardian of the upper floors and the wilds'),
          rec ? h('div.boss-hero-line', h('b', `${rec.kills} felled`), h('span.faint', ` · first ${ago(rec.first)}`)) : h('div.faint', 'You have never put it down'),
          rec?.last ? h('div.faint', `Last time: ${runText(rec.last)}`) : null)),
      h('div.boss-records', ...rows.map(([label, run, color, nudge]) => h('div.boss-record',
        h('div.boss-record-head', h('span.boss-record-name', { style: { color } }, label), run ? rankChip(run.rank) : null),
        run
          ? h('div.boss-record-body', h('b', label === 'Fastest' ? fmtRun(run.t) : label === 'Lowest level' ? `Level ${run.lvl}` : label === 'Cleanest' ? (run.hits ? `${run.hits} hits` : 'Not touched') : `Level ${run.bossLvl}`),
              h('div.faint', runText(run)), h('div.faint.boss-nudge', nudge))
          : h('div.boss-record-body', h('span.faint', 'Nothing written here yet'))))),
      rec ? h('div.boss-actions',
        h('span.faint', 'Call it out at level'),
        lvlInput,
        h('button.btn.primary', { onclick: () => {
          const res = challengeBoss(g, key, Number(lvlInput.value) || 1);
          if (!res.ok) { hud.hint(res.why, 2200); return; }
          play('reveal');
          hud.hint(`${bossName(key)} is here — go`, 2400);
          m.close();
        } }, 'Rematch'),
        h('span.faint', 'It appears beside you. The clock starts on your first blow.')) : null,
    ].filter(Boolean);
  };

  // ---------------------------------------------------------------- the whole wall
  const hall = () => {
    const p = bossProgress(g);
    const r = rpgOf(g);
    const rushing = !!r.rush;
    const cells = BOSS_KEYS.map(key => {
      const rec = record(key);
      if (!rec?.kills) {
        return h('button.boss-cell.unknown', { title: 'Not felled yet', onclick: () => { hud.hint('Put it down once and its page opens', 1800); } },
          h('div.boss-art', icon(art(key), 46)), h('span.boss-cell-name', '???'));
      }
      return h('button.boss-cell.found', { title: `${bossName(key)} — ${rec.kills} felled`, onclick: () => { picked = key; play('click'); render(); } },
        rankChip(rec.bestRank || 'D'),
        h('div.boss-art', icon(art(key), 46)),
        h('span.boss-cell-name', bossName(key)),
        h('span.boss-cell-line', rec.fast ? `${fmtRun(rec.fast.t)} · Lv ${rec.low?.lvl ?? rec.fast.lvl}` : `${rec.kills} felled`),
        rec.clean && !rec.clean.hits ? h('span.boss-flawless', 'Untouched') : null);
    });
    return [
      h('div.index-head', hasArt('ui/index') ? icon('ui/index', 26) : null, h('h2', 'Hall of Bosses'),
        h('span.faint', `${p.found} / ${p.total} felled · ${p.kills} in all`),
        h('div.index-bar', h('i', { style: { width: `${p.total ? (p.found / p.total) * 100 : 0}%` } }))),
      h('div.boss-tally',
        ...['S', 'A', 'B', 'C', 'D'].filter(k => p.ranks[k]).map(k => h('span.boss-tally-chip', rankChip(k), h('b', `x${p.ranks[k]}`))),
        p.fastest ? h('span.faint', `Quickest of all: ${bossName(p.fastest.k)} in ${fmtRun(p.fastest.run.t)}`) : h('span.faint', 'Fell one to open its page'),
        h('div.spacer'),
        r.rushBest ? h('span.faint', `Best gauntlet: ${r.rushBest.n} in ${fmtRun(r.rushBest.t)}`) : null,
        rushing
          ? h('button.btn.sm.danger', { onclick: () => { stopBossRush(g); render(); } }, `Give up (${r.rush.i}/${r.rush.queue.length})`)
          : h('button.btn.sm.primary', { onclick: async () => {
              const res = startBossRush(g, { count: 5 });
              if (!res.ok) { hud.hint(res.why, 2400); return; }
              play('reveal');
              m.close();
            } }, 'Boss Rush')),
      h('div.boss-grid', ...cells),
    ];
  };

  const render = () => { m.el.replaceChildren(m.closeBtn, ...(picked ? detail(picked) : hall())); };
  render();
  return m;
}
