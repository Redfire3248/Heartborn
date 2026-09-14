import { h } from './dom.js';
import { EVENTS } from '../data/events.js';
import { CREATURES } from '../data/objects.js';
import { ERAS } from '../data/buildings.js';
import { LAW_CATEGORIES } from '../data/laws.js';
import { DAY_LENGTH, RESOURCES } from '../core/constants.js';
import * as api from '../net/admin.js';
import { BUILDINGS as BUILDING_DEFS } from '../data/buildings.js';
import { BUILD, checkLatest } from '../core/version.js';
import { CHANGELOG } from '../data/changelog.js';
import { empireOf, empirePower, empireTitle, empireEvent, dailyEmpire } from '../game/empire.js';
import { ITEMS, CALLINGS } from '../data/people.js';
import { TRAITS } from '../data/traits.js';
import { JOBS, assignJob } from '../game/villagers.js';
import { addItem } from '../game/dynasty.js';

const BUILDINGS = BUILDING_DEFS;

const HISTORY_KEY = 'hb_admin_history';

/*
 * Drop-down admin command line (F2) with live autocomplete. Commands that target "me"
 * act on your own village instantly; commands that target another player are
 * delivered through the Realtime Database the next time they are online.
 * Server rules restrict every admin write to the admin account.
 */

// What each argument position expects, for autocomplete + hints.
// Arrays are fixed choices; '...' repeats the pair before it (give res n res n …).
const ARG_SPECS = {
  players: ['text'], info: ['player'], give: ['player', 'res', 'number', '...'], karma: ['player', 'number'],
  shield: ['player', 'number'], msg: ['player', 'text'], broadcast: ['text'], event: ['event', 'target'],
  spawn: ['creature', 'number', 'target'], warband: ['number', 'number'], ban: ['player', 'text'], unban: ['player'],
  reset: ['player', ['confirm']], chat: [['15', 'clear', 'del']], skip: ['number'], era: [['up', '0', '1', '2', '3']],
  villager: ['number'], changelog: ['number'], rich: ['number'], time: ['number'],
  item: ['item', 'number', 'villager'], person: ['number', 'personopt', 'personopt', 'personopt', 'personopt', 'personopt', 'personopt'],
  build: ['building', 'number'], empire: [['list', 'event', 'discover', 'war', 'win', 'peace'], 'number'],
};

export class AdminConsole {
  constructor({ game, mp, user }) {
    this.game = game;
    this.mp = mp;
    this.user = user;
    this.players = null;
    this.history = load();
    this.hIndex = this.history.length;
    this.sugIndex = 0;
    this.suggestions = [];
    this.build();
    this.print(`Welcome back, ${game.state.owner.name}.`, 'accent');
    this.print('Start typing — suggestions appear as you go. Tab completes · ↑↓ choose · Enter runs · Esc closes.', 'dim');
  }

  get open() { return !this.el.classList.contains('hidden'); }

  toggle() {
    this.el.classList.toggle('hidden');
    if (this.open) {
      setTimeout(() => this.input.focus(), 30);
      this.updateStatus();
      this.loadPlayers().then(() => { this.updateStatus(); this.refreshSuggestions(); }).catch(() => {});
    }
  }

  build() {
    this.out = h('div.gc-out');
    this.ghost = h('div.gc-ghost');
    this.input = h('input.gc-input', { spellcheck: false, autocomplete: 'off', placeholder: 'type a command…' });
    this.menu = h('div.gc-menu.hidden');
    this.hint = h('div.gc-hint');
    this.status = h('div.gc-status');
    this.el = h('div.gc.hidden',
      h('div.gc-head',
        h('div.gc-title', 'HEARTBORN', h('span', ' // admin')),
        this.status,
        h('button.gc-close', { onclick: () => this.toggle(), title: 'Close (F2)' }, '✕')),
      this.out,
      h('div.gc-bottom',
        this.menu,
        h('div.gc-line',
          h('span.gc-prompt', '❯'),
          h('div.gc-field', this.ghost, this.input)),
        this.hint));
    document.getElementById('ui').append(this.el);
    this.input.addEventListener('keydown', e => this.onKey(e));
    this.input.addEventListener('input', () => { this.sugIndex = 0; this.refreshSuggestions(); });
    this.input.addEventListener('scroll', () => { this.ghost.scrollLeft = this.input.scrollLeft; });
    this.el.addEventListener('mousedown', e => {
      if (!e.target.closest('.gc-menu, button, .gc-out')) setTimeout(() => this.input.focus(), 0);
    });
    this.refreshSuggestions();
  }

