/*
 * The Crafting Table (press E next to one): the Forge, where materials go in and a random weapon or piece of armour
 * comes out, and the Workbench for tools, potions and items. Away from a table only the hand-made basics can be made.
 * Also the Materials bag: every ore, metal and boss material you carry, in its own grid.
 */
import { h, icon, modal } from './dom.js';
import { RARITY, CATALOG } from '../game/rpg.js';
import { gearIconKey, hasArt } from '../render/gearArt.js';
import { MATERIALS, MATERIAL_KEYS, TRAITS, forgePreview, canPay, forge, abilityOf, rollForgeBase, FORGE_TOOL_KINDS } from '../game/forging.js';
import { RECIPES, needsTable, canCraft, missingToDiscover } from '../game/crafting.js';
import { heroOf } from '../game/hero.js';
import { forgeMinigame } from './forge.js';
import { play } from '../core/sound.js';
import { costChips } from './dom.js';

const MAX_SLOTS = 4;
const fmtN = n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.floor(n)));
export const matIcon = k => (hasArt(MATERIALS[k].icon) ? MATERIALS[k].icon : 'items/relic');

/** The Materials bag: a grid of everything you can forge with. */
export function openMaterialsBag(hud) {
  const g = hud.game;
  const m = modal([], { cls: 'mat-modal', closeX: true });
  const info = h('div.mat-info', 'Hover a material to see what it forges');
  const owned = MATERIAL_KEYS.filter(k => (g.state.resources[k] || 0) > 0).sort((a, b) => MATERIALS[a].rarity - MATERIALS[b].rarity);
  const cells = owned.map(k => {
    const mt = MATERIALS[k], color = RARITY[mt.rarity].color;
    return h('div.mat-cell', {
      style: { borderColor: color }, title: mt.name,
      onmouseenter: () => { info.replaceChildren(h('b', { style: { color } }, mt.name), h('span', ` · ${RARITY[mt.rarity].name} · power x${mt.mult}${mt.trait ? ` · ${TRAITS[mt.trait].name}: ${TRAITS[mt.trait].desc}` : ''}${mt.boss ? ' · dropped by a boss' : ''}`)); },
    }, icon(matIcon(k), 34), h('span.mat-count', fmtN(g.state.resources[k])));
  });
  const empty = Math.max(0, 18 - cells.length);
  m.el.replaceChildren(m.closeBtn,
    h('h2', 'Materials'),
    h('div.mat-grid', ...cells, ...Array.from({ length: empty }, () => h('div.mat-cell.empty'))),
    info);
  return m;
}

