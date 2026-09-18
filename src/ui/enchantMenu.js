/*
 * The Enchanting Table menu: pick a weapon, piece of armour or tool and roll it. Enchanting is pure luck, shown as a
 * rolling reel (Sol's RNG style) that slows down and lands on each enchantment with its "1 in N" odds and rarity.
 * The Books tab makes enchantment books (one random enchantment you can put on something later, keeping the rest).
 */
import { toolRarity } from '../game/tools.js';
import { h, icon, modal, costChips, rarityFrame, smallIcon, closeIfOpen } from './dom.js';
import { hasArt, gearIconKey } from '../render/gearArt.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';
import { ENCHANTS, MAX_ENCHANTS, enchName, enchantables, peekEnchants, enchantCost, canPay, enchant, targetKind, targetInfo, booksOf, makeBook, applyBook, BOOK_COST, oddsRarity } from '../game/enchanting.js';

export const ODDS_RARITY = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const ODDS_COLOR = ['#b8b2a6', '#5aa9ff', '#c77dff', '#ffb347', '#ff4d6d'];
/** A book's picture: the cover with its enchantment's symbol, else the cover of its rarity. */
export const bookIcon = (key, r = 0) => (hasArt(`books/book_${key}`) ? `books/book_${key}` : hasArt(`books/book_${ODDS_RARITY[r].toLowerCase()}`) ? `books/book_${ODDS_RARITY[r].toLowerCase()}` : 'items/scroll');

const iconOf = t => {
  const info = targetInfo(t);
  if (info.gear) return gearIconKey(info.gear) || 'items/relic';
  return hasArt(info.icon) ? info.icon : info.fallbackIcon || 'items/relic';
};
const idOf = t => (t.tool ? `tool:${t.tool}` : `gear:${t.item.id}`);
const fmtOdds = n => `1 in ${n.toLocaleString()}`;

/**
 * The rolling reel. Spins through random enchantment names for each result, slowing down until it lands, then
 * flashes the result's rarity. Tap to skip. Resolves when the player closes it.
 */
export function rollReel(results, { title = 'Enchanting', pool = Object.keys(ENCHANTS), book = false } = {}) {
  return new Promise(resolve => {
    const reel = h('div.rng-reel');
    const odds = h('div.rng-odds');
    const done = h('div.rng-done');
    const box = h('div.rng-box', h('div.rng-title', title), reel, odds, done, h('div.rng-skip.faint', 'Tap to skip'));
    const ov = h('div.rng-overlay', box);
    document.getElementById('ui').append(ov);
    let skip = false, finished = false;
    const close = () => { ov.remove(); resolve(); };
    ov.addEventListener('click', () => { if (finished) close(); else skip = true; });
    const show = (key, level, landed) => {
      const e = ENCHANTS[key];
      reel.replaceChildren(smallIcon(`ui/ench_${key}`, 34), h('span', enchName(key, level)));
      reel.style.color = e.color;
      reel.classList.toggle('landed', !!landed);
    };
    const wait = ms => new Promise(r => setTimeout(r, skip ? 0 : ms));
    (async () => {
      for (const [i, r] of results.entries()) {
        odds.textContent = ''; box.style.removeProperty('--rc'); box.classList.remove('flash');
        const spins = 26 + i * 6;
        for (let s = 0; s < spins && !skip; s++) {
          const k = pool[Math.floor(Math.random() * pool.length)];
          show(k, 1 + Math.floor(Math.random() * ENCHANTS[k].max), false);
          play('click');
          await wait(35 + Math.pow(s / spins, 3) * 320);   // fast, then slower and slower
        }
        const rar = r.rarity ?? oddsRarity(r.odds || 1);
        show(r.key, r.level, true);
        if (book) reel.prepend(icon(hasArt(`books/book_${ODDS_RARITY[r.rarity ?? oddsRarity(r.odds || 1)].toLowerCase()}`) ? `books/book_${ODDS_RARITY[r.rarity ?? oddsRarity(r.odds || 1)].toLowerCase()}` : bookIcon(r.key), 56));
        box.style.setProperty('--rc', ODDS_COLOR[rar]);
        void box.offsetWidth; box.classList.add('flash');
        odds.replaceChildren(h('b', { style: { color: ODDS_COLOR[rar] } }, ODDS_RARITY[rar]), h('span', fmtOdds(r.odds || 1)));
        play(rar >= 3 ? 'reveal' : 'complete');
        done.append(h('div.rng-got', { style: { color: ENCHANTS[r.key].color } }, smallIcon(`ui/ench_${r.key}`, 18), enchName(r.key, r.level), h('i', { style: { color: ODDS_COLOR[rar] } }, fmtOdds(r.odds || 1))));
        const wasSkip = skip; skip = false;
        await wait(wasSkip ? 250 : rar >= 3 ? 1400 : 800);
      }
      finished = true;
      box.querySelector('.rng-skip').textContent = 'Tap to close';
    })();
  });
}

