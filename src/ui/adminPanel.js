/*
 * The admin panel for thumbs.
 *
 * The console is a command line, which is fine with a keyboard and miserable on a phone. This is the same power
 * without typing: every command is a card, and every argument that has a list behind it — creatures, bosses, items,
 * races, ores, players — is a Select button that opens a grid of pictures to tap. Numbers are steppers. Nothing
 * here knows how to do anything itself; it builds a command line and hands it to the console, so the two can never
 * drift apart.
 */
import { h, icon, modal, closeIfOpen } from './dom.js';
import { play } from '../core/sound.js';
import { CREATURES } from '../data/objects.js';
import { spriteAvailable } from '../core/assets.js';

const nice = k => k.replace(/_/g, ' ').replace(/(^|\s)\w/g, m => m.toUpperCase());

/** A grid of things to tap. `items` are { key, name, art }. Resolves with a key, or null if closed. */
function pickFrom(title, items, { extra = [] } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = k => { if (done) return; done = true; m.close(); resolve(k); };
    const search = h('input.input', { placeholder: 'Search…', autocomplete: 'off' });
    const grid = h('div.ap-grid');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = items.filter(it => !q || it.name.toLowerCase().includes(q) || it.key.includes(q));
      grid.replaceChildren(
        ...extra.filter(e => !q || e.name.toLowerCase().includes(q)).map(e => h('button.ap-cell.ap-any', { onclick: () => finish(e.key) }, h('b', e.key), h('span', e.name))),
        ...list.slice(0, 400).map(it => h('button.ap-cell', { onclick: () => finish(it.key) },
          it.art && spriteAvailable(it.art) ? icon(it.art, 34) : h('div.ap-noart', it.name.slice(0, 2)),
          h('span', it.name))),
      );
      if (!list.length && !extra.length) grid.replaceChildren(h('div.faint', 'Nothing matches that'));
    };
    search.addEventListener('input', draw);
    draw();
    const m = modal([h('h2', title), search, grid], { cls: 'ap-pick', closeX: true, onClose: () => finish(null) });
    setTimeout(() => search.focus(), 40);
  });
}

const creatureItems = () => Object.entries(CREATURES).filter(([, d]) => d.sprite)
  .sort((a, b) => (a[1].boss ? 1 : 0) - (b[1].boss ? 1 : 0) || (a[1].hp || 0) - (b[1].hp || 0))
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.sprite }));

const bossItems = () => Object.entries(CREATURES).filter(([, d]) => d.boss)
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.sprite }));

/**
 * One command, as a card. `args` describe what it takes; the panel turns them into buttons and steppers and
 * assembles the line when you press Run.
 */
function cardFor(panel, def) {
  const values = {};
  for (const a of def.args) values[a.id] = a.def ?? (a.kind === 'number' ? 1 : '');
  const out = h('code.ap-line');
  const line = () => [def.cmd, ...def.args.map(a => String(values[a.id] ?? '').trim()).filter(Boolean)].join(' ');
  const refresh = () => { out.textContent = line(); };

  const control = a => {
    if (a.kind === 'number') {
      const val = h('b.ap-num', String(values[a.id]));
      const step = n => { values[a.id] = Math.max(a.min ?? 0, Math.min(a.max ?? 999, (Number(values[a.id]) || 0) + n)); val.textContent = String(values[a.id]); refresh(); };
      return h('div.ap-arg', h('span.ap-arg-name', a.name),
        h('div.ap-stepper',
          h('button', { onclick: () => step(-(a.big || 1)) }, '−'),
          val,
          h('button', { onclick: () => step(a.big || 1) }, '+')));
    }
    if (a.kind === 'choice') {
      const val = h('b.ap-choice', String(values[a.id] || a.options[0]));
      return h('div.ap-arg', h('span.ap-arg-name', a.name),
        h('div.ap-choices', ...a.options.map(o => h(`button.btn.sm${values[a.id] === o ? '.primary' : ''}`, { onclick: e => {
          values[a.id] = o;
          val.textContent = o;
          [...e.target.parentElement.children].forEach(b => b.classList.toggle('primary', b.textContent === o));
          refresh();
        } }, o))));
    }
    // a list you pick from: a Select button that opens a grid of pictures
    const val = h('b.ap-picked', values[a.id] ? nice(values[a.id]) : 'nothing yet');
    return h('div.ap-arg', h('span.ap-arg-name', a.name), val,
      h('button.btn.sm.primary', { onclick: async () => {
        const items = await a.items(panel);
        const k = await pickFrom(a.name, items, { extra: a.any ? [{ key: '*', name: 'Every one of them' }] : [] });
        if (k == null) return;
        values[a.id] = k;
        val.textContent = nice(k);
        play('click');
        refresh();
      } }, 'Select'));
  };

  refresh();
  return h('div.ap-card',
    h('div.ap-card-head', h('b', def.name), h('span.faint', def.desc)),
    h('div.ap-args', ...def.args.map(control)),
    h('div.ap-run', out, h('div.spacer'), h('button.btn.primary', { onclick: () => panel.send(line()) }, 'Run')));
}