  updateStatus() {
    const online = this.players ? this.players.filter(p => p.online).length : '…';
    const total = this.players ? this.players.length : '…';
    this.status.replaceChildren(
      h('span.gc-pill', h('b.dot-on'), `${online} online`),
      h('span.gc-pill', `${total} players`),
      h('span.gc-pill', this.game.state.owner.villageName));
  }

  onKey(e) {
    e.stopPropagation();
    const menuOpen = !this.menu.classList.contains('hidden') && this.suggestions.length > 0;
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = this.input.value.trim();
      this.input.value = '';
      this.refreshSuggestions();
      if (!line) return;
      this.history.push(line);
      if (this.history.length > 100) this.history.shift();
      this.hIndex = this.history.length;
      save(this.history);
      this.print(line, 'cmd');
      this.run(line).catch(err => this.print(err.message, 'err'));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.accept();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (menuOpen && this.input.value.trim()) {
        this.sugIndex = (this.sugIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.renderMenu();
      } else {
        this.hIndex = Math.max(0, Math.min(this.history.length, this.hIndex + dir));
        this.input.value = this.history[this.hIndex] || '';
        this.refreshSuggestions();
      }
    } else if (e.key === 'ArrowRight' && this.input.selectionStart === this.input.value.length && this.ghost.dataset.full) {
      e.preventDefault();
      this.accept();
    } else if (e.key === 'Escape' || e.key === 'F2') {
      e.preventDefault();
      if (menuOpen && e.key === 'Escape') { this.menu.classList.add('hidden'); this.suggestions = []; this.renderGhost(); return; }
      this.toggle();
    }
  }

  // ---------------------------------------------------------------- autocomplete
  context() {
    const value = this.input.value;
    const parts = value.split(' ');
    const current = parts[parts.length - 1];
    return { value, parts, current, cmdName: parts[0].toLowerCase(), argIndex: parts.length - 2, start: value.length - current.length };
  }

  optionsFor(kind) {
    if (Array.isArray(kind)) return kind.map(v => ({ value: v, label: v, detail: '' }));
    const players = (this.players || []).map(p => ({
      value: (p.villageName || p.uid).replace(/\s+/g, '_'), label: p.villageName || p.uid,
      detail: `${p.name || ''}${p.ban ? ' · banned' : ''}`, online: p.online,
    }));
    const me = { value: 'me', label: 'me', detail: 'your own village' };
    switch (kind) {
      case 'player': return [me, ...players];
      case 'target': return [me, { value: 'all', label: 'all', detail: 'every online player' }, ...players];
      case 'res': return [{ value: '*', label: '*', detail: 'every resource' }, ...RESOURCES.map(r => ({ value: r, label: r, detail: 'resource' }))];
      case 'item': return [{ value: 'list', label: 'list', detail: 'show every item' }, ...Object.entries(ITEMS).map(([k, i]) => ({ value: k, label: k, detail: i.label }))];
      case 'villager': return [{ value: 'selected', label: 'selected', detail: 'the villager you clicked' }, { value: 'all', label: 'all', detail: 'everyone' },
        ...this.game.state.villagers.slice(0, 200).map(v => ({ value: v.name, label: v.name, detail: `${v.job} · ${Math.floor(v.age)}` }))];
      case 'personopt': return [
        ...['name=', 'sex=m', 'sex=f', 'age=25', 'skills=10', 'trained', 'versatile', 'hp=100', 'happy=100'].map(o => ({ value: o, label: o, detail: 'option' })),
        ...Object.keys(JOBS).map(j => ({ value: `job=${j}`, label: `job=${j}`, detail: JOBS[j].label })),
        ...['combat', 'build', 'mine', 'chop', 'farm', 'craft', 'stealth'].map(s => ({ value: `${s}=10`, label: `${s}=10`, detail: 'skill' })),
        ...Object.keys(CALLINGS).map(c => ({ value: `calling=${c}`, label: `calling=${c}`, detail: 'calling' })),
        ...Object.keys(TRAITS).map(t => ({ value: `traits=${t}`, label: `traits=${t}`, detail: TRAITS[t].label })),
      ];
      case 'building': return Object.entries(BUILDINGS).map(([k, d]) => ({ value: k, label: k, detail: `${d.name} · ${ERAS[d.era].name}` }));
      case 'creature': return Object.entries(CREATURES).map(([k, d]) => ({ value: k, label: k, detail: d.hostile ? `hostile · ${d.hp} hp` : 'animal' }));
      case 'event': return [{ value: 'list', label: 'list', detail: 'show all events' }, ...EVENTS.map(ev => ({ value: ev.id, label: ev.id, detail: ev.title }))];
      default: return [];
    }
  }

  kindAt(cmdName, argIndex) {
    const spec = ARG_SPECS[cmdName] || [];
    const repeat = spec.indexOf('...');
    if (repeat > 0 && argIndex >= repeat) {
      const pairStart = repeat - 2;
      return spec[pairStart + ((argIndex - pairStart) % 2)];
    }
    return spec[argIndex];
  }

