/*
 * The Journal window: today's free chest and three challenges, and your achievements (pick one as your title).
 */
import { h, icon, modal, costChips, smallIcon } from './dom.js';
import { hasArt } from '../render/gearArt.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';
import { rpgOf } from '../game/rpg.js';
import { dailyOf, openDailyChest, claimChallenge, claimBonus, ACHIEVEMENTS, setTitle } from '../game/journal.js';

export function openJournal(hud, tab = null) {
  const g = hud.game;
  const hero = heroOf(hud.dungeon || g) || heroOf(g);
  const m = modal([], { cls: 'journal-modal', closeX: true });
  hud._journalTab = tab || hud._journalTab || 'daily';
  const render = () => {
    const r = rpgOf(g);
    const d = dailyOf(g);
    const tabs = h('div.tabs', ...[['daily', 'Daily'], ['ach', `Achievements ${Object.keys(r.achievements || {}).length}/${ACHIEVEMENTS.length}`]].map(([id, label]) =>
      h(`button${hud._journalTab === id ? '.on' : ''}`, { onclick: () => { hud._journalTab = id; render(); } }, label)));
    let body;
    if (hud._journalTab === 'daily') {
      const chest = h(`div.daily-chest${d.chest ? '.opened' : ''}`,
        icon(d.chest ? 'gear/chest_open' : 'gear/chest_closed', 64),
        h('div', h('b', 'Daily chest'), h('div.faint', d.chest ? 'Opened. A new one tomorrow.' : `Free every day. Day ${Math.min(7, d.streak || 1)} of your streak: the longer the streak, the better.`)),
        h(`button.btn${d.chest ? '' : '.primary'}`, { disabled: d.chest, onclick: () => { const res = openDailyChest(g, hero); if (!res.ok) return; play('reveal'); hud.rareLootReveal?.({ gear: res.item || null, text: res.got.join(' · '), chest: true }); render(); } }, d.chest ? 'Opened' : 'Open'));
      const rows = d.challenges.map(c => {
        const done = c.have >= c.need;
        return h(`div.challenge${c.claimed ? '.claimed' : done ? '.done' : ''}`,
          h('div.challenge-top', h('b', c.text), h('span.faint', `${c.have} / ${c.need}`)),
          h('div.challenge-bar', h('i', { style: { width: `${Math.min(100, (c.have / c.need) * 100)}%` } })),
          h('div.challenge-foot', h('span.faint', 'Reward'), costChips(Object.fromEntries(Object.entries(c.reward).filter(([, n]) => n > 0)), null), h('div.spacer'),
            h(`button.btn.sm${done && !c.claimed ? '.primary' : ''}`, { disabled: !done || c.claimed, onclick: () => { if (claimChallenge(g, c.id).ok) { play('reveal'); render(); } } }, c.claimed ? 'Claimed' : done ? 'Claim' : 'In progress')));
      });
      const allClaimed = d.challenges.every(c => c.claimed);
      const bonus = h(`div.challenge.bonus${d.bonus ? '.claimed' : ''}`,
        h('div.challenge-top', h('b', 'Finish all three'), h('span.faint', 'A bonus chest with Rare or better gear, and 5 gems')),
        h(`button.btn.sm${allClaimed && !d.bonus ? '.primary' : ''}`, { disabled: !allClaimed || d.bonus, onclick: () => { const res = claimBonus(g, hero); if (res.ok) { play('reveal'); if (res.item) hud.rareLootReveal?.({ gear: res.item }); render(); } } }, d.bonus ? 'Claimed' : 'Open bonus chest'));
      body = h('div.journal-body', chest, h('h3', "Today's challenges"), ...rows, bonus, h('div.faint.journal-note', 'Challenges and the chest reset at midnight.'));
    } else {
      const have = r.achievements || {};
      body = h('div.journal-body',
        h('div.faint', 'Each achievement gives a title. Pick one to show under your name (other players see it too).'),
        h('div.ach-grid', ...ACHIEVEMENTS.map(a => {
          const got = !!have[a.id], on = r.title === a.id;
          return h(`div.ach${got ? '.got' : ''}${on ? '.on' : ''}`,
            smallIcon(hasArt('items/mat_star_shard') ? 'items/mat_star_shard' : 'items/star_rank', 28),
            h('div', h('b', a.name), h('div.faint', a.desc), got ? h('div.ach-title', `Title: ${a.title}`) : null),
            got ? h(`button.btn.sm${on ? '.primary' : ''}`, { onclick: () => { setTitle(g, on ? null : a.id); play('click'); render(); } }, on ? 'Shown' : 'Show title') : h('span.faint.ach-lock', 'Locked'));
        })));
    }
    m.el.replaceChildren(m.closeBtn,
      h('div.table-head', icon(hasArt('items/token_crown') ? 'items/token_crown' : 'gear/chest_closed', 32), h('div', h('h2', 'Journal'), h('div.faint', 'Daily chest, daily challenges and achievements'))),
      tabs, body);
  };
  render();
  return m;
}
