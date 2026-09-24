/*
 * The Backpack: one screen for everything you carry, opened with E.
 * Tabs like the Forge: Character (your figure, stats and training), Gear (what you wear and your bag),
 * Tools, Items and Materials. Anything you tap goes into your hotbar, and anything you do not want can be sold.
 *
 * Hovering anything shows a card with its name, what it does and what it is worth.
 */
import { h, icon, modal, closeIfOpen, rarityFrame, smallIcon } from './dom.js';
import { play } from '../core/sound.js';
import { spriteAvailable } from '../core/assets.js';
import { hasArt, gearIconKey } from '../render/gearArt.js';
import { rpgOf, heroStats, xpToNext, spendPoint, resetStats, resetStatsCost, equip, equipBest, unequip, scrapGear, gearScore, RARITY } from '../game/rpg.js';
import { TOOLS, toolsOf, hotbarOf, setSlot, selectSlot, toolRarity, toolValue, sellTool } from '../game/tools.js';
import { CONSUMABLES, itemsOf } from '../game/consumables.js';
import { MATERIALS, MATERIAL_KEYS, TRAITS, abilityOf as weaponAbility } from '../game/forging.js';
import { RACES, RACE_KEYS, raceOf, raceDef, lookOf, raceArt, setRace } from '../game/races.js';
import { ATTUNEMENTS, ATTUNE_KEYS, attunement } from '../game/attune.js';
import { matIcon } from './tableMenu.js';
import { ENCHANTS, enchName } from '../game/enchanting.js';
import { AVATARS, avatarId, avatarArt, setLook, heroLook } from '../game/avatars.js';
import { heroOf, avatarOf } from '../game/hero.js';

const TABS = [
  { key: 'char', name: 'Character', icon: 'ui/character' },
  { key: 'gear', name: 'Gear', icon: 'ui/tab_gear' },
  { key: 'tools', name: 'Tools', icon: 'items/hammer' },
  { key: 'items', name: 'Items', icon: 'gear/health_potion' },
  { key: 'mats', name: 'Materials', icon: 'ui/tab_ore' },
];

const fmtN = n => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));
const toolIcon = k => (hasArt(TOOLS[k]?.icon) ? TOOLS[k].icon : TOOLS[k]?.fallbackIcon || 'items/relic');
const itemIcon = def => (hasArt(def?.icon) ? def.icon : 'gear/health_potion');
const gearText = it => (it.slot === 'shield' ? `blocks ${Math.round((it.block || 0) * 100)}%${it.armor ? ` · +${Math.round(it.armor * 100)}% armour` : ''}`
  : it.slot === 'weapon' ? `${it.dmg} damage`
  : it.slot === 'armor' || it.slot === 'helmet' ? `${Math.round(it.armor * 100)}% armour`
  : Object.entries(it.bonus || {}).map(([k, n]) => (k === 'hp' ? `+${n} health` : `+${Math.round(n * 100)}% ${k === 'dmg' ? 'damage' : k}`)).join(', '));
const gearValue = it => 8 * (1 + it.rarity * it.rarity * 2);

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

// ------------------------------------------------------------------ the card that follows your cursor

let tipEl = null;
function showTip(target, parts) {
  if (!tipEl) { tipEl = h('div.bp-tip'); document.body.append(tipEl); }
  tipEl.replaceChildren(...parts.filter(Boolean));
  tipEl.classList.add('on');
  const place = e => {
    const r = tipEl.getBoundingClientRect();
    const x = Math.min(window.innerWidth - r.width - 8, (e.clientX || 0) + 14);
    const y = Math.max(8, Math.min(window.innerHeight - r.height - 8, (e.clientY || 0) - r.height - 10));
    tipEl.style.left = `${Math.max(8, x)}px`;
    tipEl.style.top = `${y}px`;
  };
  target._tipMove = place;
  target.addEventListener('mousemove', place);
}
function hideTip(target) {
  tipEl?.classList.remove('on');
  if (target?._tipMove) { target.removeEventListener('mousemove', target._tipMove); target._tipMove = null; }
}
/** Gives an element a hover card: `parts()` builds it when the pointer arrives. */
function withTip(el, parts) {
  el.addEventListener('mouseenter', e => { let built = []; try { built = parts(); } catch { built = []; } if (!built.length) return; showTip(el, built); el._tipMove?.(e); });
  el.addEventListener('mouseleave', () => hideTip(el));
  el.addEventListener('pointerdown', () => hideTip(el));
  return el;
}
const tipHead = (name, sub, color) => h('div.bp-tip-head', h('b', { style: color ? { color } : null }, name), sub ? h('span.faint', sub) : null);

