/*
 * The Admin panel: a window, not a takeover.
 *
 * The console is a command line — fine with a keyboard, miserable with thumbs. This is the same power laid out to
 * be tapped: a sidebar of sections down the left with who you are at the top, and a page on the right. Every list
 * has a search box, every argument that has a list behind it opens a grid of pictures, and numbers are steppers.
 *
 * It never does anything itself. Every action builds a command line and hands it to the console, so the panel and
 * the commands can never drift apart, and anything the console gains shows up here for free.
 *
 * It is deliberately a small floating window (and draggable on a computer) so you can watch the world while you
 * work on it, which is the whole point of an admin tool.
 */
import { h, icon, modal, avatar, toggleMenu } from './dom.js';
import { play } from '../core/sound.js';
import { CREATURES } from '../data/objects.js';
import { spriteAvailable } from '../core/assets.js';
import { pxIcon } from './pixelIcons.js';

/*
 * A tab's picture: the drawn sheet icon once it is in, the built-in glyph until then, so the panel is never
 * missing an icon while the art is being made.
 */
const navIcon = (key, glyph) => (spriteAvailable(`ui/ap_${key}`) ? icon(`ui/ap_${key}`, 24) : pxIcon(glyph, 22));


const nice = k => String(k).replace(/_/g, ' ').replace(/(^|\s)\w/g, m => m.toUpperCase());

// ------------------------------------------------------------------ the lists you can pick from

const creatureItems = () => Object.entries(CREATURES).filter(([, d]) => d.sprite)
  .sort((a, b) => (a[1].boss ? 1 : 0) - (b[1].boss ? 1 : 0) || (a[1].hp || 0) - (b[1].hp || 0))
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.sprite, tag: d.boss ? 'Boss' : d.hostile ? null : 'Tame' }));

const bossItems = () => Object.entries(CREATURES).filter(([, d]) => d.boss)
  .map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.sprite }));

const raceItems = async () => {
  const R = await import('../game/races.js');
  return R.RACE_KEYS.map(k => ({ key: k, name: R.RACES[k].name, art: `races/${R.RACES[k].looks[0]}`, tag: R.RACE_TIERS[R.RACES[k].tier].name }));
};
const oreItems = async () => {
  const A = await import('../game/attune.js');
  const F = await import('../game/forging.js');
  return A.ATTUNE_KEYS.map(k => ({ key: k, name: F.MATERIALS[k]?.name || nice(k), art: F.MATERIALS[k]?.icon }));
};
const resourceItems = async () => {
  const F = await import('../game/forging.js');
  const { HERO_RESOURCES } = await import('../core/constants.js');   // not the village game's food, weapons, bombs, science or influence
  return HERO_RESOURCES.map(k => ({ key: k, name: F.MATERIALS[k]?.name || nice(k), art: F.MATERIALS[k]?.icon }));
};
const gearItems = async () => {
  const R = await import('../game/rpg.js');
  // only what the forge can really make: the same rule the gear command uses (no bare fists, nothing without a picture)
  return Object.entries(R.CATALOG).flatMap(([slot, list]) => Object.entries(list)
    .filter(([, d]) => d.icon !== null && (!d.noLoot || d.admin))
    .map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.icon, tag: d.admin ? 'Admin' : nice(slot) })));
};
/*
 * Everybody you could pick, by their player name. The key is their account id, never a name: names used to be
 * village names ("Infinity's Hearth"), which a prank could not find on the island and which the command line split
 * in two at the space and the apostrophe - so trolls silently did nothing.
 */
const playerItems = async (panel, { me = false, all = false } = {}) => {
  const list = await panel.console.loadPlayers().catch(() => []);
  const mp = panel.console.mp || panel.console.hud?.mp;
  const here = new Set((panel.game.livePlayers || []).map(p => p.uid));
  const seen = new Map();
  for (const p of [...(list || []), ...(mp?.players || [])]) {
    if (!p?.uid || p.uid === mp?.uid || p.uid === panel.console.user?.uid) continue;
    const prev = seen.get(p.uid) || {};
    seen.set(p.uid, { ...prev, ...p, online: prev.online || p.online });
  }
  const rows = [...seen.values()].map(p => ({
    key: p.uid, name: p.name || 'Player', art: 'ui/character',
    tag: here.has(p.uid) ? 'here' : p.online ? 'online' : 'away',
  })).sort((a, b) => (a.tag === 'here' ? 0 : a.tag === 'online' ? 1 : 2) - (b.tag === 'here' ? 0 : b.tag === 'online' ? 1 : 2) || a.name.localeCompare(b.name));
  return [
    ...(me ? [{ key: 'me', name: 'Me', art: 'ui/character', tag: 'you' }] : []),
    ...(all ? [{ key: '*', name: 'Everyone', art: 'items/population', tag: 'all' }] : []),
    ...rows,
  ];
};


