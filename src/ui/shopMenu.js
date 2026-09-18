/*
 * The Market Stall window: today's three offers to buy, and your ores and materials to sell.
 */
import { h, icon, modal, costChips, rarityFrame, RES_ICON } from './dom.js';
import { hasArt, gearIconKey } from '../render/gearArt.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';
import { TOOLS, toolRarity } from '../game/tools.js';
import { CONSUMABLES } from '../game/consumables.js';
import { MATERIALS } from '../game/forging.js';
import { RARITY } from '../game/rpg.js';
import { shopOf, buy, canAfford, offerName, sell, sellable, sellPrice } from '../game/shop.js';

const offerIcon = o => {
  if (o.type === 'tool') { const t = TOOLS[o.key]; return hasArt(t.icon) ? t.icon : t.fallbackIcon || 'items/relic'; }
  if (o.type === 'gear') return gearIconKey(o.item) || 'items/relic';
  return o.key === 'potion' ? 'gear/health_potion' : CONSUMABLES[o.key]?.icon || 'gear/health_potion';
};
const offerRarity = o => (o.type === 'tool' ? toolRarity(o.key) : o.type === 'gear' ? o.item.rarity : 0);

export function openShop(hud) {
  const g = hud.game;
  const hero = heroOf(hud.dungeon || g) || heroOf(g);
  const m = modal([], { cls: 'shop-modal', closeX: true });
  const render = () => {
    const s = shopOf(g);
    const res = g.state.resources;
    const cards = s.offers.map(o => {
      const sold = s.bought.includes(o.id), r = offerRarity(o), fr = rarityFrame(r);
      return h(`div.shop-card${sold ? '.sold' : ''}`,
        h(`div.shop-pic${fr.cls}`, { style: fr.style }, icon(offerIcon(o), 44)),
        h('b', { style: { color: o.type === 'potion' ? '#ffd9d2' : RARITY[r].color } }, `${o.count ? `${o.count} x ` : ''}${offerName(o)}`),
        h('div.faint.shop-kind', o.type === 'tool' ? `${TOOLS[o.key].does} · power ${TOOLS[o.key].power}` : o.type === 'gear' ? `${RARITY[r].name} ${o.item.slot}` : CONSUMABLES[o.key]?.does || 'Heals you'),
        costChips(o.price, res),
        h(`button.btn.sm${sold ? '' : '.primary'}`, {
          disabled: sold || !canAfford(g, o.price),
          onclick: () => { const b = buy(g, o.id, hero); if (!b.ok) { hud.hint(b.why, 1500); return; } play('reveal'); hud.hint(`Bought ${b.name}`, 1500); render(); },
        }, sold ? 'Sold out' : 'Buy'));
    });
    const sellCells = sellable(g).map(k => h('button.shop-sell', {
      title: `${MATERIALS[k].name}: ${sellPrice(k)} gold each. Click sells 1, right-click sells 10`,
      onclick: () => { const r = sell(g, k, 1); if (r.ok) { play('click'); render(); } },
      oncontextmenu: e => { e.preventDefault(); const r = sell(g, k, 10); if (r.ok) { play('click'); render(); } },
    }, icon(RES_ICON[k] || 'items/relic', 30), h('span.shop-n', String(Math.floor(res[k]))), h('span.shop-price', `${sellPrice(k)}g`)));
    m.el.replaceChildren(m.closeBtn,
      h('div.table-head', icon(hasArt('buildings/trade_stall') ? 'buildings/trade_stall' : 'buildings/market', 36), h('div', h('h2', 'Market Stall'), h('div.faint', 'New offers every day. The stall also buys your ores and materials.'))),
      h('div.shop-gold', icon(RES_ICON.gold, 20), h('b', String(Math.floor(res.gold || 0))), h('span.faint', 'gold'), icon(RES_ICON.gems, 20), h('b', String(Math.floor(res.gems || 0))), h('span.faint', 'gems')),
      h('h3', "Today's offers"),
      h('div.shop-cards', ...cards),
      h('h3', 'Sell'),
      sellCells.length ? h('div.shop-sells', ...sellCells) : h('div.faint', 'Nothing to sell yet. Mine ores and beat bosses.'));
  };
  render();
  return m;
}