  refreshSuggestions() {
    const { parts, current, cmdName, argIndex } = this.context();
    const q = current.toLowerCase();
    let items = [];
    let hint = '';
    const cmd = COMMANDS[cmdName];

    if (parts.length === 1) {
      items = Object.entries(COMMANDS)
        .filter(([name]) => name.startsWith(q) && name !== q)
        .map(([name, c]) => ({ value: name, label: name, detail: c.desc }));
      if (q && !items.length && !cmd) hint = 'unknown command — try "help"';
      if (cmd) hint = cmd.usage;
    } else if (cmd) {
      hint = cmd.usage;
      const kind = this.kindAt(cmdName, argIndex);
      if (kind === 'number') hint += '   ·   expects a number';
      else if (kind === 'text') hint += '   ·   free text';
      items = this.optionsFor(kind)
        .filter(o => o.value.toLowerCase() !== q && (o.value.toLowerCase().startsWith(q) || o.label.toLowerCase().includes(q)));
    }

    this.suggestions = items;   // every match; the menu scrolls
    this.sugIndex = Math.min(this.sugIndex, Math.max(0, this.suggestions.length - 1));
    this.hint.textContent = hint;
    this.renderMenu();
  }

  renderMenu() {
    const items = this.suggestions;
    this.menu.classList.toggle('hidden', !items.length);
    this.menu.replaceChildren(h('div.gc-count', `${items.length} option${items.length === 1 ? '' : 's'} · ↑↓ to browse · Tab to complete`), ...items.map((o, i) => h(`div.gc-item${i === this.sugIndex ? '.on' : ''}`, {
      onmousedown: e => { e.preventDefault(); this.sugIndex = i; this.accept(); },
    }, h('span.gc-item-label', o.online ? h('b.dot-on') : null, o.label), h('span.gc-item-detail', o.detail))));
    this.menu.querySelector('.gc-item.on')?.scrollIntoView({ block: 'nearest' });
    this.renderGhost();
  }

  /** Grey inline preview of the highlighted suggestion. */
  renderGhost() {
    const { value, current } = this.context();
    const top = this.suggestions[this.sugIndex];
    if (top && top.value.toLowerCase().startsWith(current.toLowerCase()) && top.value.length > current.length) {
      this.ghost.replaceChildren(h('span.gc-typed', value), top.value.slice(current.length));
      this.ghost.dataset.full = '1';
    } else {
      this.ghost.replaceChildren();
      delete this.ghost.dataset.full;
    }
  }

  accept() {
    const top = this.suggestions[this.sugIndex];
    if (!top) return;
    const { value, start } = this.context();
    this.input.value = value.slice(0, start) + top.value + ' ';
    this.sugIndex = 0;
    this.refreshSuggestions();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
  }

  // ---------------------------------------------------------------- output
  print(text, cls = '') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    String(text).split('\n').forEach((line, i) => this.out.append(h(`div.gc-row${cls ? '.' + cls : ''}`,
      h('span.gc-time', i === 0 ? time : ''),
      h('span.gc-text', cls === 'cmd' ? `❯ ${line}` : line))));
    while (this.out.childElementCount > 500) this.out.firstChild.remove();
    this.out.scrollTop = this.out.scrollHeight;
  }

  table(rows, cols) {
    const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
    const fmtRow = r => cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
    this.print(fmtRow(Object.fromEntries(cols.map(c => [c, c.toUpperCase()]))), 'accent');
    for (const r of rows) this.print(fmtRow(r));
  }

  async run(line) {
    const [cmd, ...args] = tokenize(line);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (!fn) throw new Error(`unknown command "${cmd}" — try "help"`);
    await fn.run.call(this, args);
  }

  async loadPlayers(force = false) {
    if (!this.players || force) {
      try { this.players = await api.fetchPlayers(); } catch (e) { this.players ||= []; throw e; }
    }
    return this.players;
  }

  /** "me", uid, email, village or player name (exact, then unique partial). */
  async resolve(query) {
    if (!query) throw new Error('missing player (use "me", a village name, player name, email or uid)');
    if (query === 'me') return { me: true, uid: this.user.uid, villageName: this.game.state.owner.villageName };
    const list = await this.loadPlayers();
    const q = query.toLowerCase().replace(/_/g, ' ');
    const exact = list.filter(p => [p.uid, p.email, p.villageName, p.name].some(x => (x || '').toLowerCase() === q));
    if (exact.length === 1) return exact[0];
    const partial = list.filter(p => [p.uid, p.email, p.villageName, p.name].some(x => (x || '').toLowerCase().includes(q)));
    if (partial.length === 1) return partial[0];
    if (!partial.length) throw new Error(`no player matches "${query}"`);
    throw new Error(`"${query}" matches ${partial.length} players: ${partial.slice(0, 6).map(p => p.villageName).join(', ')}`);
  }
}