/** Everything the panel offers, in the order an admin usually wants it. */
const CARDS = [
  { cmd: 'spawn', name: 'Spawn', desc: 'Put creatures in the world', args: [
    { id: 'what', name: 'Creature', kind: 'pick', items: creatureItems },
    { id: 'count', name: 'How many', kind: 'number', def: 1, min: 1, max: 99 },
    { id: 'where', name: 'Where', kind: 'choice', options: ['here', 'near', 'far', 'cursor'], def: 'here' },
    { id: 'level', name: 'Level', kind: 'number', def: 1, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'rematch', name: 'Call out a boss', desc: 'One you have already felled, at any level', args: [
    { id: 'boss', name: 'Boss', kind: 'pick', items: bossItems },
    { id: 'level', name: 'Level', kind: 'number', def: 10, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'bossrush', name: 'Boss Rush', desc: 'A gauntlet of bosses on one clock', args: [
    { id: 'count', name: 'How many', kind: 'number', def: 5, min: 2, max: 20 },
    { id: 'level', name: 'Level', kind: 'number', def: 20, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'race', name: 'Become a race', desc: 'Change what you were born as', args: [
    { id: 'race', name: 'Race', kind: 'pick', items: async () => {
      const R = await import('../game/races.js');
      return R.RACE_KEYS.map(k => ({ key: k, name: R.RACES[k].name, art: `races/${R.RACES[k].looks[0]}` }));
    } },
  ] },
  { cmd: 'stones', name: 'Race Stones', desc: 'Give yourself stones for the wheel', args: [
    { id: 'n', name: 'How many', kind: 'number', def: 5, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'attune', name: 'Attune', desc: 'Give yourself enough of an ore to attune', args: [
    { id: 'ore', name: 'Ore', kind: 'pick', items: async () => {
      const A = await import('../game/attune.js');
      const F = await import('../game/forging.js');
      return A.ATTUNE_KEYS.map(k => ({ key: k, name: F.MATERIALS[k]?.name || nice(k), art: F.MATERIALS[k]?.icon }));
    } },
  ] },
  { cmd: 'give me', name: 'Give', desc: 'Resources, materials and ores', args: [
    { id: 'what', name: 'Resource', kind: 'pick', any: true, items: async () => {
      const F = await import('../game/forging.js');
      const { RESOURCES } = await import('../core/constants.js');
      return RESOURCES.map(k => ({ key: k, name: F.MATERIALS[k]?.name || nice(k), art: F.MATERIALS[k]?.icon }));
    } },
    { id: 'n', name: 'How many', kind: 'number', def: 100, min: 1, max: 9999, big: 100 },
  ] },
  { cmd: 'gear', name: 'Gear', desc: 'Forge yourself a weapon or armour', args: [
    { id: 'what', name: 'Piece', kind: 'pick', items: async () => {
      const R = await import('../game/rpg.js');
      return Object.entries(R.CATALOG).flatMap(([slot, list]) => Object.entries(list).map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.icon || `gear/${slot}` })));
    } },
    { id: 'rarity', name: 'Rarity', kind: 'number', def: 3, min: 0, max: 5 },
  ] },
  { cmd: 'time', name: 'Time of day', desc: 'Set the hour', args: [
    { id: 'hour', name: 'Hour', kind: 'number', def: 12, min: 0, max: 23 },
  ] },
  { cmd: 'level', name: 'Level', desc: 'Set your level', args: [
    { id: 'n', name: 'Level', kind: 'number', def: 10, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'dungeon', name: 'Dungeon', desc: 'Go straight down to a floor', args: [
    { id: 'floor', name: 'Floor', kind: 'number', def: 1, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'tp', name: 'Teleport', desc: 'To a player, or bring them to you', args: [
    { id: 'who', name: 'Player', kind: 'pick', items: async panel => {
      const list = await panel.console.loadPlayers().catch(() => []);
      return (list || []).map(p => ({ key: p.name || p.villageName || p.uid, name: p.name || p.villageName || 'Player', art: 'ui/character' }));
    } },
    { id: 'how', name: 'Which way', kind: 'choice', options: ['', 'here'], def: '' },
  ] },
];

/** Buttons that take nothing at all. */
const QUICK = [
  ['god', 'God mode'], ['heal', 'Full health'], ['kill 14', 'Clear the area'],
  ['time 12', 'Midday'], ['time 0', 'Midnight'], ['bosses *', 'Fill the Hall'], ['index *', 'Fill the Index'],
  ['potions 10', '10 potions'], ['stones 5', '5 Race Stones'],
];

export function openAdminPanel(hud, adminConsole) {
  if (closeIfOpen('admin-panel')) return null;
  const con = adminConsole || window.__hbConsole;
  if (!con) { hud.hint('The console is not loaded', 1800); return null; }
  const log = h('div.ap-log');
  const panel = {
    console: con,
    async send(line) {
      log.prepend(h('div.ap-log-line', h('b', `> ${line}`)));
      try {
        await con.run(line);
        log.firstChild.append(h('span.ap-ok', ' done'));
        play('click');
      } catch (e) {
        log.firstChild.append(h('span.ap-bad', ` ${e.message}`));
      }
      while (log.children.length > 8) log.lastChild.remove();
    },
  };
  const m = modal([
    h('div.ap-head', h('h2', 'Admin'), h('span.faint', 'Tap instead of typing'), h('div.spacer'),
      h('button.btn.sm.ghost', { onclick: () => { m.close(); con.toggle(); } }, 'Command line')),
    h('div.ap-quick', ...QUICK.map(([line, label]) => h('button.btn.sm', { onclick: () => panel.send(line) }, label))),
    log,
    h('div.ap-cards', ...CARDS.map(def => cardFor(panel, def))),
  ], { cls: 'admin-panel', closeX: true });
  return m;
}
