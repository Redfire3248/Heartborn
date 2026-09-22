/*
 * The Backpack: one screen for everything you carry, opened with E (or from the Character button).
 * Tabs like the Forge: Character (your figure, stats and attributes), Gear (what you wear and your bag),
 * Tools, Items and Materials. Anything you tap can go straight into your hotbar.
 */
import { h, icon, modal, closeIfOpen, rarityFrame, smallIcon } from './dom.js';
import { play } from '../core/sound.js';
import { spriteAvailable } from '../core/assets.js';
import { hasArt, gearIconKey } from '../render/gearArt.js';
import { rpgOf, heroStats, xpToNext, spendPoint, equip, equipBest, unequip, scrapGear, gearScore, RARITY } from '../game/rpg.js';
import { TOOLS, toolsOf, hotbarOf, setSlot, selectSlot, toolRarity } from '../game/tools.js';
import { CONSUMABLES, itemsOf } from '../game/consumables.js';
import { MATERIALS, MATERIAL_KEYS, abilityOf as weaponAbility } from '../game/forging.js';
import { TRAITS } from '../data/traits.js';
import { matIcon } from './tableMenu.js';
import { ENCHANTS, enchName, peekEnchants } from '../game/enchanting.js';
import { AVATARS, avatarId, avatarArt, setLook } from '../game/avatars.js';
import { heroOf, avatarOf } from '../game/hero.js';

const TABS = [
  { key: 'char', name: 'Character', icon: 'ui/character' },
  { key: 'gear', name: 'Gear', icon: 'ui/tab_gear' },
  { key: 'tools', name: 'Tools', icon: 'items/hammer' },
  { key: 'items', name: 'Items', icon: 'items/potion_health' },
  { key: 'mats', name: 'Materials', icon: 'ui/tab_ore' },
];

const fmtN = n => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));
const toolIcon = k => (hasArt(TOOLS[k]?.icon) ? TOOLS[k].icon : TOOLS[k]?.fallbackIcon || 'items/relic');
const gearText = it => (it.slot === 'shield' ? `blocks ${Math.round((it.block || 0) * 100)}%${it.armor ? ` · +${Math.round(it.armor * 100)}% armour` : ''}`
  : it.slot === 'weapon' ? `${it.dmg} damage`
  : it.slot === 'armor' || it.slot === 'helmet' ? `${Math.round(it.armor * 100)}% armour`
  : Object.entries(it.bonus || {}).map(([k, n]) => (k === 'hp' ? `+${n} health` : `+${Math.round(n * 100)}% ${k === 'dmg' ? 'damage' : k}`)).join(', '));

/** The enchantments on a piece of gear, as little chips. */
const enchChips = ench => Object.entries(ench || {}).map(([k, l]) => h('span.bp-ench', { style: { color: ENCHANTS[k]?.color, borderColor: ENCHANTS[k]?.color } }, smallIcon(`ui/ench_${k}`, 13), enchName(k, l)));

/** Puts something in your hotbar: the first free slot, or the one you hold. */
function toHotbar(g, key) {
  const bar = hotbarOf(g), at = bar.indexOf(key);
  if (at >= 0) { selectSlot(g, at); return at; }
  const free = bar.indexOf(null);
  const slot = free >= 0 ? free : rpgOf(g).hotSel;
  setSlot(g, slot, key);
  return slot;
}