// ------------------------------------------------------------------ commands

const COMMANDS = {
  help: {
    usage: 'help', desc: 'List commands',
    run() {
      for (const c of Object.values(COMMANDS)) this.print(`${c.usage.padEnd(44)} ${c.desc}`);
    },
  },
  clear: { usage: 'clear', desc: 'Clear the screen', run() { this.out.replaceChildren(); } },

  players: {
    usage: 'players [filter]', desc: 'List all players',
    async run([filter]) {
      const list = await this.loadPlayers(true);
      const q = (filter || '').toLowerCase();
      const rows = list.filter(p => !q || JSON.stringify([p.name, p.email, p.villageName]).toLowerCase().includes(q))
        .sort((a, b) => (b.online - a.online) || (b.pop || 0) - (a.pop || 0))
        .map(p => ({ status: p.ban ? 'BANNED' : p.online ? 'online' : 'offline', village: p.villageName, player: p.name, email: p.email, pop: p.pop, karma: p.karma, era: ERAS[p.era || 0]?.name }));
      this.table(rows, ['status', 'village', 'player', 'email', 'pop', 'karma', 'era']);
      this.print(`${rows.length} player(s)`, 'dim');
    },
  },
  online: {
    usage: 'online', desc: 'Who is online right now',
    async run() {
      const list = (await this.loadPlayers(true)).filter(p => p.online);
      this.table(list.map(p => ({ village: p.villageName, player: p.name, pop: p.pop })), ['village', 'player', 'pop']);
      this.print(`${list.length} online`, 'dim');
    },
  },
  info: {
    usage: 'info <player>', desc: 'Detailed player info + save summary',
    async run([who]) {
      const p = await this.resolve(who);
      const save = p.me ? { state: this.game.state, size: 0, updatedAt: Date.now() } : await api.getSaveInfo(p.uid);
      const s = save?.state;
      this.print(JSON.stringify({
        uid: p.uid, player: p.name, email: p.email, village: p.villageName, online: p.online, banned: p.ban?.reason || false,
        day: s ? Math.floor(s.time / DAY_LENGTH) + 1 : undefined, era: s ? ERAS[s.era]?.name : undefined, karma: s?.karma,
        population: s?.villagers.length, buildings: s?.buildings.length, laws: s?.laws, resources: s?.resources,
        stats: s?.stats, saveKB: save ? Math.round(save.size / 1024) : undefined,
      }, null, 2));
    },
  },
  give: {
    usage: 'give <player|me> <res|*> <n> [<res> <n>…]', desc: 'Give resources (* = every resource)',
    async run([who, ...pairs]) {
      const p = await this.resolve(who);
      const res = {};
      if (pairs[0] === '*' || pairs[0] === 'all') {   // give me * 200000 → every resource
        const n = Number(pairs[1]);
        if (Number.isNaN(n)) throw new Error('usage: give me * 200000');
        for (const r of RESOURCES) res[r] = n;
        pairs = [];
      }
      for (let i = 0; i < pairs.length; i += 2) {
        if (!RESOURCES.includes(pairs[i])) throw new Error(`unknown resource "${pairs[i]}" (${RESOURCES.join(', ')})`);
        res[pairs[i]] = Number(pairs[i + 1]) || 0;
      }
      if (!Object.keys(res).length) throw new Error('usage: give me gold 100 wood 50');
      // admin gifts ignore storage limits
      if (p.me) { for (const [k, v] of Object.entries(res)) this.game.state.resources[k] = Math.max(0, (this.game.state.resources[k] || 0) + v); this.game.emit('change'); }
      else await api.sendCommand(p.uid, { type: 'give', res });
      this.print(`✓ gave ${Object.entries(res).map(([k, v]) => `${v} ${k}`).join(', ')} to ${p.villageName}`, 'ok');
    },
  },
  karma: {
    usage: 'karma <player|me> <-100..100>', desc: 'Set karma',
    async run([who, value]) {
      const p = await this.resolve(who);
      const n = Math.max(-100, Math.min(100, Number(value)));
      if (Number.isNaN(n)) throw new Error('karma needs a number');
      if (p.me) { this.game.state.karma = n; this.game.emit('change'); }
      else await api.sendCommand(p.uid, { type: 'karma', value: n });
      this.print(`✓ karma of ${p.villageName} → ${n}`, 'ok');
    },
  },
  shield: {
    usage: 'shield <player|me> <hours>', desc: 'Protect from attacks',
    async run([who, hours]) {
      const p = await this.resolve(who);
      const hrs = Number(hours) || 24;
      if (p.me) this.game.state.shieldUntil = Date.now() + hrs * 3600000;
      else await api.sendCommand(p.uid, { type: 'shield', hours: hrs });
      this.print(`✓ ${hrs}h shield for ${p.villageName}`, 'ok');
    },
  },
  msg: {
    usage: 'msg <player> <text…>', desc: 'Private message banner',
    async run([who, ...words]) {
      const p = await this.resolve(who);
      const text = words.join(' ');
      if (!text) throw new Error('message is empty');
      await api.sendCommand(p.uid, { type: 'message', text });
      this.print(`✓ message queued for ${p.villageName}`, 'ok');
    },
  },
  broadcast: {
    usage: 'broadcast <text…>', desc: 'Banner for every player',
    async run(words) {
      const text = words.join(' ');
      if (!text) throw new Error('broadcast is empty');
      await api.broadcast(text);
      this.print('✓ broadcast sent', 'ok');
    },
  },
  event: {
    usage: 'event list | event <id> [me|all|<player>]', desc: 'Trigger a story event',
    async run([id, target = 'me']) {
      if (!id || id === 'list') { this.table(EVENTS.map(e => ({ id: e.id, title: e.title })), ['id', 'title']); return; }
      const ev = EVENTS.find(e => e.id === id);
      if (!ev) throw new Error(`no event "${id}" (event list)`);
      if (target === 'all') { await api.triggerGlobalEvent(id); this.print(`✓ "${ev.title}" sent to every online player`, 'ok'); return; }
      const p = await this.resolve(target);
      if (p.me) { this.toggle(); this.game.startEvent(ev); }
      else await api.sendCommand(p.uid, { type: 'event', id });
      this.print(`✓ "${ev.title}" → ${p.villageName}`, 'ok');
    },
  },
  spawn: {
    usage: 'spawn <creature> [count] [me|<player>]', desc: 'Send monsters at a village',
    async run([type, count = '1', target = 'me']) {
      if (!CREATURES[type]) throw new Error(`unknown creature (${Object.keys(CREATURES).join(', ')})`);
      const n = Math.min(20, Number(count) || 1);
      const p = await this.resolve(target);
      if (p.me) this.game.spawnRaiders(type, n);
      else await api.sendCommand(p.uid, { type: 'spawn', creature: type, count: n });
      this.print(`✓ ${n} ${type} → ${p.villageName}`, 'ok');
    },
  },
  warband: {
    usage: 'warband [soldiers] [seconds]', desc: 'Send a barbarian army at your village',
    run([count = '4', secs = '60']) {
      const s = this.game.state;
      s.incoming.push({ id: `w${Date.now().toString(36)}`, kind: 'warband', name: 'The Admin Horde', count: Math.min(12, Number(count) || 4), scale: 1, arrivesAt: s.time + (Number(secs) || 60), warned: false });
      this.print('✓ warband marching', 'ok');
    },
  },
  ban: {
    usage: 'ban <player> [reason…]', desc: 'Ban a player',
    async run([who, ...reason]) {
      const p = await this.resolve(who);
      if (p.me) throw new Error('you cannot ban yourself');
      await api.banPlayer(p.uid, reason.join(' ') || 'No reason given');
      this.players = null;
      this.print(`✓ banned ${p.name} (${p.villageName})`, 'ok');
    },
  },
  unban: {
    usage: 'unban <player>', desc: 'Lift a ban',
    async run([who]) {
      const p = await this.resolve(who);
      await api.unbanPlayer(p.uid);
      this.players = null;
      this.print(`✓ unbanned ${p.name}`, 'ok');
    },
  },
  reset: {
    usage: 'reset <player>', desc: 'Wipe a village (asks to confirm)',
    async run([who, confirm]) {
      const p = await this.resolve(who);
      if (p.me) throw new Error('use Settings → Abandon village for your own');
      if (confirm !== 'confirm') {
        this.print(`⚠ this wipes ${p.villageName} forever. Run: reset ${who} confirm`, 'warn');
        return;
      }
      await api.resetPlayer(p.uid);
      this.print(`✓ ${p.villageName} has been reset`, 'ok');
    },
  },
  chat: {
    usage: 'chat [n] | chat del <id> | chat clear', desc: 'Read or moderate chat',
    async run([sub, arg]) {
      if (sub === 'clear') { await api.clearChat(); this.print('✓ chat cleared', 'ok'); return; }
      if (sub === 'del') { await api.deleteChatMessage(arg); this.print(`✓ deleted ${arg}`, 'ok'); return; }
      const n = Number(sub) || 15;
      for (const m of (this.mp?.chat || []).slice(-n)) this.print(`[${m.id}] ${m.name} (${m.village || '?'}): ${m.text}`);
    },
  },
  laws: {
    usage: 'laws', desc: 'Show your laws',
    run() {
      const laws = this.game.state.laws || {};
      for (const c of LAW_CATEGORIES) this.print(`${c.name.padEnd(12)} ${c.options.find(o => o.id === laws[c.id])?.name || '—'}`);
    },
  },
  skip: {
    usage: 'skip <days>', desc: 'Fast-forward your village',
    run([days = '1']) {
      const d = Math.min(30, Number(days) || 1);
      const sum = this.game.simulate(DAY_LENGTH * d);
      this.game.emit('change');
      this.print(`✓ skipped ${d} day(s): pop ${sum.pop >= 0 ? '+' : ''}${sum.pop}, births ${sum.births}, deaths ${sum.deaths}`, 'ok');
    },
  },
  era: {
    usage: 'era [up|<0-3>]', desc: 'Change your era',
    run([arg = 'up']) {
      const s = this.game.state;
      s.era = arg === 'up' ? Math.min(ERAS.length - 1, s.era + 1) : Math.max(0, Math.min(ERAS.length - 1, Number(arg) || 0));
      this.game.emit('change');
      this.print(`✓ era → ${ERAS[s.era].name}`, 'ok');
    },
  },
  finish: {
    usage: 'finish', desc: 'Finish all your construction',
    run() {
      const pending = this.game.state.buildings.filter(b => !b.built);
      for (const b of pending) this.game.finishBuilding(b);
      this.print(`✓ finished ${pending.length} building(s)`, 'ok');
    },
  },
  villager: {
    usage: 'villager [n]', desc: 'Add villagers to your village',
    run([n = '1']) {
      const count = Math.max(1, Math.floor(Number(n) || 1));
      for (let i = 0; i < count; i++) this.game.addWanderer();
      this.game.recalc();
      this.game.emit('change');
      this.print(`✓ ${count} villager(s) joined`, 'ok');
    },
  },

  person: {
    usage: 'person [count] [name=Ada] [sex=m|f] [age=30] [job=mine] [skills=8] [combat=10 …] [traits=brave,strong] [calling=soldier] [trained] [versatile] [trade=mine] [hp=100]',
    desc: 'Spawn villagers with the stats you choose',
    run(args) {
      const g = this.game;
      const count = /^\d+$/.test(args[0] || '') ? Math.max(1, Number(args.shift())) : 1;
      const opts = {};
      for (const a of args) {
        const [k, ...rest] = a.split('=');
        opts[k.toLowerCase()] = rest.length ? rest.join('=') : true;
      }
      const made = [];
      for (let i = 0; i < count; i++) {
        const v = g.addWanderer({ child: opts.age != null && Number(opts.age) < 12 });
        if (opts.name) v.name = count > 1 ? `${opts.name} ${i + 1}` : String(opts.name);
        if (opts.sex === 'm' || opts.sex === 'f') v.sex = opts.sex;
        if (opts.age != null) v.age = Math.max(0, Number(opts.age) || 0);
        if (opts.skills != null) for (const s of Object.keys(v.skills)) v.skills[s] = Number(opts.skills) || 0;
        for (const s of Object.keys(v.skills)) if (opts[s] != null) v.skills[s] = Number(opts[s]) || 0;
        if (opts.traits) v.traits = String(opts.traits).split(',').filter(t => TRAITS[t]);
        if (opts.calling && CALLINGS[opts.calling]) v.calling = opts.calling;
        if (opts.trained) v.trained = true;
        if (opts.hp != null) v.hp = Math.max(1, Math.min(100, Number(opts.hp) || 100));
        if (opts.happy != null) v.happy = Math.max(0, Math.min(100, Number(opts.happy) || 0));
        if (opts.versatile) v.traits = [...new Set([...v.traits, 'versatile'])];
        if (opts.trade && JOBS[opts.trade]) v.profession = opts.trade;
        if (opts.job && JOBS[opts.job]) { if (!opts.trade && !opts.versatile) v.profession = opts.job === 'recruit' ? 'warrior' : opts.job; assignJob(g, v, opts.job, true); }   // not a "personal order": the Steward/office may still move them
        made.push(v);
      }
      const bad = Object.keys(opts).filter(k => !['name', 'sex', 'age', 'skills', 'traits', 'calling', 'trained', 'hp', 'happy', 'job', 'trade', 'versatile'].includes(k) && !(k in made[0].skills));
      g.recalc();
      g.emit('change');
      this.print(`✓ spawned ${made.length}: ${made.slice(0, 5).map(v => `${v.name} (${v.sex}, ${Math.floor(v.age)}, ${v.job})`).join(', ')}${made.length > 5 ? '…' : ''}`, 'ok');
      if (bad.length) this.print(`ignored unknown options: ${bad.join(', ')} — skills are ${Object.keys(made[0].skills).join(', ')}; traits: ${Object.keys(TRAITS).join(', ')}`, 'warn');
    },
  },
  item: {
    usage: 'item <item> [count] [villager name | all | selected]', desc: 'Drop items into villagers’ packs',
    run([key, count = '1', ...who]) {
      const g = this.game;
      if (!key || key === 'list') { this.table(Object.entries(ITEMS).map(([k, i]) => ({ item: k, name: i.label, does: i.desc || i.slot || '' })), ['item', 'name', 'does']); return; }
      if (!ITEMS[key]) throw new Error(`unknown item (item list): ${Object.keys(ITEMS).join(', ')}`);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      const target = who.join(' ').toLowerCase() || 'selected';
      let people;
      if (target === 'all') people = g.state.villagers;
      else if (target === 'selected') people = g.selected?.kind === 'villager' ? [g.selected.ref] : [];
      else people = g.state.villagers.filter(v => v.name.toLowerCase() === target || v.name.toLowerCase().startsWith(target)).slice(0, 1);
      if (!people.length) throw new Error(target === 'selected' ? 'click a villager first, or name one: item potion 3 Ada' : `no villager called "${target}"`);
      for (const v of people) addItem(v, key, n);
      g.emit('change');
      this.print(`✓ ${n} × ${ITEMS[key].label} → ${people.length === 1 ? people[0].name : `${people.length} villagers`}`, 'ok');
    },
  },

  // ---------------- version & site
  version: {
    usage: 'version', desc: 'This build vs the newest deploy on the live site',
    async run() {
      this.print(`running  ${BUILD.version}  (commit ${BUILD.commit}, built ${new Date(BUILD.builtAt).toLocaleString()})`);
      try {
        const { live, isLatest } = await checkLatest();
        this.print(`live     ${live.version}  (commit ${live.commit}, built ${new Date(live.builtAt).toLocaleString()})`);
        this.print(isLatest ? '✓ you are running the newest version' : '⚠ a newer version is live — reload the page (Ctrl+Shift+R)', isLatest ? 'ok' : 'warn');
      } catch (e) { this.print(`could not reach the live site: ${e.message}`, 'warn'); }
    },
  },
  changelog: {
    usage: 'changelog [n]', desc: 'What changed in recent updates',
    run([n = '3']) {
      for (const entry of CHANGELOG.slice(0, Number(n) || 3)) {
        this.print(`■ ${entry.title}`, 'accent');
        for (const c of entry.changes) this.print(`   • ${c}`);
      }
    },
  },
  reload: { usage: 'reload', desc: 'Save and reload the page (gets the newest version)', async run() { this.print('reloading…', 'dim'); location.reload(); } },

  // ---------------- your village
  rich: {
    usage: 'rich [n]', desc: 'Fill every resource of your village',
    run([n = '5000']) {
      const v = Number(n) || 5000;
      for (const k of RESOURCES) this.game.state.resources[k] = Math.max(this.game.state.resources[k] || 0, v);
      this.game.emit('change');
      this.print(`✓ every resource ≥ ${v}`, 'ok');
    },
  },
  heal: {
    usage: 'heal', desc: 'Heal and cure every villager, feed everyone',
    run() {
      for (const v of this.game.state.villagers) { v.hp = 100; v.sick = 0; v.hunger = 100; v.happy = Math.max(v.happy, 70); }
      this.print(`✓ ${this.game.state.villagers.length} villagers healed`, 'ok');
    },
  },
  clearmobs: {
    usage: 'clearmobs', desc: 'Remove every hostile creature near your village',
    run() {
      const before = this.game.state.creatures.length;
      this.game.state.creatures = this.game.state.creatures.filter(c => !CREATURES[c.t]?.hostile);
      this.game.state.battles = {};
      this.print(`✓ removed ${before - this.game.state.creatures.length} hostiles`, 'ok');
    },
  },
  build: {
    usage: 'build <type> [count]', desc: 'Instantly build near the village centre',
    run([type, count = '1']) {
      if (!BUILDINGS[type]) throw new Error(`unknown building (try: ${Object.keys(BUILDINGS).slice(0, 8).join(', ')}…)`);
      const g = this.game;
      let made = 0;
      for (let i = 0; i < Math.min(20, Number(count) || 1); i++) {
        for (const [k, v] of Object.entries(BUILDINGS[type].cost)) g.state.resources[k] = Math.max(g.state.resources[k] || 0, v);
        const era = g.state.era;
        g.state.era = Math.max(era, BUILDINGS[type].era);
        const spot = g.findBuildSpot(type);
        const r = spot && g.placeBuilding(type, spot.tx, spot.ty);
        g.state.era = era;
        if (!r?.ok) break;
        g.finishBuilding(r.building);
        made++;
      }
      g.emit('change');
      this.print(made ? `✓ built ${made} ${BUILDINGS[type].name}` : '✗ no free space', made ? 'ok' : 'err');
    },
  },
  abilities: {
    usage: 'abilities', desc: 'Recharge every building ability now',
    run() {
      let n = 0;
      for (const b of this.game.state.buildings) if (b.abilityAt != null) { b.abilityAt = null; n++; }
      this.print(`✓ ${n} abilities recharged`, 'ok');
    },
  },
  time: {
    usage: 'time <hour 0-23>', desc: 'Set the time of day',
    run([hour]) {
      const hr = Number(hour);
      if (Number.isNaN(hr)) throw new Error('usage: time 12');
      const s = this.game.state;
      s.time = Math.floor(s.time / DAY_LENGTH) * DAY_LENGTH + (Math.max(0, Math.min(23.9, hr)) / 24) * DAY_LENGTH;
      this.print(`✓ it is now ${hr}:00`, 'ok');
    },
  },
  tutorial: { usage: 'tutorial', desc: 'Restart the tutorial', run() { this.game.state.tutorial = { step: 0, done: false }; this.print('✓ tutorial restarted', 'ok'); } },
  stats: {
    usage: 'stats', desc: 'Village numbers at a glance',
    run() {
      const g = this.game, s = g.state;
      this.print(JSON.stringify({
        day: g.day + 1, era: ERAS[s.era].name, population: s.villagers.length, housing: g.housing, warriors: s.villagers.filter(v => v.job === 'warrior').length,
        buildings: s.buildings.length, defense: Math.round(g.defense), luck: Number(g.fateBonus.toFixed(2)), karma: Math.round(s.karma),
        army: empirePower(g), title: empireTitle(g), effects: s.modifiers.map(m => m.id),
      }, null, 2));
    },
  },

  // ---------------- empire
  empire: {
    usage: 'empire list | event [n] | discover | war <n> | win <n> | peace <n>', desc: 'Inspect and control neighbouring kingdoms',
    run([sub = 'list', arg]) {
      const g = this.game;
      const e = empireOf(g);
      const pick = () => { const k = e.kingdoms[Number(arg) - 1]; if (!k) throw new Error(`no kingdom #${arg} (empire list)`); return k; };
      if (sub === 'list') {
        this.table(e.kingdoms.map((k, i) => ({ '#': i + 1, name: k.name, ruler: k.ruler, type: k.personality, status: k.status, strength: k.strength, relations: Math.round(k.attitude) })), ['#', 'name', 'ruler', 'type', 'status', 'strength', 'relations']);
        this.print(`your army ${empirePower(g)} · title ${empireTitle(g)}`, 'dim');
      } else if (sub === 'discover') {
        const before = e.kingdoms.length;
        for (let i = 0; i < 20 && e.kingdoms.length === before; i++) { g.state.villagers.length >= 8 || g.addWanderer(); dailyEmpire(g); g.pendingEvent = null; }
        this.print(e.kingdoms.length > before ? `✓ discovered ${e.kingdoms.at(-1).name}` : '✗ no new kingdom (limit reached?)', 'ok');
      } else if (sub === 'event') {
        empireEvent(g, arg != null ? Number(arg) : null);
        this.print(`✓ empire event fired: ${e.history[0]?.text || '(nothing happened)'}`, 'ok');
      } else if (sub === 'war') { const k = pick(); k.status = 'war'; k.warScore = 0; this.print(`✓ at war with ${k.name}`, 'ok'); }
      else if (sub === 'win') { const k = pick(); k.status = 'war'; k.warScore = 99; k.strength = 1; dailyEmpire(g); g.pendingEvent = null; this.print(`✓ ${k.name} is now: ${k.status}`, 'ok'); }
      else if (sub === 'peace') { const k = pick(); k.status = 'neutral'; k.warScore = 0; k.attitude = 20; this.print(`✓ peace with ${k.name}`, 'ok'); }
      else throw new Error(COMMANDS.empire.usage);
      g.emit('change');
    },
  },

  // ---------------- worlds
  world: {
    usage: 'world', desc: 'Which world you are in, its code and members',
    run() {
      const w = this.game.world && this.mp ? this.mp.world : null;
      this.print(`world id ${this.mp?.worldId || 'solo'} · ${this.mp ? `${this.mp.players.length} villages, ${this.mp.players.filter(p => p.online).length} online` : 'solo (no multiplayer)'}`);
      if (w) this.print(JSON.stringify(w));
    },
  },
};

function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function load() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