/** A grid of things to tap, with its own search. Resolves with a key, or null if closed. */
function pickFrom(title, items, { any = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = k => { if (done) return; done = true; m.close(); resolve(k); };
    const search = h('input.input', { placeholder: `Search ${title.toLowerCase()}…`, autocomplete: 'off' });
    const grid = h('div.ap-grid');
    const count = h('span.faint');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = items.filter(it => !q || it.name.toLowerCase().includes(q) || String(it.key).includes(q));
      count.textContent = `${list.length} of ${items.length}`;
      grid.replaceChildren(
        ...(any && !q ? [h('button.ap-cell.ap-any', { onclick: () => finish('*') }, h('b', '*'), h('span', 'Every one'))] : []),
        ...list.slice(0, 500).map(it => h('button.ap-cell', { title: it.key, onclick: () => finish(it.key) },
          it.art && spriteAvailable(it.art) ? icon(it.art, 34) : h('div.ap-noart', it.name.slice(0, 2)),
          h('span', it.name),
          it.tag ? h('i.ap-tag', it.tag) : null)),
      );
      if (!list.length) grid.replaceChildren(h('div.faint', 'Nothing matches that'));
    };
    search.addEventListener('input', draw);
    draw();
    const m = modal([h('div.ap-pick-head', h('h2', title), count), search, grid], { cls: 'ap-pick', closeX: true, onClose: () => finish(null) });
    setTimeout(() => search.focus(), 40);
  });
}

// ------------------------------------------------------------------ one command, as a row of controls

/** What you last set on each card, so pressing Run (which redraws the page) never throws your choices away. */
const cardValues = new WeakMap();
const cardLabels = new WeakMap();

function cardFor(panel, def) {
  if (!cardValues.has(def)) {
    const v = {};
    for (const a of def.args || []) v[a.id] = a.def ?? (a.kind === 'number' ? 1 : '');
    cardValues.set(def, v);
    cardLabels.set(def, {});
  }
  const values = cardValues.get(def), labels = cardLabels.get(def);
  const line = () => [def.cmd, ...(def.args || []).map(a => String(values[a.id] ?? '').trim()).filter(Boolean), def.tail].filter(Boolean).join(' ');   // tail: a fixed ending the card does not ask about
  const refresh = () => {};   // the card no longer prints its command line; the values are read when you press Run

  const control = a => {
    if (a.kind === 'number') {
      // the number is a box you can type in, with - and + either side for small nudges
      const clamp = n => Math.max(a.min ?? 0, Math.min(a.max ?? 9999, Math.round(Number(n) || 0)));
      const val = h('input.ap-num', { type: 'text', inputMode: 'numeric', value: String(values[a.id]), 'aria-label': a.name });
      val.addEventListener('focus', () => val.select());
      val.addEventListener('input', () => { val.value = val.value.replace(/[^0-9]/g, '').slice(0, 7); if (val.value !== '') values[a.id] = clamp(val.value); refresh(); });
      val.addEventListener('change', () => { values[a.id] = clamp(val.value); val.value = String(values[a.id]); refresh(); });
      val.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') val.blur(); });   // typing here never moves your hero
      const step = n => { values[a.id] = clamp((Number(values[a.id]) || 0) + n); val.value = String(values[a.id]); refresh(); };
      return h('div.ap-arg', h('span.ap-arg-name', a.name),
        h('div.ap-stepper', h('button', { onclick: () => step(-(a.big || 1)) }, '−'), val, h('button', { onclick: () => step(a.big || 1) }, '+')));
    }
    if (a.kind === 'choice') {
      const btns = a.options.map(o => h(`button.btn.sm${values[a.id] === o.key ? '.primary' : ''}${o.color ? '.ap-tinted' : ''}`, { style: o.color ? { '--tint': o.color } : {}, onclick: () => {
        values[a.id] = o.key;
        btns.forEach(b => b.classList.toggle('primary', b === btns[a.options.indexOf(o)]));
        refresh();
      } }, o.name));
      return h('div.ap-arg', h('span.ap-arg-name', a.name), h('div.ap-choices', ...btns));
    }
    // one chip: what is chosen, and tapping it opens the grid to choose again (no separate "Select" button)
    const val = h('span', values[a.id] ? (labels[a.id] || a.label || nice(values[a.id])) : `Choose ${a.name.toLowerCase()}`);
    return h('div.ap-arg', h('span.ap-arg-name', a.name),
      h(`button.ap-choose${values[a.id] ? '' : '.empty'}`, { onclick: async e => {
        const btn = e.currentTarget;
        const items = await a.items(panel);
        const k = await pickFrom(a.name, items, { any: a.any });
        if (k == null) return;
        values[a.id] = k;
        val.textContent = labels[a.id] = items.find(it => it.key === k)?.name || nice(k);
        btn.classList.remove('empty');
        play('click');
        refresh();
      } }, val, h('i.ap-choose-caret', '▾')));
  };

  refresh();
  return h('div.ap-card',
    h('div.ap-card-head', h('b', def.name), h('span.faint', def.desc)),
    (def.args || []).length ? h('div.ap-args', ...def.args.map(control)) : null,
    h('div.ap-run', h('div.spacer'), h('button.btn.primary', { onclick: () => panel.send(line()) }, def.runLabel || 'Run')));
}

