/*
 * The Index: a collection book of everything in the world (like a Pokedex). What you have found shows in colour
 * with how many; what you have not shows as a dark shape and ???.
 */
import { PETS } from '../game/pets.js';
import { h, icon, modal, rarityFrame, smallIcon, toggleMenu } from './dom.js';
import { OBJECTS, CREATURES } from '../data/objects.js';
import { CATALOG, rpgOf, discover } from '../game/rpg.js';
import { bossProgress } from '../game/bossIndex.js';
import { TOOLS, toolsOf, toolRarity } from '../game/tools.js';
import { MATERIALS, MATERIAL_KEYS } from '../game/forging.js';
import { gearIconKey, hasArt } from '../render/gearArt.js';
import { matIcon } from './tableMenu.js';

const nice = k => k.replace(/_ore$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const gearList = slots => slots.flatMap(slot => Object.entries(CATALOG[slot] || {})
  .filter(([, d]) => !d.admin && !d.noLoot && d.icon !== null)
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), icon: gearIconKey({ base: k, icon: d.icon, slot }) || 'items/relic', rarity: d.minRarity || 0 })));
const ORE_RARITY = { Common: 0, Uncommon: 1, Rare: 1, Epic: 2, Legendary: 3, Mythical: 4 };

/** Every section: what is in it, and which part of your Index counts it. */
const SECTIONS = [
  { id: 'ore', name: 'Ores', tab: 'ui/tab_ore', verb: 'mined', list: () => Object.entries(OBJECTS).filter(([k, d]) => d.work === 'mine' && k !== 'rock').sort((a, b) => (a[1].tier || 0) - (b[1].tier || 0)).map(([k, d]) => ({ key: k, name: nice(k), icon: d.sprite, note: d.rarity, rarity: ORE_RARITY[d.rarity] || 0 })) },
  { id: 'mat', name: 'Materials', tab: 'items/mat_star_shard', list: () => MATERIAL_KEYS.map(k => ({ key: k, name: MATERIALS[k].name, icon: matIcon(k), note: MATERIALS[k].boss ? 'Boss drop' : null, rarity: MATERIALS[k].rarity || 0 })) },
  { id: 'mob', name: 'Creatures', tab: 'ui/tab_mob', verb: 'slain', list: () => Object.entries(CREATURES).filter(([, d]) => d.sprite && !d.noIndex).map(([k, d]) => ({ key: k, name: nice(k), icon: d.sprite, note: d.boss ? 'Boss' : d.hostile ? null : 'Animal', rarity: d.boss ? 3 : 0 })) },
  { id: 'gear', name: 'Weapons', tab: 'ui/tab_gear', list: () => gearList(['weapon']) },
  { id: 'armour', name: 'Armour', tab: 'ui/ench_protection', counts: 'gear', list: () => gearList(['armor', 'helmet', 'shield']) },
  { id: 'pet', name: 'Pets', tab: 'pets/happy', list: () => Object.entries(PETS).map(([k, p]) => ({ key: k, name: p.name, icon: p.sprite, rarity: p.rarity, note: p.desc })) },
  { id: 'tool', name: 'Tools', tab: 'ui/ench_efficiency', list: () => Object.entries(TOOLS).map(([k, t]) => ({ key: k, name: t.name, icon: hasArt(t.icon) ? t.icon : t.fallbackIcon || 'items/relic', rarity: toolRarity(k) })) },
];

/** Things you already have count as found (for worlds from before the Index). */
function backfill(g) {
  const r = rpgOf(g), idx = (r.index ||= {});
  const mark = (cat, key) => { (idx[cat] ||= {}); if (!idx[cat][key]) idx[cat][key] = 1; };
  for (const k of Object.keys(toolsOf(g))) mark('tool', k);
  for (const it of [...Object.values(r.gear || {}), ...(r.bag || [])]) if (it?.base) mark('gear', it.base);
  for (const k of MATERIAL_KEYS) if ((g.state.resources[k] || 0) > 0) mark('mat', k);
  for (const p of r.pets || []) mark('pet', p.kind);
}

export function openIndex(hud, tab = null) {
  if (toggleMenu('index-modal', { sameView: !tab || hud._indexTab === tab })) return null;
  const g = hud.game;
  backfill(g);
  const m = modal([], { cls: 'index-modal', closeX: true });
  hud._indexTab = tab || hud._indexTab || 'ore';
  const render = () => {
    const idx = rpgOf(g).index || {};
    const counts = SECTIONS.map(s => { const got = idx[s.counts || s.id] || {}; const all = s.list(); return { s, all, found: all.filter(e => got[e.key]).length }; });
    const total = counts.reduce((a, c) => a + c.all.length, 0), found = counts.reduce((a, c) => a + c.found, 0);
    const cur = counts.find(c => c.s.id === hud._indexTab) || counts[0];
    const got = idx[cur.s.counts || cur.s.id] || {};
    const cells = cur.all.map(e => {
      const n = got[e.key] || 0;
      return n
        ? h('div.index-cell.found', { title: `${e.name}${cur.s.verb ? `: ${n} ${cur.s.verb}` : ''}${e.note ? ` (${e.note})` : ''}` },
            h(`div.index-icon${rarityFrame(e.rarity).cls}`, { style: rarityFrame(e.rarity).style }, icon(e.icon, 40)),   // the rarity frame goes round the picture, the name sits below
            h('span.index-name', e.name), cur.s.verb ? h('span.index-n', `x${n}`) : null)
        : h('div.index-cell.unknown', { title: 'Not found yet' }, h('div.index-icon', icon(e.icon, 40)), h('span.index-name', '???'));
    });
    m.el.replaceChildren(m.closeBtn,
      h('div.index-head', hasArt('ui/index') ? icon('ui/index', 26) : null, h('h2', 'Index'), h('span.faint', `${found} / ${total} found`), h('div.index-bar', h('i', { style: { width: `${total ? (found / total) * 100 : 0}%` } }))),
      h('div.tabs.index-tabs',
        ...counts.map(c => h(`button${c.s.id === cur.s.id ? '.on' : ''}`, { onclick: () => { hud._indexTab = c.s.id; render(); } }, smallIcon(c.s.tab, 16), `${c.s.name} ${c.found}/${c.all.length}`)),
        // the Hall of Bosses is part of the Index: the same book, its proudest pages
        (() => { const p = bossProgress(g); return h('button.index-boss-tab', { onclick: async () => { m.close(); (await import('./bossBook.js')).openBossBook(hud); } }, smallIcon('ui/tab_mob', 16), `Bosses ${p.found}/${p.total}`); })()),
      h('div.index-grid', ...cells));
  };
  render();
  return m;
}

export { discover };