/** The Crafting Table menu. `atTable`: false for crafting by hand (only the basics). */
export function openTableMenu(hud, { atTable = false, tab = null } = {}) {
  const g = hud.game;
  const hero = heroOf(hud.dungeon || g) || heroOf(g);
  hud._tableTab = tab || hud._tableTab || (atTable ? 'forge' : 'bench');
  if (!atTable) hud._tableTab = 'bench';
  hud._forgeToolKind ||= 'pickaxe';
  hud._forgeMix ||= {};
  hud._forgeKind ||= 'weapon';
  const m = modal([], { cls: 'table-modal', closeX: true });

  const render = () => {
    const tabs = h('div.tabs',
      h(`button${hud._tableTab === 'forge' ? '.on' : ''}`, { disabled: !atTable, title: atTable ? '' : 'Stand at a Crafting Table to forge', onclick: () => { hud._tableTab = 'forge'; render(); } }, 'Forge'),
      h(`button${hud._tableTab === 'bench' ? '.on' : ''}`, { onclick: () => { hud._tableTab = 'bench'; render(); } }, 'Hand crafting'));
    const title = h('div.table-head', icon('buildings/workshop', 32), h('div', h('h2', atTable ? 'Crafting Table' : 'Crafting'), h('div.faint', atTable ? 'Forge weapons, armour and tools from your materials' : 'Basics only. Use a Crafting Table to forge.')));
    m.el.replaceChildren(m.closeBtn, title, tabs, hud._tableTab === 'forge' ? forgeTab() : benchTab());
  };

  // ------------------------------------------------------------ forge
  const forgeTab = () => {
    const mix = hud._forgeMix;
    for (const k of Object.keys(mix)) if (!mix[k]) delete mix[k];
    const res = g.state.resources;
    const add = (k, n) => {
      if (!mix[k] && Object.keys(mix).length >= MAX_SLOTS) { hud.hint('The forge holds 4 kinds of material', 1500); return; }
      const have = (res[k] || 0) - (mix[k] || 0);
      if (have <= 0) { hud.hint(`No more ${MATERIALS[k].name}`, 1200); return; }
      mix[k] = (mix[k] || 0) + Math.min(n, have);
      play('click');
      render();
    };
    const sub = (k, n) => { mix[k] = Math.max(0, (mix[k] || 0) - n); render(); };

    const kinds = h('div.forge-kinds',
      ...[['weapon', 'Weapon'], ['armour', 'Armour'], ['tool', 'Tool']].map(([id, name]) => h(`button.btn.sm${hud._forgeKind === id ? '.primary' : ''}`, { onclick: () => { hud._forgeKind = id; render(); } }, name)),
      hud._forgeKind === 'tool' ? h('div.forge-toolkinds', ...FORGE_TOOL_KINDS.map(k => h(`button.btn.sm${hud._forgeToolKind === k ? '.primary' : '.ghost'}`, { onclick: () => { hud._forgeToolKind = k; render(); } }, TOOL_KINDS[k].name))) : null);

    const slots = h('div.forge-slots', ...Array.from({ length: MAX_SLOTS }, (_, i) => {
      const k = Object.keys(mix)[i];
      if (!k) return h('div.forge-slot.empty', h('span', '+'));
      const mt = MATERIALS[k];
      return h('div.forge-slot', { style: { borderColor: RARITY[mt.rarity].color }, title: `${mt.name}: click to take one out (right-click: all)`, onclick: () => sub(k, 1), oncontextmenu: e => { e.preventDefault(); sub(k, 999); } },
        icon(matIcon(k), 36), h('span.forge-slot-n', `x${mix[k]}`), h('span.forge-slot-name', mt.name));
    }));

    const owned = MATERIAL_KEYS.filter(k => (res[k] || 0) > 0).sort((a, b) => MATERIALS[a].rarity - MATERIALS[b].rarity);
    const bag = h('div.mat-grid.forge-bag', ...owned.map(k => {
      const mt = MATERIALS[k], left = (res[k] || 0) - (mix[k] || 0);
      return h(`button.mat-cell${left <= 0 ? '.used' : ''}`, { style: { borderColor: RARITY[mt.rarity].color }, title: `${mt.name}${mt.trait ? ` (${TRAITS[mt.trait].name})` : ''}: click adds 1, right-click adds 5`, onclick: () => add(k, 1), oncontextmenu: e => { e.preventDefault(); add(k, 5); } },
        icon(matIcon(k), 30), h('span.mat-count', fmtN(left)));
    }), ...(owned.length ? [] : [h('div.faint', 'No materials yet. Mine ores and defeat bosses.')]));

    const p = forgePreview(mix, hud._forgeKind, hud._forgeToolKind);
    const preview = h('div.forge-preview',
      p.ok ? h('div.forge-stats',
        h('span', `Power x${p.mult.toFixed(2)}`),
        h('span', { style: { color: RARITY[p.rarity].color } }, RARITY[p.rarity].name),
        ...p.traits.map(t => h('span.trait-chip', { style: { color: TRAITS[t].color, borderColor: TRAITS[t].color }, title: TRAITS[t].desc }, TRAITS[t].name))) : h('div.faint', p.why),
      p.ok ? h('div.forge-odds', ...p.odds.slice(0, 6).map(o => {
        if (hud._forgeKind === 'tool') {
          const t = TOOLS[o.base];
          return h('div.odd', icon(hasArt(t.icon) ? t.icon : t.fallbackIcon || 'items/relic', 22), h('span', t.name), h('span.odd-ab', `power ${t.power}`), h('div.spacer'),
            h('div.odd-bar', h('i', { style: { width: `${Math.round(o.chance * 100)}%` } })), h('span.odd-pct', `${Math.round(o.chance * 100)}%`));
        }
        const def = CATALOG.weapon[o.base] || CATALOG.armor[o.base] || CATALOG.helmet[o.base] || CATALOG.shield[o.base];
        const ab = hud._forgeKind === 'weapon' ? abilityOf({ base: o.base, traits: p.traits }) : null;
        return h('div.odd', icon(gearIconKey({ base: o.base, icon: def?.icon, slot: CATALOG.weapon[o.base] ? 'weapon' : 'armor' }) || 'items/relic', 22),
          h('span', def?.name || o.base), ab ? h('span.odd-ab', { style: { color: ab.color } }, ab.name) : null, h('div.spacer'),
          h('div.odd-bar', h('i', { style: { width: `${Math.round(o.chance * 100)}%` } })), h('span.odd-pct', `${Math.round(o.chance * 100)}%`));
      }), p.odds.length > 6 ? h('div.faint', `and ${p.odds.length - 6} more`) : null) : null);

    const go = h('button.btn.primary.forge-go', {
      disabled: !p.ok || !canPay(g, mix),
      onclick: () => {
        m.el.classList.add('forging');
        const base = rollForgeBase(p);
        const bdef = CATALOG.weapon[base] || CATALOG.armor[base] || CATALOG.helmet[base] || CATALOG.shield[base];
        const tl = TOOLS[base];
        const revealIcon = hud._forgeKind === 'tool' && tl ? (hasArt(tl.icon) ? tl.icon : tl.fallbackIcon || 'items/relic') : gearIconKey({ base, icon: bdef?.icon, slot: CATALOG.weapon[base] ? 'weapon' : 'armor' }) || 'items/relic';
        forgeMinigame({ root: document.getElementById('ui'), title: `Forging a ${hud._forgeKind}`, iconKey: 'buildings/workshop', revealIcon, stages: ['heat', 'hammer', 'quench'], tier: p.rarity }).then(score => {
          m.el.classList.remove('forging');
          if (score == null) return;
          const r = forge(g, mix, hud._forgeKind, { score, hero, base, toolKind: hud._forgeToolKind });
          if (!r.ok) { hud.hint(r.why, 1800); render(); return; }
          if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/spark', 12, 18);
          if (r.tool) hud.craftReveal({ made: r.name, item: null, quality: null, extra: r.extra, recipe: { icon: r.icon, fallbackIcon: r.fallbackIcon }, score, bump: r.bump });
          else hud.craftReveal({ made: r.item.name, item: r.item, quality: null, extra: 0, recipe: { icon: r.item.icon }, score, bump: r.bump });
          // keep the same mix ready if you can afford it again
          if (!canPay(g, mix)) for (const k of Object.keys(mix)) mix[k] = Math.min(mix[k], g.state.resources[k] || 0);
          render();
        });
      },
    }, 'Forge');

    return h('div.forge-tab', kinds, slots, preview, h('div.forge-actions', h('button.btn.sm.ghost', { onclick: () => { hud._forgeMix = {}; render(); } }, 'Clear'), go), h('h3', 'Materials'), bag);
  };

  // ------------------------------------------------------------ workbench
  const benchTab = () => {
    // no workbench: better tools come from the Forge; here are the hand-made basics (and potions at a table)
    const list = RECIPES.filter(r => (r.cat === 'tools' && !needsTable(r)) || (r.cat === 'potions' && (atTable || !needsTable(r))));
    const box = h('div.craft-list');
    const fill = () => box.replaceChildren(...list.map(r => {
      const missing = missingToDiscover(g, r);
      const ic = hasArt(r.icon) ? r.icon : r.fallbackIcon || r.icon;
      if (missing.length) return h('div.craft-card.cant.undiscovered', h('div.craft-icon', icon(ic, 36)), h('div.craft-info', h('b', '???'), h('div.faint.craft-desc', `Find ${missing.join(' and ')}`)));
      const ok = canCraft(g, r, hero);
      return h(`div.craft-card${ok ? '' : '.cant'}`,
        h('div.craft-icon', icon(ic, 36)),
        h('div.craft-info', h('b', r.name), h('div.faint.craft-desc', r.desc), h('div.craft-cost', costChips(r.cost, g.state.resources))),
        h('div.craft-side',
          h(`button.btn.sm${ok ? '.primary' : ''}`, { disabled: !ok, onclick: e => hud.startCraft(r, e.currentTarget.closest('.craft-card'), fill) }, 'Craft'),
          h('button.btn.sm.ghost', { disabled: !ok, title: 'Craft 5 at once (no minigames)', onclick: e => hud.startCraft(r, e.currentTarget.closest('.craft-card'), fill, { times: 5 }) }, 'x5')));
    }));
    fill();
    return h('div.bench-tab', box);
  };

  render();
  return m;
}