// ------------------------------------------------------------------ the pages

const WHERE = [{ key: 'here', name: 'Here' }, { key: 'near', name: 'Near' }, { key: 'far', name: 'Far' }, { key: 'cursor', name: 'Cursor' }];

const PAGES = {
  home: { name: 'Home', icon: 'house' },
  players: { name: 'Players', icon: 'people' },
  spawn: { name: 'Spawn', icon: 'sword', cards: [
    { cmd: 'spawn', name: 'Spawn creatures', desc: 'Anything in the game, at any level', args: [
      { id: 'what', name: 'Creature', kind: 'pick', items: creatureItems },
      { id: 'count', name: 'How many', kind: 'number', def: 1, min: 1, max: 99 },
      { id: 'where', name: 'Where', kind: 'choice', options: WHERE, def: 'here' },
      { id: 'level', name: 'Level', kind: 'number', def: 1, min: 1, max: 99, big: 5 },
    ] },
    { cmd: 'rematch', name: 'Call out a boss', desc: 'Any boss, at any level', args: [
      { id: 'boss', name: 'Boss', kind: 'pick', items: bossItems },
      { id: 'level', name: 'Level', kind: 'number', def: 10, min: 1, max: 99, big: 5 },
    ] },
    { cmd: 'bossrush', name: 'Boss Rush', desc: 'A gauntlet on one clock', args: [
      { id: 'count', name: 'How many', kind: 'number', def: 5, min: 2, max: 20 },
      { id: 'level', name: 'Level', kind: 'number', def: 20, min: 1, max: 99, big: 5 },
    ] },
    { cmd: 'kill', name: 'Clear the area', desc: 'Slay everything hostile around you', args: [
      { id: 'tiles', name: 'How far', kind: 'number', def: 14, min: 2, max: 60, big: 5 },
    ] },
  ] },
  items: { name: 'Items', icon: 'box', cards: [
    { cmd: 'give', name: 'Give resources', desc: 'To you, to anyone, or to everyone', args: [
      { id: 'who', name: 'Who', kind: 'pick', def: 'me', label: 'Me', items: panel => playerItems(panel, { me: true, all: true }) },
      { id: 'what', name: 'Resource', kind: 'pick', any: true, items: resourceItems },
      { id: 'n', name: 'How many', kind: 'number', def: 100, min: 1, max: 9999, big: 100 },
    ] },
    { cmd: 'gear', name: 'Forge gear', desc: 'A weapon or a piece of armour, Legendary', tail: 'legendary', args: [
      { id: 'what', name: 'Piece', kind: 'pick', items: gearItems },
    ] },
    { cmd: 'attune', name: 'Attune to an ore', desc: 'Gives you enough of it to work', args: [
      { id: 'ore', name: 'Ore', kind: 'pick', items: oreItems },
    ] },
    { cmd: 'potions', name: 'Potions', desc: 'Fill your belt', args: [{ id: 'n', name: 'How many', kind: 'number', def: 10, min: 1, max: 99, big: 5 }] },
  ] },
  character: { name: 'Character', icon: 'person', cards: [
    { cmd: 'race', name: 'Become a race', desc: 'Change what you were born as', args: [{ id: 'race', name: 'Race', kind: 'pick', items: raceItems }] },
    { cmd: 'stones', name: 'Race Stones', desc: 'For the wheel in Races', args: [{ id: 'n', name: 'How many', kind: 'number', def: 5, min: 1, max: 99, big: 5 }] },
    { cmd: 'roll', name: 'Roll the wheel', desc: 'Spend stones without opening the screen', args: [{ id: 'n', name: 'How many times', kind: 'number', def: 1, min: 1, max: 50, big: 5 }] },
    { cmd: 'level', name: 'Set your level', desc: 'Points come with it', args: [{ id: 'n', name: 'Level', kind: 'number', def: 10, min: 1, max: 99, big: 5 }] },
  ] },
  world: { name: 'World', icon: 'globe', cards: [
    { cmd: 'time', name: 'Time of day', desc: 'Set the hour', args: [{ id: 'hour', name: 'Hour', kind: 'number', def: 12, min: 0, max: 23 }] },
    { cmd: 'dungeon', name: 'Go down', desc: 'Straight to any floor', args: [{ id: 'floor', name: 'Floor', kind: 'number', def: 1, min: 1, max: 99, big: 5 }] },
    { cmd: 'era', name: 'Era', desc: 'Move the age of the world', args: [{ id: 'n', name: 'Era', kind: 'number', def: 1, min: 0, max: 6 }] },
    { cmd: 'speed', name: 'Game speed', desc: 'How fast time runs', args: [{ id: 'x', name: 'Times', kind: 'number', def: 1, min: 1, max: 10 }] },
  ] },
  troll: { name: 'Troll', icon: 'devil' },
  doctor: { name: 'Doctor', icon: 'flask' },
  logs: { name: 'Logs', icon: 'scroll' },
};