export function openBackpack(hud, tab = null) {
  if (!tab && closeIfOpen('backpack-modal')) return null;
  if (hud.els?.invPanel) hud.els.invPanel.hidden = true;   // the little hotbar panel would sit under this one
  const g = hud.game;
  const m = modal([], { cls: 'backpack-modal', closeX: true });
  hud._bpTab = tab || hud._bpTab || 'char';
  hud._sell ||= null;   // { gear: Set, tools: Map } while you are picking things to sell
  const body = h('div.bp-body');
  m.el.addEventListener('pointerleave', () => hideTip(null));

  const render = () => {
    const r = rpgOf(g);
    const bar = hotbarOf(g);
    const t = hud._bpTab;
    const refresh = () => { g.emit?.('change'); render(); };
    const sell = hud._sell;

    // ---------------------------------------------------------------- Character
    const charTab = () => {
      const st = heroStats(g);
      const v = heroOf(g) || avatarOf(g);
      const xpK = Math.min(1, r.xp / xpToNext(r.level));
      const statRow = (label, value, k, color, tip) => withTip(h('div.bp-stat',
        h('span.bp-stat-name', label), h('b', value),
        h('div.bp-stat-bar', h('i', { style: { width: `${Math.max(3, Math.min(100, k * 100))}%`, background: color } }))),
      () => [tipHead(label, null, color), h('div', tip), h('div.faint', `Now: ${value}`)]);

      const STAT_TIP = {
        might: ['Damage', 'Every point: +8% damage on everything you swing, shoot or cast.'],
        vigor: ['Health', 'Every point: +12 health. The plainest way to survive a deep floor.'],
        agility: ['Speed', 'Every point: +8 stamina, a little more speed and +1.2% critical hits.'],
      };
      const attr = (id) => {
        const [name, tip] = STAT_TIP[id];
        const put = n => { const done = spendPoint(g, id, n); if (done) { play('click'); refresh(); } };
        return withTip(h('div.bp-attr',
          h('div.bp-attr-left', h('span.bp-attr-name', name), h('b.bp-attr-val', String(r[id] || 0))),
          h('div.bp-attr-desc.faint', tip),
          h('div.bp-attr-btns',
            h('button.btn.sm.primary', { disabled: !r.points, onclick: () => put(1) }, '+1'),
            h('button.btn.sm', { disabled: r.points < 1, onclick: () => put(5) }, '+5'),
            h('button.btn.sm', { disabled: !r.points, title: 'Put every point you have into this', onclick: () => put(r.points) }, 'Max'))),
        () => [tipHead(name, `${r[id] || 0} points`), h('div', tip)]);
      };
      const cost = resetStatsCost(g);

      /**
       * Who you are: a race down the left, its four faces and what it does for you on the right. Picking a face
       * picks the race with it, so there is never a half-made choice.
       */
      const raceChooser = () => {
        const cur = raceOf(g);
        const sel = hud._bpRace || cur;
        const def = RACES[sel];
        return h('div.bp-races',
          h('div.bp-race-list', ...RACE_KEYS.map(k => h(`button.bp-race${k === sel ? '.on' : ''}${k === cur ? '.worn' : ''}`,
            { style: { '--rc': RACES[k].color }, onclick: () => { hud._bpRace = k; render(); } },
            icon(raceArt(RACES[k].looks[0]), 26), h('span', RACES[k].name)))),
          h('div.bp-race-detail',
            h('div.bp-race-head', h('h4', { style: { color: def.color } }, def.name), cur === sel ? h('span.bp-race-now', 'you') : null),
            h('div.faint', def.desc),
            h('div.bp-race-stats', ...[['Health', def.mult.hp], ['Damage', def.mult.dmg], ['Speed', def.mult.speed], ['Stamina', def.mult.stamina], ['Crit', def.mult.crit]]
              .filter(([, m]) => m !== 1)
              .map(([label, m]) => h(`span.bp-race-stat${m > 1 ? '.up' : '.down'}`, `${label} ${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`))),
            h('div.bp-race-passive', def.passive),
            h('div.bp-race-faces', ...def.looks.map(look => h(`button.bp-face${lookOf(g) === look && cur === sel ? '.on' : ''}`,
              { title: 'Wear this one', onclick: () => { setRace(g, sel, look); hud._bpLook = false; play('reveal'); refresh(); } },
              icon(raceArt(look), 56))))));
      };

      return [
        h('div.bp-hero',
          h('div.bp-figure', spriteAvailable(heroLook(g)) ? icon(heroLook(g), 108) : icon('items/crown_leader', 72)),
          h('div.bp-hero-right',
            h('div.bp-hero-name', h('h3', hud.username || v?.name || 'You'), h('span.bp-lvl', `Level ${r.level}`)),
            h('div.bp-xp', h('div.bp-xp-bar', h('i', { style: { width: `${xpK * 100}%` } })), h('span.faint', `${Math.round(r.xp)} / ${xpToNext(r.level)} XP`)),
            h('div.bp-worn', ...['weapon', 'armor', 'helmet', 'shield', 'trinket'].map(slot => {
              const it = r.gear[slot];
              return withTip(h(`button.bp-doll-slot${it ? '' : '.empty'}`, {
                style: it ? { borderColor: RARITY[it.rarity].color, boxShadow: `inset 0 0 14px ${RARITY[it.rarity].color}55` } : null,
                onclick: () => { hud._bpTab = 'gear'; hud._bpSel = it?.id || null; play('click'); render(); },
              }, it ? icon(gearIconKey(it) || 'items/relic', 30) : h('span.bp-doll-label', slot)),
              () => (it
                ? [tipHead(it.name, `${RARITY[it.rarity].name} ${it.slot}`, RARITY[it.rarity].color), h('div', gearText(it)), ...enchChips(it.ench), h('div.faint', 'Click to open it in Gear')]
                : [tipHead(slot, 'empty'), h('div.faint', `Nothing on your ${slot} yet`)]));
            })),
            h('div.row', { style: { gap: '5px', flexWrap: 'wrap' } },
              h('span.bp-race-chip', { style: { borderColor: raceDef(g).color, color: raceDef(g).color } }, raceDef(g).name),
              h('button.btn.sm.ghost', { onclick: () => { hud._bpLook = !hud._bpLook; render(); } }, hud._bpLook ? 'Done' : 'Change character')))),
        hud._bpLook ? raceChooser() : null,
        h('div.bp-stats',
          statRow('Health', st.maxHp, st.maxHp / 400, '#ff5b6b', 'How much you can take before you are knocked out.'),
          statRow('Stamina', st.maxStamina, st.maxStamina / 260, '#8fe07a', 'Swings, dashes and holding a guard all spend it.'),
          statRow('Damage', `x${st.dmgMult.toFixed(2)}`, (st.dmgMult - 1) / 2, '#ffae3d', 'Everything you hit with is multiplied by this.'),
          statRow('Crit', `${Math.round(st.crit * 100)}%`, st.crit / 0.6, '#ffd76a', 'The chance a blow lands for nearly double.'),
          statRow('Armour', `${Math.round(st.armor * 100)}%`, st.armor / 0.7, '#5aa9ff', 'Taken off every blow that reaches you. Caps at 70%.'),
          statRow('Speed', `x${st.speed.toFixed(2)}`, (st.speed - 1) / 1, '#c77dff', 'How fast you walk and run.')),
        h('div.bp-attr-head',
          h('b', 'Training'),
          r.points ? h('span.bp-points', `${r.points} point${r.points === 1 ? '' : 's'} to spend`) : h('span.faint', 'Level up to earn points'),
          h('div.spacer'),
          withTip(h('button.btn.sm.ghost', {
            disabled: !cost.spent || (g.state.resources.gold || 0) < cost.gold,
            onclick: () => { const res = resetStats(g); if (!res.ok) { hud.hint(res.why, 1800); return; } hud.hint(`All ${res.points} points are yours again`, 2200); play('complete'); refresh(); },
          }, `Forget training · ${cost.gold} gold`),
          () => [tipHead('Forget your training'), h('div', 'Every point you have spent comes back, so you can build your hero another way.'), h('div.faint', `Costs ${cost.gold} gold (${cost.spent} points spent)`)])),
        attr('might'), attr('vigor'), attr('agility'),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Gear
    const gearTab = () => {
      const selId = hud._bpSel;
      const wornPair = Object.entries(r.gear).find(([, it]) => it && it.id === selId);
      const picked = wornPair ? wornPair[1] : r.bag.find(x => x.id === selId);
      const cell = (it, isWorn) => {
        const fr = rarityFrame(it.rarity);
        const better = !isWorn && gearScore(it) > gearScore(r.gear[it.slot]);
        const marked = sell?.gear.has(it.id);
        return withTip(h(`button.bp-cell${selId === it.id ? '.sel' : ''}${marked ? '.marked' : ''}${fr.cls}`, {
          style: fr.style,
          onclick: () => {
            if (sell && !isWorn) { if (marked) sell.gear.delete(it.id); else sell.gear.add(it.id); play('click'); render(); return; }
            if (sell && isWorn) { hud.hint('Take it off first', 1400); return; }
            hud._bpSel = selId === it.id ? null : it.id; play('click'); render();
          },
        }, icon(gearIconKey(it) || 'items/relic', 34),
        better ? h('span.bp-up', '▲') : null,
        isWorn ? h('span.bp-on', 'ON') : null,
        marked ? h('span.bp-tick', '✓') : null,
        it.slot === 'weapon' && weaponAbility(it) ? h('span.ability-badge', 'SKILL') : null),
        () => [tipHead(it.name, `${RARITY[it.rarity].name} ${it.slot}`, RARITY[it.rarity].color),
          h('div', gearText(it)),
          ...enchChips(it.ench),
          isWorn ? h('div.faint', 'Worn right now') : better ? h('div', { style: { color: '#7ee06a' } }, 'Better than what you wear') : null,
          h('div.faint', `Sells for ${gearValue(it)} gold`)]);
      };
      const worn = Object.values(r.gear).filter(Boolean);
      return [
        h('div.bp-row-head', h('b', 'Worn'), h('div.spacer'),
          r.bag.length ? h('button.btn.sm.primary', { onclick: () => { const n = equipBest(g); hud.hint(n ? `Put on ${n} better piece${n === 1 ? '' : 's'}` : 'You already wear your best', 1800); hud._bpSel = null; refresh(); } }, 'Equip best') : null,
          h(`button.btn.sm${sell ? '.danger' : ''}`, { onclick: () => { hud._sell = sell ? null : { gear: new Set(), tools: new Map() }; play('click'); render(); } }, sell ? 'Stop selling' : 'Sell…')),
        h('div.bp-grid', ...worn.map(it => cell(it, true)), ...(worn.length ? [] : [h('div.faint', 'Nothing on yet')])),
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
            wornPair ? null : h('button.btn.sm', { onclick: () => { const gold = scrapGear(g, picked.id); hud.hint(`+${gold} gold`, 1500); hud._bpSel = null; refresh(); } }, `Sell · ${gearValue(picked)}g`))) : null,
        h('div.bp-row-head', h('b', `Bag (${r.bag.length})`), sell ? h('span.faint', 'Tap what you want to sell') : null),
        h('div.bp-grid', ...r.bag.map(it => cell(it, false)), ...Array.from({ length: Math.max(0, 12 - r.bag.length) }, () => h('div.bp-cell.empty'))),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Tools
    const toolsTab = () => {
      const owned = toolsOf(g);
      const keys = Object.keys(owned).filter(k => TOOLS[k] && owned[k] > 0);
      const KIND_NAME = { sword: 'Swords', weapon: 'Weapons', pickaxe: 'Pickaxes', axe: 'Axes', shovel: 'Shovels', hoe: 'Hoes', sickle: 'Sickles', hammer: 'Hammers', fishing_rod: 'Fishing rods' };
      const groups = [...Object.entries(KIND_NAME).map(([kind, name]) => ({ name, of: k => TOOLS[k].kind === kind && !TOOLS[k].utility })), { name: 'Useful things', of: k => TOOLS[k].utility }];
      const seen = new Set();
      const cell = k => {
        const at = bar.indexOf(k), fr = rarityFrame(toolRarity(k)), def = TOOLS[k];
        const marked = (sell?.tools.get(k) || 0) > 0;
        return withTip(h(`button.bp-cell${at === r.hotSel ? '.held' : at >= 0 ? '.inbar' : ''}${marked ? '.marked' : ''}${fr.cls}`, {
          style: fr.style,
          onclick: () => {
            if (sell) {
              const have = owned[k] || 0, now = sell.tools.get(k) || 0;
              if (now >= have) sell.tools.delete(k); else sell.tools.set(k, now + 1);
              play('click'); render(); return;
            }
            const slot = toHotbar(g, k); hud.hint(`${def.name} in slot ${slot + 1}`, 1200); play('click'); refresh();
          },
        }, icon(toolIcon(k), 34),
        owned[k] > 1 ? h('span.hot-count', String(owned[k])) : null,
        at >= 0 ? h('span.hot-num', String(at + 1)) : null,
        marked ? h('span.bp-tick', `✓${sell.tools.get(k) > 1 ? sell.tools.get(k) : ''}`) : null),
        () => [tipHead(def.name, RARITY[toolRarity(k)].name, RARITY[toolRarity(k)].color),
          def.does ? h('div', def.does) : null,
          def.power ? h('div.faint', `Power ${def.power}`) : null,
          h('div.faint', `Sells for ${toolValue(k)} gold`),
          h('div.faint', sell ? 'Tap to mark one for selling' : 'Tap to hold it')]);
      };
      const out = [h('div.bp-row-head', h('span.faint', sell ? 'Tap tools to mark them for selling' : 'Tap a tool to put it in your hotbar'), h('div.spacer'),
        h(`button.btn.sm${sell ? '.danger' : ''}`, { onclick: () => { hud._sell = sell ? null : { gear: new Set(), tools: new Map() }; play('click'); render(); } }, sell ? 'Stop selling' : 'Sell…'))];
      for (const grp of groups) {
        const ks = keys.filter(k => !seen.has(k) && grp.of(k)).sort((a, b) => (TOOLS[b].power || 0) - (TOOLS[a].power || 0));
        ks.forEach(k => seen.add(k));
        if (!ks.length) continue;
        out.push(h('div.bp-row-head', h('b', grp.name), h('span.faint', String(ks.length))), h('div.bp-grid', ...ks.map(cell)));
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
        return withTip(h(`button.bp-cell${at === r.hotSel ? '.held' : at >= 0 ? '.inbar' : ''}`, {
          onclick: () => { const slot = toHotbar(g, slotKey); hud.hint(`${def.name} in slot ${slot + 1}`, 1200); play('click'); refresh(); },
        }, icon(itemIcon(def), 34), h('span.hot-count', String(items[key])), at >= 0 ? h('span.hot-num', String(at + 1)) : null),
        () => [tipHead(def.name, `${items[key]} in your bag`), def.desc ? h('div', def.desc) : null, h('div.faint', 'Tap to hold it')]);
      };
      const potions = r.potions || 0;
      return [
        h('div.faint', 'Potions and anything else you can use. Tap to hold it.'),
        potions > 0 ? h('div.bp-row-head', h('b', 'Healing potions'), h('span.faint', String(potions))) : null,
        potions > 0 ? h('div.bp-grid', withTip(h(`button.bp-cell${bar.indexOf('potion') === r.hotSel ? '.held' : bar.includes('potion') ? '.inbar' : ''}`, {
          onclick: () => { const slot = toHotbar(g, 'potion'); hud.hint(`Potion in slot ${slot + 1}`, 1200); play('click'); refresh(); },
        }, icon('gear/health_potion', 34), h('span.hot-count', String(potions))),
        () => [tipHead('Healing potion', `${potions} in your bag`), h('div', 'Drink it to heal (T, or hold it and attack).')])) : null,
        keys.length ? h('div.bp-row-head', h('b', 'Other items'), h('span.faint', String(keys.length))) : null,
        keys.length ? h('div.bp-grid', ...keys.map(cell)) : h('div.faint', 'Nothing else to use yet.'),
      ].filter(Boolean);
    };

    // ---------------------------------------------------------------- Materials
    const matsTab = () => {
      const owned = MATERIAL_KEYS.filter(k => (g.state.resources[k] || 0) > 0).sort((a, b) => MATERIALS[a].rarity - MATERIALS[b].rarity);
      const cells = owned.map(k => {
        const mt = MATERIALS[k], color = RARITY[mt.rarity].color;
        return withTip(h('div.bp-cell.bp-mat', { style: { borderColor: color } }, icon(matIcon(k), 34), h('span.hot-count', fmtN(g.state.resources[k]))),
          () => [tipHead(mt.name, RARITY[mt.rarity].name, color),
            h('div', `Power x${mt.mult}`),
            mt.trait ? h('div', { style: { color: TRAITS[mt.trait].color } }, `${TRAITS[mt.trait].name}: ${TRAITS[mt.trait].desc}`) : null,
            mt.boss ? h('div.faint', 'Dropped by a boss') : null,
            ATTUNEMENTS[k] ? h('div', { style: { color: ATTUNEMENTS[k].color } }, `${ATTUNEMENTS[k].name} (carry ${ATTUNEMENTS[k].need}): ${ATTUNEMENTS[k].desc}`) : null,
            h('div.faint', `You have ${g.state.resources[k]}`)]);
      });
      // attunement: the rarest ore you are carrying enough of works on you directly, before you forge anything
      const att = attunement(g);
      const attCard = att
        ? h('div.bp-attune', { style: { '--ac': ATTUNEMENTS[att].color } },
            icon(matIcon(att), 34),
            h('div', h('b', { style: { color: ATTUNEMENTS[att].color } }, ATTUNEMENTS[att].name), h('div.faint', ATTUNEMENTS[att].desc)),
            h('span.bp-attune-n', `${fmtN(g.state.resources[att])} / ${ATTUNEMENTS[att].need}`))
        : h('div.bp-attune.off',
            h('div', h('b', 'No attunement'), h('div.faint', `Carry enough of one rare ore and it works on you on its own. ${ATTUNE_KEYS.filter(k => MATERIALS[k]).slice(0, 4).map(k => `${MATERIALS[k].name} ${ATTUNEMENTS[k].need}`).join(' · ')}…`)));
      return [
        h('div.faint', 'Everything you can forge with. Hover one to see what it does.'),
        attCard,
        h('div.bp-grid', ...cells, ...Array.from({ length: Math.max(0, 12 - cells.length) }, () => h('div.bp-cell.empty'))),
      ];
    };

    const content = t === 'char' ? charTab() : t === 'gear' ? gearTab() : t === 'tools' ? toolsTab() : t === 'items' ? itemsTab() : matsTab();
    body.replaceChildren(...content);

    // the bar along the bottom while you are picking things to sell
    const sellBar = (() => {
      if (!sell) return null;
      let total = 0, n = 0;
      for (const id of sell.gear) { const it = r.bag.find(x => x.id === id); if (it) { total += gearValue(it); n++; } }
      for (const [k, count] of sell.tools) { total += toolValue(k) * count; n += count; }
      return h('div.bp-sellbar',
        h('b', n ? `${n} thing${n === 1 ? '' : 's'} · ${total} gold` : 'Pick what you want to sell'),
        h('div.spacer'),
        h('button.btn.sm.ghost', { onclick: () => { hud._sell = null; render(); } }, 'Cancel'),
        h('button.btn.primary.sm', { disabled: !n, onclick: () => {
          let gold = 0;
          for (const id of [...sell.gear]) gold += scrapGear(g, id);
          for (const [k, count] of sell.tools) gold += sellTool(g, k, count);
          hud._sell = null;
          hud.hint(`Sold ${n} for ${gold} gold`, 2200);
          play('coin');
          refresh();
        } }, 'Sell them'));
    })();

    m.el.replaceChildren(m.closeBtn,
      h('div.bp-head',
        icon(hasArt('ui/inventory') ? 'ui/inventory' : 'ui/character', 30),
        h('div.bp-head-text', h('h2', 'Backpack'), h('div.faint', `Level ${r.level}${r.points ? ` · ${r.points} point${r.points === 1 ? '' : 's'} to spend` : ''}`)),
      ),
      h('div.bp-tabs', ...TABS.map(tb => h(`button.bp-tab${t === tb.key ? '.on' : ''}`, { onclick: () => { hud._bpTab = tb.key; play('click'); render(); } }, hasArt(tb.icon) ? icon(tb.icon, 18) : null, tb.name))),
      body,
      ...(sellBar ? [sellBar] : []));
  };
  render();
  return m;
}
