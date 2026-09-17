/*
 * The Index: a collection book of everything in the world (like a Pokedex). What you have found shows in colour
 * with how many; what you have not shows as a dark shape and ???.
 */
import { h, icon, modal } from './dom.js';
import { OBJECTS, CREATURES } from '../data/objects.js';
import { CATALOG, rpgOf, discover } from '../game/rpg.js';
import { TOOLS, toolsOf } from '../game/tools.js';
import { MATERIALS, MATERIAL_KEYS } from '../game/forging.js';
import { gearIconKey, hasArt } from '../render/gearArt.js';
import { matIcon } from './tableMenu.js';

const nice = k => k.replace(/_ore$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const gearList = slots => slots.flatMap(slot => Object.entries(CATALOG[slot] || {})
  .filter(([, d]) => !d.admin && !d.noLoot && d.icon !== null)
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), icon: gearIconKey({ base: k, icon: d.icon, slot }) || 'items/relic' })));

/** Every section: what is in it, and which part of your Index counts it. */
const SECTIONS = [
  { id: 'ore', name: 'Ores', verb: 'mined', list: () => Object.entries(OBJECTS).filter(([k, d]) => d.work === 'mine' && k !== 'rock').sort((a, b) => (a[1].tier || 0) - (b[1].tier || 0)).map(([k, d]) => ({ key: k, name: nice(k), icon: d.sprite, note: d.rarity })) },
  { id: 'mat', name: 'Materials', list: () => MATERIAL_KEYS.map(k => ({ key: k, name: MATERIALS[k].name, icon: matIcon(k), note: MATERIALS[k].boss ? 'Boss drop' : null })) },
  { id: 'mob', name: 'Creatures', verb: 'slain', list: () => Object.entries(CREATURES).filter(([, d]) => d.sprite && !d.noIndex).map(([k, d]) => ({ key: k, name: nice(k), icon: d.sprite, note: d.boss ? 'Boss' : d.hostile ? null : 'Animal' })) },
  { id: 'gear', name: 'Weapons', list: () => gearList(['weapon']) },
  { id: 'armour', name: 'Armour', counts: 'gear', list: () => gearList(['armor', 'helmet', 'shield']) },
  { id: 'tool', name: 'Tools', list: () => Object.entries(TOOLS).map(([k, t]) => ({ key: k, name: t.name, icon: hasArt(t.icon) ? t.icon : t.fallbackIcon || 'items/relic' })) },
];

/** Things you already have count as found (for worlds from before the Index). */
function backfill(g) {
  const r = rpgOf(g), idx = (r.index ||= {});
  const mark = (cat, key) => { (idx[cat] ||= {}); if (!idx[cat][key]) idx[cat][key] = 1; };
  for (const k of Object.keys(toolsOf(g))) mark('tool', k);
  for (const it of [...Object.values(r.gear || {}), ...(r.bag || [])]) if (it?.base) mark('gear', it.base);
  for (const k of MATERIAL_KEYS) if ((g.state.resources[k] || 0) > 0) mark('mat', k);
}

export function openIndex(hud, tab = null) {
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
        ? h('div.index-cell.found', { title: `${e.name}${cur.s.verb ? `: ${n} ${cur.s.verb}` : ''}${e.note ? ` (${e.note})` : ''}` }, icon(e.icon, 40), h('span.index-name', e.name), cur.s.verb ? h('span.index-n', `x${n}`) : null)
        : h('div.index-cell.unknown', { title: 'Not found yet' }, icon(e.icon, 40), h('span.index-name', '???'));
    });
    m.el.replaceChildren(m.closeBtn,
      h('div.index-head', h('h2', 'Index'), h('span.faint', `${found} / ${total} found`), h('div.index-bar', h('i', { style: { width: `${total ? (found / total) * 100 : 0}%` } }))),
      h('div.tabs.index-tabs', ...counts.map(c => h(`button${c.s.id === cur.s.id ? '.on' : ''}`, { onclick: () => { hud._indexTab = c.s.id; render(); } }, `${c.s.name} ${c.found}/${c.all.length}`))),
      h('div.index-grid', ...cells));
  };
  render();
  return m;
}

export { discover };