export function openEnchantMenu(hud) {
  if (closeIfOpen('enchant-modal')) return null;
  const g = hud.game;
  const hero = heroOf(hud.dungeon || g) || heroOf(g);
  const m = modal([], { cls: 'enchant-modal', closeX: true });
  let busy = false;
  hud._enchTab ||= 'enchant';

  const render = () => {
    const tab = hud._enchTab;
    const list = enchantables(g);
    let sel = list.find(t => idOf(t) === hud._enchSel) || list[0];
    if (sel) hud._enchSel = idOf(sel);
    const res = g.state.resources;
    const books = booksOf(g);
    const cells = list.map(t => {
      const info = targetInfo(t), ench = peekEnchants(g, t), n = Object.keys(ench).length;
      const fr = rarityFrame(t.item ? t.item.rarity : toolRarity(t.tool));
      return h(`button.ench-item${t === sel ? '.on' : ''}${n ? '.glint' : ''}${fr.cls}`, { style: fr.style, title: `${info.name} · ${t.where}`, onclick: () => { hud._enchSel = idOf(t); play('click'); render(); } },
        icon(iconOf(t), 34), n ? h('span.ench-count', `${n}`) : null);
    });
    const haveList = (t, ench) => (Object.keys(ench).length
      ? h('div.ench-have', ...Object.entries(ench).map(([k, l]) => h('div.ench-chip', { style: { color: ENCHANTS[k].color, borderColor: ENCHANTS[k].color } }, h('b', smallIcon(`ui/ench_${k}`, 16), enchName(k, l)), h('span', ENCHANTS[k].desc(l)))))
      : h('div.faint', 'No enchantments yet'));
    let detail = h('div.faint', 'Nothing to enchant yet. Get a weapon, armour or a tool.');
    if (sel) {
      const info = targetInfo(sel), kind = targetKind(sel), ench = peekEnchants(g, sel);
      const head = h('div.ench-title', icon(iconOf(sel), 48), h('div', h('b', { style: { color: info.color } }, info.name), h('div.faint', `${sel.where} · ${Object.keys(ench).length}/${MAX_ENCHANTS} enchantments`)));
      if (tab === 'enchant') {
        const cost = enchantCost(g, sel);
        const possible = Object.entries(ENCHANTS).filter(([, e]) => e.for.includes(kind));
        const total = possible.reduce((a, [, e]) => a + e.w, 0);
        detail = h('div.ench-detail', head, haveList(sel, ench),
          h('div.ench-odds', ...possible.sort((a, b) => b[1].w - a[1].w).map(([k, e]) => { const n = Math.round(total / e.w), r = oddsRarity(n); return h('span.ench-odd', { style: { color: e.color, borderColor: ODDS_COLOR[r] } }, smallIcon(`ui/ench_${k}`, 14), e.name, h('i', { style: { color: ODDS_COLOR[r] } }, fmtOdds(n))); })),
          Object.keys(ench).length ? h('div.ench-warn', 'Rolling again removes these and rolls a new set') : null,
          h('div.ench-cost', h('span.faint', 'Cost:'), costChips(cost, res)),
          h('button.btn.primary.ench-go', {
            disabled: busy || !canPay(g, cost),
            onclick: async () => {
              if (busy) return;
              const r = enchant(g, sel);
              if (!r.ok) { hud.hint(r.why, 1800); render(); return; }
              busy = true;
              m.el.classList.add('forging');
              await rollReel(r.set, { title: `Enchanting ${info.name}`, pool: possible.map(([k]) => k) });
              busy = false;
              m.el.classList.remove('forging');
              if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/magic_orb', 10, 18);
              render();
            },
          }, canPay(g, cost) ? (Object.keys(ench).length ? 'Roll again' : 'Roll') : 'Not enough gems or gold'));
      } else {
        detail = h('div.ench-detail', head, haveList(sel, ench),
          h('div.faint', books.length ? 'Tap a book to put its enchantment on this. It adds to what is there (up to 3) and never removes the others.' : 'No books yet. Make one below, or find them on bosses.'),
          h('div.ench-books', ...books.map(b => {
            const e = ENCHANTS[b.key], r = oddsRarity(b.odds || 1), fits = e.for.includes(kind);
            return h(`button.ench-book${fits ? '' : '.off'}`, { style: { borderColor: ODDS_COLOR[r] }, title: `${enchName(b.key, b.level)} · ${e.desc(b.level)} · for ${e.for.join('/')}`, onclick: () => {
              const res2 = applyBook(g, b.id, sel);
              if (!res2.ok) { hud.hint(res2.why, 1800); play('undo'); return; }
              play('complete'); hud.hint(`${enchName(res2.key, res2.level)} added to ${info.name}`, 1800);
              if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/magic_orb', 10, 18);
              render();
            } }, icon(bookIcon(b.key, r), 30), h('b', { style: { color: e.color } }, enchName(b.key, b.level)), h('i', { style: { color: ODDS_COLOR[r] } }, fits ? fmtOdds(b.odds || 1) : `${e.for.join('/')} only`));
          })),
          h('div.ench-cost', h('span.faint', 'New book:'), costChips(BOOK_COST, res)),
          h('button.btn.primary.ench-go', {
            disabled: busy || !canPay(g, BOOK_COST),
            onclick: async () => {
              if (busy) return;
              const r = makeBook(g);
              if (!r.ok) { hud.hint(r.why, 1800); return; }
              busy = true;
              m.el.classList.add('forging');
              await rollReel([r.book], { title: 'Writing a book', book: true });
              busy = false;
              m.el.classList.remove('forging');
              render();
            },
          }, canPay(g, BOOK_COST) ? 'Make a book' : 'Not enough gems or gold'));
      }
    }
    m.el.replaceChildren(m.closeBtn,
      h('div.table-head', icon(hasArt('ui/enchant') ? 'ui/enchant' : 'effects/magic_orb', 32), h('div', h('h2', 'Enchanting Table'), h('div.faint', 'Pure luck: every roll replaces the old enchantments with a new random set. Books add one without removing the rest.'))),
      h('div.ench-tabs',
        h(`button.btn.sm${tab === 'enchant' ? '.primary' : '.ghost'}`, { onclick: () => { hud._enchTab = 'enchant'; render(); } }, 'Roll'),
        h(`button.btn.sm${tab === 'books' ? '.primary' : '.ghost'}`, { onclick: () => { hud._enchTab = 'books'; render(); } }, icon(hasArt('books/book_stack') ? 'books/book_stack' : 'items/scroll', 18), `Books (${books.length})`)),
      h('div.ench-grid', ...cells),
      detail);
  };
  render();
  return m;
}