/** The things you reach for most, as cards like everything else rather than a strip of chips. */
const HOME_CARDS = [
  { cmd: 'god', name: 'God mode', desc: 'Nothing can hurt you', runLabel: 'Toggle' },
  { cmd: 'heal', name: 'Full health', desc: 'Back to the top of the bar', runLabel: 'Heal' },
  { cmd: 'kill', name: 'Clear the area', desc: 'Everything hostile around you', args: [
    { id: 'tiles', name: 'How far', kind: 'number', def: 14, min: 2, max: 60, big: 5 },
  ] },
  { cmd: 'time', name: 'Time of day', desc: 'Set the hour', args: [
    { id: 'hour', name: 'Hour', kind: 'number', def: 12, min: 0, max: 23 },
  ] },
  { cmd: 'potions', name: 'Potions', desc: 'Fill your belt', args: [
    { id: 'n', name: 'How many', kind: 'number', def: 10, min: 1, max: 99, big: 5 },
  ] },
  { cmd: 'stones', name: 'Race Stones', desc: 'For the wheel in Races', args: [
    { id: 'n', name: 'How many', kind: 'number', def: 5, min: 1, max: 99, big: 5 },
  ] },
];

/** Every prank, as a button. They all go through `troll <player> <prank>`. */
const PRANKS = [
  ['spook', 'Spook', 'A fright and a noise'],
  ['freeze', 'Freeze', 'Rooted to the spot'],
  ['launch', 'Launch', 'Sent flying'],
  ['boom', 'Boom', 'An explosion at their feet'],
  ['tiny', 'Tiny', 'Shrink them'],
  ['huge', 'Huge', 'Make them enormous'],
  ['drunk', 'Dizzy', 'The world spins'],
  ['blind', 'Blind', 'Lights out'],
  ['confetti', 'Confetti', 'A shower of colour'],
  ['shake', 'Earthquake', 'Shake their screen'],
  ['dance', 'Dance', 'They cannot keep still'],
  ['strip', 'Disarm', 'Gear into their bag'],
  ['mobs', 'Zombies', 'A ring of them'],
  ['bring', 'Bring here', 'Pull them to you'],
  ['goto', 'Go to them', 'Stand where they are'],
  ['swap', 'Swap places', 'You there, them here'],
  ['heal', 'Heal', 'Be nice for once'],
  ['gift', 'Gift gold', '100 gold'],
];