export function openBackpack(hud, tab = null) {
  if (!tab && closeIfOpen('backpack-modal')) return null;
  const g = hud.game;
  const m = modal([], { cls: 'backpack-modal', closeX: true });
  hud._bpTab = tab || hud._bpTab || 'char';
  const body = h('div.bp-body');

  const render = () => {
    const r = rpgOf(g);
    const bar = hotbarOf(g);
    const t = hud._bpTab;
    const refresh = () => { g.emit?.('change'); render(); };

    // ---------------------------------------------------------------- Character
    const charTab = () => {
      const st = heroStats(g);
      const v = heroOf(g) || avatarOf(g);
      const xpK = Math.min(1, r.xp / xpToNext(r.level));
      const bar2 = (label, value, k, color) => h('div.bp-stat',
        h('span.bp-stat-name', label), h('b', value),
        h('div.bp-stat-bar', h('i', { style: { width: `${Math.max(3, Math.min(100, k * 100))}%`, background: color } })));
      const attr = (id, label, desc) => h('div.bp-attr', { title: desc },
        h('span.bp-attr-name', label), h('b', String(r[id])), h('span.faint.bp-attr-desc', desc),
        h('button.btn.sm.primary', { disabled: !r.points, onclick: () => { spendPoint(g, id); refresh(); } }, '+'));
      const worn = ['weapon', 'armor', 'helmet', 'shield', 'trinket'].map(slot => {
        const it = r.gear[slot];
        return h(`button.bp-doll-slot${it ? '' : '.empty'}`, {
          title: it ? `${it.name}: ${gearText(it)} (tap for the Gear tab)` : `${slot}: empty`,
          style: it ? { borderColor: RARITY[it.rarity].color, boxShadow: `inset 0 0 14px ${RARITY[it.rarity].color}55` } : null,
          onclick: () => { hud._bpTab = 'gear'; hud._bpSel = it?.id || null; play('click'); render(); },
        }, it ? icon(gearIconKey(it) || 'items/relic', 30) : h('span.bp-doll-label', slot));
      });
      return [
        h('div.bp-hero',
          h('div.bp-figure', spriteAvailable(avatarArt(avatarId(g))) ? icon(avatarArt(avatarId(g)), 112) : icon('items/crown_leader', 72)),
          h('div.bp-hero-right',
            h('h3', v?.name || 'You'),
            h('div.bp-xp', h('span', `Level ${r.level}`), h('div.bp-xp-bar', h('i', { style: { width: `${xpK * 100}%` } })), h('span.faint', `${r.xp} / ${xpToNext(r.level)} XP`)),
            h('div.bp-worn', ...worn),
            spriteAvailable(avatarArt('king')) ? h('button.btn.sm.ghost', { onclick: () => { hud._bpLook = !hud._bpLook; render(); } }, hud._bpLook ? 'Done' : 'Change look') : null)),
        hud._bpLook ? h('div.bp-avatars', ...AVATARS.map(a => h(`button.bp-avatar${avatarId(g) === a.id ? '.on' : ''}`, { title: a.name, onclick: () => { setLook(g, a.id); hud._bpLook = false; render(); } }, icon(avatarArt(a.id), 40), h('span', a.name)))) : null,
        h('div.bp-stats',
          bar2('Health', st.maxHp, st.maxHp / 400, '#ff5b6b'),
          bar2('Stamina', st.maxStamina, st.maxStamina / 260, '#8fe07a'),
          bar2('Damage', `x${st.dmgMult.toFixed(2)}`, (st.dmgMult - 1) / 2, '#ffae3d'),
          bar2('Crit', `${Math.round(st.crit * 100)}%`, st.crit / 0.6, '#ffd76a'),
          bar2('Armour', `${Math.round(st.armor * 100)}%`, st.armor / 0.7, '#5aa9ff'),
          bar2('Speed', `x${st.speed.toFixed(2)}`, (st.speed - 1) / 1, '#c77dff')),
        h('div.bp-attr-head', h('b', 'Attributes'), r.points ? h('span.bp-points', `${r.points} point${r.points === 1 ? '' : 's'} to spend`) : h('span.faint', 'Earned by levelling up')),
        attr('might', 'Might', '+8% damage'),
        attr('vigor', 'Vigor', '+12 health'),
        attr('agility', 'Agility', 'stamina, speed and crits'),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Gear
    const gearTab = () => {
      const sel = hud._bpSel;
      const wornPair = Object.entries(r.gear).find(([, it]) => it && it.id === sel);
      const picked = wornPair ? wornPair[1] : r.bag.find(x => x.id === sel);
      const cell = (it, isWorn) => {
        const fr = rarityFrame(it.rarity);
        const better = !isWorn && gearScore(it) > gearScore(r.gear[it.slot]);
        return h(`button.bp-cell${sel === it.id ? '.sel' : ''}${fr.cls}`, { style: fr.style, title: `${it.name}: ${gearText(it)}`, onclick: () => { hud._bpSel = sel === it.id ? null : it.id; play('click'); render(); } },
          icon(gearIconKey(it) || 'items/relic', 34),
          better ? h('span.bp-up', '▲') : null,
          isWorn ? h('span.bp-on', 'ON') : null,
          it.slot === 'weapon' && weaponAbility(it) ? h('span.ability-badge', { title: 'Has a special ability (F)' }, 'SKILL') : null);
      };
      const junk = r.bag.filter(it => it.rarity <= 1 && gearScore(it) <= gearScore(r.gear[it.slot]));
      return [
        h('div.bp-row-head', h('b', 'Worn'), h('div.spacer'),
          r.bag.length ? h('button.btn.sm.primary', { title: 'Put on the best piece you own for every slot', onclick: () => { const n = equipBest(g); hud.hint(n ? `Equipped ${n} better piece${n === 1 ? '' : 's'}` : 'You already wear your best gear', 1800); hud._bpSel = null; refresh(); } }, 'Equip best') : null,
          junk.length ? h('button.btn.sm', { title: 'Scrap every Common and Rare piece that is no better than what you wear', onclick: () => { let gold = 0; for (const it of junk) gold += scrapGear(g, it.id); hud.hint(`Scrapped ${junk.length}: +${gold} gold`, 1800); hud._bpSel = null; refresh(); } }, 'Scrap junk') : null),
        h('div.bp-grid', ...Object.values(r.gear).filter(Boolean).map(it => cell(it, true)), ...(Object.values(r.gear).filter(Boolean).length ? [] : [h('div.faint', 'Nothing on yet')])),
        picked ? h('div.bp-detail', { style: { borderColor: RARITY[picked.rarity].color } },
          icon(gearIconKey(picked) || 'items/relic', 40),
          h('div.bp-detail-text',
            h('b', { style: { color: RARITY[picked.rarity].color } }, picked.name),
            h('div.faint', `${RARITY[picked.rarity].name} ${picked.slot} · ${gearText(picked)}`),
            h('div.bp-enchs', ...enchChips(picked.ench))),
          h('div.bp-detail-btns',
            wornPair
              ? h('button.btn.sm', { onclick: () => { unequip(g, wornPair[0]); hud._bpSel = null; refresh(); } }, 'Take off')
              : h('button.btn.sm.primary', { onclick: () => { equip(g, picked.id); hud._bpSel = null; refresh(); } }, 'Equip'),
            wornPair ? null : h('button.btn.sm', { title: 'Break it down for gold', onclick: () => { const gold = scrapGear(g, picked.id); hud.hint(`+${gold} gold`, 1500); hud._bpSel = null; refresh(); } }, 'Scrap'))) : null,
        h('div.bp-row-head', h('b', `Bag (${r.bag.length})`)),
        h('div.bp-grid', ...r.bag.map(it => cell(it, false)), ...Array.from({ length: Math.max(0, 18 - r.bag.length) }, () => h('div.bp-cell.empty'))),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Tools
    const toolsTab = () => {
      const owned = toolsOf(g);
      const keys = Object.keys(owned).filter(k => TOOLS[k] && owned[k] > 0);
      const KIND_NAME = { sword: 'Swords', weapon: 'Weapons', pickaxe: 'Pickaxes', axe: 'Axes', shovel: 'Shovels', hoe: 'Hoes', sickle: 'Sickles', hammer: 'Hammers', fishing_rod: 'Fishing rods' };
      const groups = [
        ...Object.entries(KIND_NAME).map(([kind, name]) => ({ name, of: k => TOOLS[k].kind === kind && !TOOLS[k].utility })),
        { name: 'Useful things', of: k => TOOLS[k].utility },
      ];
      const seen = new Set();
      const cell = k => {
        const at = bar.indexOf(k), fr = rarityFrame(toolRarity(k));
        return h(`button.bp-cell${at === r.hotSel ? '.held' : at >= 0 ? '.inbar' : ''}${fr.cls}`, {
          style: fr.style, title: `${TOOLS[k].name}${TOOLS[k].does ? ` — ${TOOLS[k].does}` : ''}`,
          onclick: () => { const slot = toHotbar(g, k); hud.hint(`${TOOLS[k].name} in slot ${slot + 1}`, 1200); play('click'); refresh(); },
        }, icon(toolIcon(k), 34), owned[k] > 1 ? h('span.hot-count', String(owned[k])) : null, at >= 0 ? h('span.hot-num', String(at + 1)) : null);
      };
      const out = [h('div.faint', 'Tap a tool to put it in your hotbar.')];
      for (const grp of groups) {
        const ks = keys.filter(k => !seen.has(k) && grp.of(k)).sort((a, b) => (TOOLS[b].power || 0) - (TOOLS[a].power || 0));
        ks.forEach(k => seen.add(k));
        if (!ks.length) continue;
        out.push(h('div.bp-row-head', h('b', grp.name), h('span.faint', `${ks.length}`)), h('div.bp-grid', ...ks.map(cell)));
      }
      const rest = keys.filter(k => !seen.has(k));
      if (rest.length) out.push(h('div.bp-row-head', h('b', 'Other')), h('div.bp-grid', ...rest.map(cell)));
      if (!keys.length) out.push(h('div.faint', 'No tools yet: forge some at the Forge.'));
      return out;
    };

    // ---------------------------------------------------------------- Items
    const itemsTab = () => {
      const items = itemsOf(g);
      const keys = Object.keys(items).filter(k => CONSUMABLES[k] && items[k] > 0);
      const cell = key => {
        const def = CONSUMABLES[key], slotKey = `item:${key}`, at = bar.indexOf(slotKey);
        return h(`button.bp-cell${at === r.hotSel ? '.held' : at >= 0 ? '.inbar' : ''}`, {
          title: `${def.name}${def.desc ? ` — ${def.desc}` : ''}`,
          onclick: () => { const slot = toHotbar(g, slotKey); hud.hint(`${def.name} in slot ${slot + 1}`, 1200); play('click'); refresh(); },
        }, icon(hasArt(def.icon) ? def.icon : 'items/relic', 34), h('span.hot-count', String(items[key])), at >= 0 ? h('span.hot-num', String(at + 1)) : null);
      };
      return [
        h('div.faint', 'Potions, food and anything else you can use. Tap to hold it.'),
        (r.potions || 0) > 0 ? h('div.bp-row-head', h('b', 'Healing potions'), h('span.faint', String(r.potions))) : null,
        (r.potions || 0) > 0 ? h('div.bp-grid', h(`button.bp-cell${bar.indexOf('potion') === r.hotSel ? '.held' : bar.includes('potion') ? '.inbar' : ''}`, {
          title: 'Healing potion', onclick: () => { const slot = toHotbar(g, 'potion'); hud.hint(`Potion in slot ${slot + 1}`, 1200); play('click'); refresh(); },
        }, icon('items/potion_health', 34), h('span.hot-count', String(r.potions)))) : null,
        keys.length ? h('div.bp-row-head', h('b', 'Other items'), h('span.faint', String(keys.length))) : null,
        keys.length ? h('div.bp-grid', ...keys.map(cell)) : h('div.faint', 'Nothing else to use yet.'),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Materials
    const matsTab = () => {
      const owned = MATERIAL_KEYS.filter(k => (g.state.resources[k] || 0) > 0).sort((a, b) => MATERIALS[a].rarity - MATERIALS[b].rarity);
      const info = h('div.faint.bp-mat-info', 'Everything you can forge with. Hover one to see what it does.');
      const cells = owned.map(k => {
        const mt = MATERIALS[k], color = RARITY[mt.rarity].color;
        return h('div.bp-cell.bp-mat', {
          style: { borderColor: color }, title: mt.name,
          onmouseenter: () => info.replaceChildren(h('b', { style: { color } }, mt.name), h('span', ` · ${RARITY[mt.rarity].name} · power x${mt.mult}${mt.trait ? ` · ${TRAITS[mt.trait].name}: ${TRAITS[mt.trait].desc}` : ''}${mt.boss ? ' · dropped by a boss' : ''}`)),
        }, icon(matIcon(k), 34), h('span.hot-count', fmtN(g.state.resources[k])));
      });
      return [info, h('div.bp-grid', ...cells, ...Array.from({ length: Math.max(0, 18 - cells.length) }, () => h('div.bp-cell.empty')))];
    };

    const content = t === 'char' ? charTab() : t === 'gear' ? gearTab() : t === 'tools' ? toolsTab() : t === 'items' ? itemsTab() : matsTab();
    body.replaceChildren(...content);
    m.el.replaceChildren(m.closeBtn,
      h('div.bp-head', icon(hasArt('ui/inventory') ? 'ui/inventory' : 'ui/character', 30), h('div', h('h2', 'Backpack'), h('div.faint', `Level ${r.level}${r.points ? ` · ${r.points} point${r.points === 1 ? '' : 's'} to spend` : ''} · ${g.state.resources.gold || 0} gold`))),
      h('div.bp-tabs', ...TABS.map(tb => h(`button.bp-tab${t === tb.key ? '.on' : ''}`, { onclick: () => { hud._bpTab = tb.key; play('click'); render(); } }, hasArt(tb.icon) ? icon(tb.icon, 18) : null, tb.name))),
      body);
  };
  render();
  return m;
}
