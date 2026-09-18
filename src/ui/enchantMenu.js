/*
 * The Enchanting Table menu: pick a weapon, piece of armour or tool, see what it has and what it could get,
 * then enchant it (a short ritual minigame, then the dice).
 */
import { toolRarity } from '../game/tools.js';
import { h, icon, modal, costChips, rarityFrame, smallIcon, closeIfOpen } from './dom.js';
import { hasArt, gearIconKey } from '../render/gearArt.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';
import { forgeMinigame } from './forge.js';
import { ENCHANTS, MAX_ENCHANTS, enchName, enchantables, peekEnchants, enchantCost, canPay, enchant, targetKind, targetInfo } from '../game/enchanting.js';

const iconOf = t => {
  const info = targetInfo(t);
  if (info.gear) return gearIconKey(info.gear) || 'items/relic';
  return hasArt(info.icon) ? info.icon : info.fallbackIcon || 'items/relic';
};
const idOf = t => (t.tool ? `tool:${t.tool}` : `gear:${t.item.id}`);

export function openEnchantMenu(hud) {
  if (closeIfOpen('enchant-modal')) return null;
  const g = hud.game;
  const hero = heroOf(hud.dungeon || g) || heroOf(g);
  const m = modal([], { cls: 'enchant-modal', closeX: true });
  let busy = false;

  const render = () => {
    const list = enchantables(g);
    let sel = list.find(t => idOf(t) === hud._enchSel) || list[0];
    if (sel) hud._enchSel = idOf(sel);
    const res = g.state.resources;
    const cells = list.map(t => {
      const info = targetInfo(t), ench = peekEnchants(g, t), n = Object.keys(ench).length;
      const fr = rarityFrame(t.item ? t.item.rarity : toolRarity(t.tool));
      return h(`button.ench-item${t === sel ? '.on' : ''}${n ? '.glint' : ''}${fr.cls}`, { style: fr.style, title: `${info.name} · ${t.where}`, onclick: () => { hud._enchSel = idOf(t); play('click'); render(); } },
        icon(iconOf(t), 34), n ? h('span.ench-count', `${n}`) : null);
    });
    let detail = h('div.faint', 'Nothing to enchant yet. Get a weapon, armour or a tool.');
    if (sel) {
      const info = targetInfo(sel), kind = targetKind(sel), ench = peekEnchants(g, sel);
      const cost = enchantCost(g, sel);
      const possible = Object.entries(ENCHANTS).filter(([, e]) => e.for.includes(kind));
      const full = false;   // you can always enchant again: it rolls a new set
      detail = h('div.ench-detail',
        h('div.ench-title', icon(iconOf(sel), 48), h('div', h('b', { style: { color: info.color } }, info.name), h('div.faint', `${sel.where} · ${Object.keys(ench).length}/${MAX_ENCHANTS} enchantments`))),
        Object.keys(ench).length
          ? h('div.ench-have', ...Object.entries(ench).map(([k, l]) => h('div.ench-chip', { style: { color: ENCHANTS[k].color, borderColor: ENCHANTS[k].color } }, h('b', smallIcon(`ui/ench_${k}`, 16), enchName(k, l)), h('span', ENCHANTS[k].desc(l)))))
          : h('div.faint', 'No enchantments yet'),
        h('div.faint.ench-could', `Could get: ${possible.map(([k, e]) => `${e.name}${e.max > 1 ? ` (up to ${enchName(k, e.max).split(' ').pop()})` : ''}`).join(', ')}`),
        Object.keys(ench).length ? h('div.ench-warn', 'Enchanting again removes these and rolls a new set') : null,
        h('div.ench-cost', h('span.faint', 'Cost:'), costChips(cost, res)),
        h('button.btn.primary.ench-go', {
          disabled: busy || full || !canPay(g, cost),
          onclick: () => {
            if (busy) return;
            busy = true;
            m.el.classList.add('forging');
            forgeMinigame({ root: document.getElementById('ui'), title: `Enchanting ${info.name}`, iconKey: hasArt('ui/enchant') ? 'ui/enchant' : 'effects/magic_orb', revealIcon: iconOf(sel), stages: ['hammer'], tier: 1, rings: 2 + (sel.item ? Math.min(4, sel.item.rarity || 0) : toolRarity(sel.tool)), labels: { hammer: 'Channel the magic' } }).then(score => {
              busy = false;
              m.el.classList.remove('forging');
              if (score == null) { render(); return; }
              const r = enchant(g, sel, { score });
              if (!r.ok) { hud.hint(r.why, 1800); render(); return; }
              if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/magic_orb', 10, 18);
              hud.craftReveal({ made: r.set.map(e => enchName(e.key, e.level)).join(' · '), item: null, quality: null, extra: 0, recipe: { icon: iconOf(sel) }, score });
              render();
            });
          },
        }, full ? 'Fully enchanted' : canPay(g, cost) ? (Object.keys(ench).length ? 'Re-enchant' : 'Enchant') : 'Not enough gems or gold'));
    }
    m.el.replaceChildren(m.closeBtn,
      h('div.table-head', icon(hasArt('ui/enchant') ? 'ui/enchant' : 'effects/magic_orb', 32), h('div', h('h2', 'Enchanting Table'), h('div.faint', 'Pick something and enchant it. Each enchant replaces the old ones with a new random set; a good ritual makes it stronger.'))),
      h('div.ench-grid', ...cells),
      detail);
  };
  render();
  return m;
}
