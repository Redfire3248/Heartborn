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
import { h, icon, modal, closeIfOpen, avatar, toggleMenu } from './dom.js';
import { play } from '../core/sound.js';
import { CREATURES } from '../data/objects.js';
import { spriteAvailable } from '../core/assets.js';
import { pxIcon } from './pixelIcons.js';

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
  const { RESOURCES } = await import('../core/constants.js');
  return RESOURCES.map(k => ({ key: k, name: F.MATERIALS[k]?.name || nice(k), art: F.MATERIALS[k]?.icon }));
};
const gearItems = async () => {
  const R = await import('../game/rpg.js');
  return Object.entries(R.CATALOG).flatMap(([slot, list]) => Object.entries(list).map(([k, d]) => ({ key: k, name: d.name || nice(k), art: d.icon, tag: nice(slot) })));
};
const playerItems = async panel => {
  const list = await panel.console.loadPlayers().catch(() => []);
  const live = new Set((panel.game.livePlayers || []).map(p => p.name));
  return (list || []).map(p => ({ key: p.name || p.uid, name: p.name || 'Player', art: 'ui/character', tag: live.has(p.name) ? 'here' : p.online ? 'online' : 'away' }));
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

function cardFor(panel, def) {
  const values = {};
  for (const a of def.args || []) values[a.id] = a.def ?? (a.kind === 'number' ? 1 : '');
  const out = h('code.ap-line');
  const line = () => [def.cmd, ...(def.args || []).map(a => String(values[a.id] ?? '').trim()).filter(Boolean)].join(' ');
  const refresh = () => { out.textContent = line(); };

  const control = a => {
    if (a.kind === 'number') {
      const val = h('b.ap-num', String(values[a.id]));
      const step = n => { values[a.id] = Math.max(a.min ?? 0, Math.min(a.max ?? 9999, (Number(values[a.id]) || 0) + n)); val.textContent = String(values[a.id]); refresh(); };
      return h('div.ap-arg', h('span.ap-arg-name', a.name),
        h('div.ap-stepper', h('button', { onclick: () => step(-(a.big || 1)) }, '−'), val, h('button', { onclick: () => step(a.big || 1) }, '+')));
    }
    if (a.kind === 'choice') {
      const btns = a.options.map(o => h(`button.btn.sm${values[a.id] === o.key ? '.primary' : ''}`, { onclick: () => {
        values[a.id] = o.key;
        btns.forEach(b => b.classList.toggle('primary', b === btns[a.options.indexOf(o)]));
        refresh();
      } }, o.name));
      return h('div.ap-arg', h('span.ap-arg-name', a.name), h('div.ap-choices', ...btns));
    }
    const val = h('b.ap-picked', values[a.id] ? nice(values[a.id]) : '—');
    return h('div.ap-arg', h('span.ap-arg-name', a.name), val,
      h('button.btn.sm.primary', { onclick: async () => {
        const k = await pickFrom(a.name, await a.items(panel), { any: a.any });
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
    (def.args || []).length ? h('div.ap-args', ...def.args.map(control)) : null,
    h('div.ap-run', out, h('div.spacer'), h('button.btn.primary', { onclick: () => panel.send(line()) }, def.runLabel || 'Run')));
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
    { cmd: 'rematch', name: 'Call out a boss', desc: 'One you have already felled', args: [
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
    { cmd: 'give me', name: 'Give resources', desc: 'Anything in your bag, or all of it', args: [
      { id: 'what', name: 'Resource', kind: 'pick', any: true, items: resourceItems },
      { id: 'n', name: 'How many', kind: 'number', def: 100, min: 1, max: 9999, big: 100 },
    ] },
    { cmd: 'gear', name: 'Forge gear', desc: 'A weapon or a piece of armour', args: [
      { id: 'what', name: 'Piece', kind: 'pick', items: gearItems },
      { id: 'rarity', name: 'Rarity', kind: 'number', def: 3, min: 0, max: 5 },
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
  let trollWho = null;

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
    const quick = [
      ['god', 'God mode'], ['heal', 'Full health'], ['kill 14', 'Clear the area'],
      ['time 12', 'Midday'], ['time 0', 'Midnight'],
      ['potions 10', '10 potions'], ['stones 5', '5 Race Stones'],
      ['bosses *', 'Fill the Hall'], ['index *', 'Fill the Index'],
      ['map reveal', 'Reveal the map'],
    ];
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
      h('h3', 'Quick actions'),
      h('div.ap-quick', ...quick.map(([line, label]) => h('button.btn.sm', { onclick: () => panel.send(line) }, label))));
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
          h('button.btn.sm.ghost', { onclick: () => { trollWho = p.name; page = 'troll'; render(); } }, 'Troll'),
          h('button.btn.sm.danger', { onclick: () => panel.send(`ban ${p.name}`) }, 'Ban')))) : [h('div.faint', 'Nobody matches that')]));
    };
    search.addEventListener('input', () => con.loadPlayers().then(draw).catch(() => draw([])));
    box.append(h('div.faint', 'Loading…'));
    con.loadPlayers().then(draw).catch(() => draw([]));
    return h('div.ap-page', search, box);
  };

  const trollPage = () => {
    const who = h('div.ap-arg', h('span.ap-arg-name', 'Who'), h('b.ap-picked', trollWho ? nice(trollWho) : '—'),
      h('button.btn.sm.primary', { onclick: async () => {
        const k = await pickFrom('Player', await playerItems(panel));
        if (k == null) return;
        trollWho = k; play('click'); render();
      } }, 'Select'));
    const search = h('input.input', { placeholder: 'Search pranks…', autocomplete: 'off' });
    const grid = h('div.ap-pranks');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = PRANKS.filter(([k, n, d]) => !q || n.toLowerCase().includes(q) || k.includes(q) || d.toLowerCase().includes(q));
      grid.replaceChildren(...list.map(([k, n, d]) => h('button.ap-prank', {
        disabled: !trollWho,
        title: trollWho ? `${n} on ${trollWho}` : 'Pick somebody first',
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
      { onclick: () => { page = key; play('click'); render(); } }, pxIcon(p.icon, 16), h('span', p.name))));
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

  const side = h('div.ap-side',
    h('div.ap-me', avatar(hud.username || 'Admin', 34),
      h('div', h('b', hud.username || 'Admin'), h('div.ap-rank', 'Admin'))),
    navSearch, nav);
  const m = modal([h('div.ap-window', side, body)], { cls: 'admin-panel', closeX: true });
  render();

  // a window you can move out of the way on a computer
  const head = m.el.querySelector('.ap-me');
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (matchMedia('(pointer: coarse)').matches) return;
    const b = m.el.getBoundingClientRect();
    drag = { dx: e.clientX - b.left, dy: e.clientY - b.top };
    m.el.style.position = 'fixed';
    m.el.style.margin = '0';
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    m.el.style.left = `${Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.dx))}px`;
    m.el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.dy))}px`;
  });
  window.addEventListener('pointerup', () => { drag = null; });
  return m;
}