export function openAdminPanel(hud, adminConsole) {
  if (toggleMenu('admin-panel', { sameView: true })) return null;
  const con = adminConsole || window.__hbConsole;
  if (!con) { hud.hint('The console is not loaded', 1800); return null; }
  const g = hud.game;
  let page = 'home';
  let msgTo = null;   // null: everyone (a global banner); otherwise { uid, name }
  let trollWho = null, trollName = '';   // the account id the pranks go to, and the name it shows as

  const logRows = [];
  const panel = {
    console: con,
    game: g,
    async send(line) {
      const row = { line, state: 'run', note: '' };
      logRows.unshift(row);
      if (logRows.length > 40) logRows.length = 40;
      try { await con.run(line); row.state = 'ok'; play('click'); }
      catch (e) { row.state = 'bad'; row.note = e.message; }
      render();
    },
  };

  // ---------------------------------------------------------------- pages
  const cardsPage = key => h('div.ap-cards', ...PAGES[key].cards.map(def => cardFor(panel, def)));

  const homePage = () => {
    const facts = [
      ['World', hud.world?.name || g.state.worldName || 'Solo'],
      ['Players here', String((g.livePlayers || []).length + 1)],
      ['Creatures', String(g.state.creatures.length)],
      ['Your level', String(g.state.rpg?.level || 1)],
      ['Day', String(g.day ?? 1)],
      ['Version', window.__hbVersion || 'dev'],
    ];
    return h('div.ap-page',
      h('div.ap-facts', ...facts.map(([k, v]) => h('div.ap-fact', h('span.faint', k), h('b', v)))),
      h('div.ap-cards', ...HOME_CARDS.map(def => cardFor(panel, def))));
  };

  const playersPage = () => {
    const box = h('div.ap-list');
    const search = h('input.input', { placeholder: 'Search players…', autocomplete: 'off' });
    const draw = list => {
      const q = search.value.trim().toLowerCase();
      const rows = list.filter(p => !q || (p.name || '').toLowerCase().includes(q));
      box.replaceChildren(...(rows.length ? rows.map(p => h('div.ap-row',
        avatar(p.name || '?', 30),
        h('div.ap-row-text', h('b', p.name || 'Player'), h('span.faint', p.online ? 'online' : 'offline')),
        h('div.ap-row-acts',
          h('button.btn.sm', { onclick: () => panel.send(`tp ${p.name}`) }, 'Go to'),
          h('button.btn.sm', { onclick: () => panel.send(`tp ${p.name} here`) }, 'Bring'),
          h('button.btn.sm', { onclick: () => { msgTo = { uid: p.uid, name: p.name || 'Player' }; render(); } }, 'Message'),
          h('button.btn.sm.ghost', { onclick: () => { trollWho = p.uid; trollName = p.name || 'Player'; page = 'troll'; render(); } }, 'Troll'),
          h('button.btn.sm.danger', { onclick: () => panel.send(`ban ${p.name}`) }, 'Ban')))) : [h('div.faint', 'Nobody matches that')]));
    };
    search.addEventListener('input', () => con.loadPlayers().then(draw).catch(() => draw([])));
    box.append(h('div.faint', 'Loading…'));
    con.loadPlayers().then(draw).catch(() => draw([]));
    return h('div.ap-page', messageCard(), search, box);
  };

  /** One box for talking to people: everyone at once as a banner, or a single player. */
  const messageCard = () => {
    const text = h('input.input', { placeholder: msgTo ? `Message ${msgTo.name}…` : 'Message everyone…', maxLength: 160 });
    const send = () => {
      const t = text.value.trim();
      if (!t) return;
      panel.send(msgTo ? `msg ${msgTo.uid} ${t}` : `broadcast ${t}`);
      text.value = '';
    };
    text.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') send(); });
    return h('div.ap-card.ap-msg',
      h('div.ap-card-head', h('b', 'Send a message'), h('span.faint', msgTo ? `Only ${msgTo.name} sees it` : 'A banner on every player’s screen')),
      h('div.ap-arg', h('span.ap-arg-name', 'To'),
        h('div.ap-choices',
          h(`button.btn.sm${msgTo ? '' : '.primary'}`, { onclick: () => { msgTo = null; render(); } }, 'Everyone'),
          h(`button.btn.sm${msgTo ? '.primary' : ''}`, { onclick: async () => {
            const items = await playerItems(panel);
            const k = await pickFrom('Player', items);
            if (k == null) return;
            msgTo = { uid: k, name: items.find(it => it.key === k)?.name || 'Player' }; render();
          } }, msgTo ? msgTo.name : 'One player'))),
      h('div.ap-run', text, h('button.btn.primary', { onclick: send }, 'Send')));
  };

  const trollPage = () => {
    const who = h('div.ap-arg', h('span.ap-arg-name', 'Who'),
      h(`button.ap-choose${trollWho ? '' : '.empty'}`, { onclick: async () => {
        const items = await playerItems(panel);
        const k = await pickFrom('Player', items);
        if (k == null) return;
        trollWho = k; trollName = items.find(it => it.key === k)?.name || 'Player'; play('click'); render();
      } }, h('span', trollWho ? trollName : 'Choose a player'), h('i.ap-choose-caret', '▾')));
    const search = h('input.input', { placeholder: 'Search pranks…', autocomplete: 'off' });
    const grid = h('div.ap-pranks');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = PRANKS.filter(([k, n, d]) => !q || n.toLowerCase().includes(q) || k.includes(q) || d.toLowerCase().includes(q));
      grid.replaceChildren(...list.map(([k, n, d]) => h('button.ap-prank', {
        disabled: !trollWho,
        title: trollWho ? `${n} on ${trollName}` : 'Pick somebody first',
        onclick: () => panel.send(`troll ${trollWho} ${k}`),
      }, h('b', n), h('span', d))));
    };
    search.addEventListener('input', draw);
    draw();
    return h('div.ap-page', who, search,
      trollWho ? null : h('div.faint', 'Pick somebody and every prank below turns on.'),
      grid,
      h('div.ap-card',
        h('div.ap-card-head', h('b', 'Say something as the world'), h('span.faint', 'It appears on their screen')),
        (() => {
          const text = h('input.input', { placeholder: 'You hear a voice…' });
          return h('div.ap-run', text, h('button.btn.primary', { onclick: () => { if (trollWho && text.value.trim()) panel.send(`troll ${trollWho} say ${text.value.trim()}`); } }, 'Send'));
        })()));
  };

  const doctorPage = () => {
    const out = h('div.ap-doctor');
    const run = async () => {
      out.replaceChildren(h('div.faint', 'Checking everything…'));
      const rows = [];
      const print = con.print.bind(con);
      con.print = (text, kind) => { rows.push([kind, text]); };   // catch what the doctor says instead of printing it
      try { await con.run('doctor'); } catch (e) { rows.push(['err', e.message]); }
      con.print = print;
      // the console already marks each line: a tick, a dot for a plain fact, ! for something worth a look, X for broken
      out.replaceChildren(...rows.filter(r => !String(r[1]).startsWith('—')).map(([, text]) => {
        const t = String(text);
        const mark = t[0];
        const cls = mark === '✓' ? 'ok' : mark === '✗' ? 'bad' : mark === '!' ? 'warn' : 'info';
        return h(`div.ap-doc-row.${cls}`, h('i', mark === '·' ? '·' : mark), h('span', t.replace(/^[✓✗!·]\s*/, '')));
      }));
    };
    run();
    return h('div.ap-page',
      h('div.ap-row', h('div.ap-row-text', h('b', 'Doctor'), h('span.faint', 'Checks the art, your character, the systems, this world and the network')),
        h('button.btn.sm.primary', { onclick: run }, 'Check again')),
      out);
  };

  const logsPage = () => {
    const search = h('input.input', { placeholder: 'Search what you have run…', autocomplete: 'off' });
    const box = h('div.ap-list');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const rows = logRows.filter(r => !q || r.line.toLowerCase().includes(q));
      box.replaceChildren(...(rows.length ? rows.map(r => h(`div.ap-log-row.${r.state}`,
        h('code', r.line),
        h('span.faint', r.state === 'ok' ? 'done' : r.state === 'bad' ? r.note : 'running…'),
        h('button.btn.sm.ghost', { onclick: () => panel.send(r.line) }, 'Again'))) : [h('div.faint', 'Nothing yet')]));
    };
    search.addEventListener('input', draw);
    draw();
    return h('div.ap-page', search, box);
  };

  // ---------------------------------------------------------------- the window
  const body = h('div.ap-body');
  const nav = h('div.ap-nav');
  const navSearch = h('input.input.ap-nav-search', { placeholder: 'Search…', autocomplete: 'off' });
  // searching the sidebar jumps to the page that has what you typed
  navSearch.addEventListener('input', () => {
    const q = navSearch.value.trim().toLowerCase();
    if (!q) return;
    for (const [key, p] of Object.entries(PAGES)) {
      if (p.name.toLowerCase().includes(q) || (p.cards || []).some(c => c.name.toLowerCase().includes(q) || c.cmd.includes(q))) {
        if (page !== key) { page = key; render(true); }
        return;
      }
    }
  });

  const render = (keepSearch = false) => {
    nav.replaceChildren(...Object.entries(PAGES).map(([key, p]) => h(`button.ap-nav-item${page === key ? '.on' : ''}`,
      { title: p.name, onclick: () => { page = key; play('click'); render(); } }, navIcon(key, p.icon), h('span', p.name))));
    const content = page === 'home' ? homePage()
      : page === 'players' ? playersPage()
        : page === 'troll' ? trollPage()
          : page === 'doctor' ? doctorPage()
            : page === 'logs' ? logsPage()
              : cardsPage(page);
    body.replaceChildren(h('div.ap-page-head', h('h2', PAGES[page].name), h('div.spacer'),
      h('button.btn.sm.ghost', { onclick: () => { m.close(); con.toggle(); } }, 'Command line')), content);
    if (!keepSearch) navSearch.value = '';
  };

  // a real title bar across the whole top: something to grab, and a finished edge above the sidebar
  const bar = h('div.ap-bar',
    avatar(hud.username || 'Admin', 26),
    h('div.ap-bar-who', h('b', hud.username || 'Admin'), h('span.ap-rank', 'Admin')),
    h('div.spacer'));
  const side = h('div.ap-side', navSearch, nav);
  const m = modal([h('div.ap-frame', bar, h('div.ap-window', side, body))], { cls: 'admin-panel', closeX: true });
  render();

  /*
   * A real window: it never dims the world behind it, and you can pick it up by its header and put it anywhere,
   * with a finger or a mouse. Where you leave it is where it opens next time.
   */
  m.el.closest('.modal-bg')?.classList.add('no-dim');
  const head = m.el.querySelector('.ap-bar');
  head.style.touchAction = 'none';
  const place = (x, y) => {
    const b = m.el.getBoundingClientRect();
    const nx = Math.max(4, Math.min(window.innerWidth - b.width - 4, x));
    const ny = Math.max(4, Math.min(window.innerHeight - b.height - 4, y));
    Object.assign(m.el.style, { position: 'fixed', margin: '0', left: `${nx}px`, top: `${ny}px` });
    try { localStorage.setItem('hb-admin-pos', JSON.stringify({ x: nx, y: ny })); } catch { /* private window */ }
  };
  try {
    const saved = JSON.parse(localStorage.getItem('hb-admin-pos') || 'null');
    if (saved) requestAnimationFrame(() => place(saved.x, saved.y));
  } catch { /* nothing saved */ }
  let drag = null;
  head.addEventListener('pointerdown', e => {
    const b = m.el.getBoundingClientRect();
    drag = { dx: e.clientX - b.left, dy: e.clientY - b.top, id: e.pointerId };
    head.style.cursor = 'grabbing';
    try { head.setPointerCapture?.(e.pointerId); } catch { /* the window listeners cover it */ }
    e.preventDefault();
  });
  const onMove = e => { if (drag && e.pointerId === drag.id) place(e.clientX - drag.dx, e.clientY - drag.dy); };
  const onUp = e => { if (drag && e.pointerId === drag.id) { drag = null; head.style.cursor = 'grab'; } };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const origClose = m.close;
  m.close = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); origClose(); };
  return m;
}
