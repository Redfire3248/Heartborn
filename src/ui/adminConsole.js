import { PETS as PET_LIST } from '../game/pets.js';
import { CONSUMABLES as CONSUMABLE_LIST } from '../game/consumables.js';
import { TOOLS as ALL_TOOLS } from '../game/tools.js';
import { ENCHANTS } from '../game/enchanting.js';
import { h, icon, RES_ICON } from './dom.js';
import { buildingSprite } from '../data/buildings.js';
import { villagerSprite } from '../data/objects.js';
import { CATALOG, RARITY, makeGear, takeGear, equip, rpgOf, heroStats } from '../game/rpg.js';
import { damageCreature } from '../game/creatures.js';
import { updateEntrances } from '../game/treasure.js';
import { on } from '../core/features.js';
import { gearIconKey } from '../render/gearArt.js';
import { heroOf } from '../game/hero.js';
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
import { dropItem } from '../game/groundItems.js';
import { STRIKE_KINDS, adminStrike } from '../game/intrigue.js';
import { openAimMap } from './aimMap.js';
import { makeVisitGame } from '../game/visit.js';
import { getProfile } from '../net/save.js';
import { recentErrors, clearErrors } from '../net/errors.js';
import { recentReports, clearReports } from '../net/chatSafety.js';

const BUILDINGS = BUILDING_DEFS;

// a picture for each command in the suggestion list
const COMMAND_ICONS = {
  players: 'items/population', info: 'items/scroll', give: 'items/icon_gold', karma: 'items/karma_good', shield: 'items/shield_protect', msg: 'items/chat', broadcast: 'items/chat',
  event: 'items/dice_fate', spawn: 'characters/wolf', warband: 'items/war', ban: 'effects/skull_curse', unban: 'items/alliance', reset: 'effects/explosion', chat: 'items/chat',
  skip: 'items/star_rank', era: 'items/crown_leader', errors: 'effects/emote_alert', reports: 'effects/emote_angry', villager: 'items/population', changelog: 'items/scroll',
  rich: 'items/icon_gold', time: 'items/star_rank', item: 'items/relic', drop: 'items/relic', gear: 'gear/sword_legendary', missile: 'units/missile', nuke: 'units/missile', dungeon: 'gear/key', tool: 'items/pickaxe',
  person: 'items/baby', build: 'buildings/campfire', empire: 'items/crown_leader', version: 'items/star_rank', heal: 'effects/plus_heal',
  god: 'items/shield_protect', level: 'items/star_rank', potions: 'gear/health_potion', tp: 'effects/magic_orb', kill: 'effects/skull_curse', chest: 'gear/chest_closed',
  speed: 'items/star_rank', stats: 'items/scroll', help: 'items/scroll', finish: 'items/hammer', abilities: 'effects/spark', world: 'buildings/castle',
};

const EXAMPLES = {
  help: [['help', 'every command'], ['help spawn', 'one command with examples'], ['help loot', 'search for commands about loot']],
  clear: [['clear', 'wipe the console']],
  players: [['players', 'everyone, online first'], ['players ada', 'only players matching "ada"']],
  info: [['info me', 'your own save'], ['info Riverwood', 'a player by village name']],
  give: [['give me gold 500', '500 gold for you'], ['give me * 10000', '10000 of every resource'], ['give * food 200 wood 100', 'food and wood for every player']],
  karma: [['karma me 50', 'set your karma to 50']],
  shield: [['shield me 24', 'nobody can attack you for a day']],
  msg: [['msg Riverwood Hello there!', 'a private banner for one player']],
  broadcast: [['broadcast Server restart in 5 minutes', 'a banner for everyone']],
  spawn: [['spawn wolf 3', '3 wolves next to you'], ['spawn boss', 'every boss next to you'], ['spawn hostile 1 me', 'one of every monster raids your village'], ['spawn lich 1', 'the Lich, right here']],
  warband: [['warband 10 30', '10 raiders arrive in 30 seconds']],
  ban: [['ban Griefer spamming chat', 'ban with a reason']],
  unban: [['unban Griefer', 'lift the ban']],
  reset: [['reset me confirm', 'start your own game over'], ['reset Riverwood confirm', 'wipe a player\'s village']],
  chat: [['chat 30', 'the last 30 messages'], ['chat clear', 'clear the chat']],
  skip: [['skip 3', 'jump three days ahead']],
  era: [['era up', 'the next era'], ['era *', 'the last era'], ['era 2', 'a specific era']],
  finish: [['finish', 'complete every building site']],
  items: [['items * 5', 'five of every potion, bomb and item'], ['items bomb 20', 'twenty bombs']],
  gear: [['gear admin legendary equip', 'every ADMIN weapon (minigun, ban hammer, god sword...)'], ['gear minigun equip', 'the minigun in your hands'], ['gear list', 'every kind of gear with pictures'], ['gear katana legendary equip', 'a legendary katana, equipped'], ['gear * epic', 'one epic piece of everything'], ['gear shield rare 1', 'one rare of every shield']],
  tool: [['tool *', 'one of every tool'], ['tool pickaxe_mythril', 'the best pickaxe'], ['tool axe', 'every axe']],
  dungeon: [['dungeon 1', 'into a dungeon'], ['dungeon 5', 'straight down to floor 5'], ['dungeon leave', 'back to the surface']],
  drop: [['drop sword 1', 'a sword on the ground at your cursor'], ['drop * 1', 'one of every item']],
  errors: [['errors', 'recent crash reports'], ['errors clear', 'clear them']],
  reports: [['reports', 'reported chat messages']],
  version: [['version', 'is this the newest build?']],
  changelog: [['changelog 5', 'the last five updates']],
  reload: [['reload', 'reload the page']],
  heal: [['heal', 'full health, cured']],
  god: [['god', 'toggle invincibility'], ['god off', 'turn it off']],
  level: [['level 20', 'level 20 with the points for it'], ['level 50 0', 'level 50, no extra points']],
  potions: [['potions 10', 'carry 10 health potions']],
  tp: [['tp cursor', 'to where your mouse points'], ['tp cave', 'to a dungeon entrance'], ['tp boss', 'in a dungeon: straight to the boss (opens the door)'], ['tp 40 60', 'to tile 40, 60']],
  kill: [['kill', 'monsters within 12 tiles (with loot)'], ['kill all', 'every monster'], ['kill all noloot', 'remove them without drops']],
  chest: [['chest', 'a chest at your cursor'], ['chest boss 3', 'three boss chests']],
  speed: [['speed 2', 'the world runs twice as fast'], ['speed 1', 'back to normal']],
  build: [['build house 3', 'three houses'], ['build *', 'one of every building']],
  abilities: [['abilities', 'recharge building abilities']],
  time: [['time 22', 'night time'], ['time 8', 'morning']],
  stats: [['stats', 'your hero and land']],
  world: [['world', 'which world you are in']],
};
const GROUP_INFO = { Hero: 'you and your character', 'Items & loot': 'gear, tools, items, chests, resources', World: 'monsters, buildings, time and the land', Players: 'other players and moderation', Game: 'console, version and bug reports' };
const COMMAND_GROUPS = ['Hero', 'Items & loot', 'World', 'Players', 'Game'];
const GROUP_OF = {
  heal: 'Hero', god: 'Hero', level: 'Hero', potions: 'Hero', tp: 'Hero', stats: 'Hero', dungeon: 'Hero',
  gear: 'Items & loot', tool: 'Items & loot', items: 'Items & loot', drop: 'Items & loot', chest: 'Items & loot', give: 'Items & loot', item: 'Items & loot',
  spawn: 'World', kill: 'World', warband: 'World', build: 'World', finish: 'World', abilities: 'World', era: 'World', skip: 'World', time: 'World', speed: 'World', karma: 'World', shield: 'World', event: 'World', laws: 'World', empire: 'World', missile: 'World', person: 'World', tutorial: 'World',
  players: 'Players', info: 'Players', msg: 'Players', broadcast: 'Players', ban: 'Players', unban: 'Players', reset: 'Players', chat: 'Players', reports: 'Players', world: 'Players',
};
const groupOfCommand = k => GROUP_OF[k] || 'Game';

const HISTORY_KEY = 'hb_admin_history';

/*
 * Drop-down admin command line (F2) with live autocomplete. Commands that target "me"
 * act on your own village instantly; commands that target another player are
 * delivered through the Realtime Database the next time they are online.
 * Server rules restrict every admin write to the admin account.
 */

// What each argument position expects, for autocomplete + hints.
// Arrays are fixed choices; '...' repeats the pair before it (give res n res n …).
// the strongest, most useful things are listed first everywhere in the console
const TOP_COMMANDS = ['get', 'god', 'gear', 'enchant', 'items', 'tool', 'rich', 'trade', 'trades', 'station', 'map', 'troll', 'shop', 'journal', 'pet', 'give', 'level', 'potions', 'heal', 'tp', 'kill', 'chest', 'spawn', 'dungeon', 'speed', 'stats', 'help'];
const commandRank = k => { const i = TOP_COMMANDS.indexOf(k); return i < 0 ? 999 : i; };
const gearRank = d => (d.admin ? 1e6 : 0) + (d.minRarity || 0) * 1e4 + (d.damage || d.armor * 100 || d.block * 100 || 0);
const creatureRank = d => (d.boss ? 1e6 : d.hostile ? 1e4 : 0) + (d.hp || 0);

const ARG_SPECS = {
  help: ['command'], god: [['on', 'off']], level: ['number', 'number'], potions: ['number'], speed: [['0.5', '1', '2', '4']],
  tp: [['cursor', 'home', 'cave', 'boss', 'key', 'exit']], kill: [['12', 'all'], ['noloot']], chest: [['small', 'big', 'boss'], 'number'],
  players: ['text'], info: ['player'], give: ['player', 'res', 'number', '...'], karma: ['player', 'number'],
  shield: ['player', 'number'], msg: ['player', 'text'], broadcast: ['text'], event: ['event', 'target'],
  spawn: ['creature', 'number', 'spawnat'], warband: ['number', 'number'], ban: ['player', 'text'], unban: ['player'],
  reset: ['player', ['confirm']], chat: [['15', 'clear', 'del']], skip: ['number'], era: [['up', '*', '0', '1', '2', '3', '4', '5']],
  errors: [['15', 'clear']], reports: [['15', 'clear']],
  villager: ['number'], changelog: ['number'], rich: ['number'], time: ['number'],
  item: ['item', 'number', 'villager'], drop: ['item', 'number'], gear: ['gear', ['mythic', 'legendary', 'epic', 'rare', 'common', '*'], 'number', ['equip']], missile: [['nuke', 'missile', 'orbital'], 'target'], nuke: ['target'], dungeon: [['1', '2', '3', '5', 'leave']], items: [['*', 'bomb', 'dynamite', 'med_kit', 'speed_potion', 'strength_potion', 'invisibility_potion', 'mana_potion', 'antidote', 'golden_apple', 'ammo_box'], 'number'], tool: ['tool', 'number'], person: [['1', '5', '*'], 'personopt', 'personopt', 'personopt', 'personopt', 'personopt', 'personopt'],
  get: ['thing', 'number', ['mythic', 'legendary', 'epic', 'rare', 'common', 'equip']], build: ['building', 'number'], enchant: ['enchant', 'number', ['weapon', 'armor', 'helmet', 'shield', 'tool']], trade: ['player'], trades: [['accept', 'decline'], 'number'], station: [['enchanting', 'crafting', 'market']], map: [['open', 'reveal', 'hide', 'markers', 'clear']], troll: [['player'], ['freeze', 'launch', 'boom', 'spook', 'bring', 'goto', 'swap', 'say', 'mobs', 'list']], shop: [['open', 'reroll', 'sellall']], journal: [['open', 'newday', 'finish', 'unlock', 'reset']], pet: [['open', 'egg', 'give', 'hatch', 'list', 'clear'], ['chicken', 'rabbit', 'pig', 'slime', 'bat', 'wolf', 'forest_spirit', 'dragon', '5']], index: [['*', 'clear']], empire: [['list', 'event', 'discover', 'war', 'win', 'peace'], ['*', '1', '2', '3']],
};

export class AdminConsole {
  constructor({ game, mp, user, hud = null }) {
    this.game = game;
    this.hud = hud;
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
      if (!this.input.value.trim() && !menuOpen) { this.sugIndex = 0; this.refreshSuggestions(true); return; }
      this.accept();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (menuOpen) {
        this.sugIndex = (this.sugIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.renderMenu();
      } else if (dir > 0 && !this.input.value.trim() && this.hIndex >= this.history.length) {
        this.sugIndex = 0;
        this.refreshSuggestions(true);   // ↓ on an empty line browses every command
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
    const star = detail => ({ value: '*', label: '*', detail });
    switch (kind) {
      case 'player': return [me, star('every player'), ...players];
      case 'target': return [me, star('every village'), { value: 'all', label: 'all', detail: 'every online player' }, ...players];
      case 'spawnat': return [{ value: 'here', label: 'here', detail: 'right next to you' }, me, star('every village'), ...players];
      case 'command': return Object.entries(COMMANDS).sort(([a], [b]) => commandRank(a) - commandRank(b)).map(([k, c]) => ({ value: k, label: k, detail: c.desc, icon: COMMAND_ICONS[k] }));
      case 'tool': return [star('one of every tool'), ...Object.entries(ALL_TOOLS).sort(([, a], [, b]) => (b.power || 0) - (a.power || 0)).map(([k, t]) => ({ value: k, label: k, detail: `${t.name} · power ${t.power ?? '-'}${t.mythic ? ' · MYTHIC' : ''}`, icon: t.icon }))];
      case 'res': return [{ value: '*', label: '*', detail: 'every resource' }, ...RESOURCES.map(r => ({ value: r, label: r, detail: 'resource', icon: RES_ICON[r] }))];
      case 'item': return [star('every item'), { value: 'list', label: 'list', detail: 'show every item' }, ...Object.entries(ITEMS).map(([k, i]) => ({ value: k, label: k, detail: i.label, icon: i.icon }))];
      case 'gear': return [star('one of everything'), ...Object.keys(CATALOG).map(slot => ({ value: slot, label: slot, detail: `every ${slot}` })),
        { value: 'admin', label: 'admin', detail: 'every admin-only weapon (minigun, ban hammer...)' },
        ...Object.entries(CATALOG).flatMap(([slot, list]) => Object.entries(list).map(e => [...e, slot])).filter(([, d]) => d.icon !== null && (!d.noLoot || d.admin)).sort(([, a], [, b]) => gearRank(b) - gearRank(a)).map(([k, d, slot]) => [k, d, slot]).map(([k, d, slot]) => ({ value: k, label: k, detail: `${d.name} · ${slot}${d.admin ? ' · ADMIN' : ''}`, icon: gearIconKey({ base: k, slot, icon: d.icon }) }))];
      case 'villager': return [{ value: 'selected', label: 'selected', detail: 'the villager you clicked' }, star('everyone'), { value: 'all', label: 'all', detail: 'everyone' },
        ...this.game.state.villagers.slice(0, 200).map(v => ({ value: v.name, label: v.name, detail: `${v.job} · ${Math.floor(v.age)}`, icon: villagerSprite(v) }))];
      case 'personopt': return [
        ...['name=', 'sex=m', 'sex=f', 'sex=*', 'age=25', 'skills=10', 'skills=*', 'trained', 'versatile', 'hp=100', 'hp=*', 'happy=*', 'job=*', 'traits=*', 'traits=all', 'traits=knighted', 'traits=good', 'calling=*', 'trade=*', 'strength=10', 'speed=10', 'stamina=10', 'body=*', 'size=2'].map(o => ({ value: o, label: o, detail: o.endsWith('*') ? 'everything / the maximum' : o === 'traits=good' ? 'every good trait' : 'option' })),
        ...Object.keys(JOBS).map(j => ({ value: `job=${j}`, label: `job=${j}`, detail: JOBS[j].label, icon: JOBS[j].icon })),
        ...['combat', 'build', 'mine', 'chop', 'farm', 'craft', 'stealth'].map(s => ({ value: `${s}=10`, label: `${s}=10`, detail: 'skill' })),
        ...Object.keys(CALLINGS).map(c => ({ value: `calling=${c}`, label: `calling=${c}`, detail: 'calling' })),
        ...Object.keys(TRAITS).map(t => ({ value: `traits=${t}`, label: `traits=${t}`, detail: TRAITS[t].label })),
      ];
      case 'enchant': return [{ value: '*', label: '*', detail: 'every enchantment at max on all your gear and held tool' }, { value: 'list', label: 'list', detail: 'show every enchantment' }, { value: 'random', label: 'random', detail: 'a free random enchant' }, { value: 'roll', label: 'roll', detail: 'a free roll with the rolling animation' }, { value: 'book', label: 'book', detail: 'give enchantment books: book <enchantment|random> [level] [count]' }, { value: 'clear', label: 'clear', detail: 'remove enchantments' }, { value: 'menu', label: 'menu', detail: 'open the Enchanting Table menu anywhere' },
        ...Object.entries(ENCHANTS).map(([k, e]) => ({ value: k, label: k, detail: `${e.name} · max ${e.max} · ${e.for.join('/')}` }))];
      case 'thing': return [
        { value: 'all-gear', label: 'all-gear', detail: 'one of every weapon, armour, helmet, shield and trinket' },
        { value: 'all-tools', label: 'all-tools', detail: 'one of every tool' },
        { value: 'all-items', label: 'all-items', detail: 'every potion, bomb and consumable' },
        { value: 'all-pets', label: 'all-pets', detail: 'one of every pet' },
        { value: 'all-materials', label: 'all-materials', detail: 'some of every ore and material' },
        ...Object.entries(CATALOG).flatMap(([slot, list]) => Object.entries(list).map(e => [...e, slot])).filter(([, d]) => d.icon !== null && (!d.noLoot || d.admin)).sort(([, a], [, b]) => gearRank(b) - gearRank(a)).map(([k, d, slot]) => ({ value: k, label: k, detail: `${d.name} · ${slot}${d.admin ? ' · ADMIN' : ''}`, icon: gearIconKey({ base: k, slot, icon: d.icon }) })),
        ...Object.entries(ALL_TOOLS).sort(([, a], [, b]) => (b.power || 0) - (a.power || 0)).map(([k, t]) => ({ value: k, label: k, detail: `${t.name} · tool · power ${t.power ?? '-'}`, icon: t.icon })),
        ...Object.entries(CONSUMABLE_LIST).map(([k, c]) => ({ value: k, label: k, detail: `${c.name} · item`, icon: c.icon })),
        { value: 'potion', label: 'potion', detail: 'Health Potion · item', icon: 'gear/health_potion' },
        ...Object.entries(PET_LIST).map(([k, p]) => ({ value: `pet:${k}`, label: `pet:${k}`, detail: `${p.name} · pet`, icon: p.sprite })),
        { value: 'egg', label: 'egg', detail: 'Pet egg', icon: 'pets/egg_common' },
        ...RESOURCES.map(r => ({ value: r, label: r, detail: 'resource / material', icon: RES_ICON[r] })),
      ];
      case 'building': return [star('one of every building'), ...Object.entries(BUILDINGS).map(([k, d]) => ({ value: k, label: k, detail: `${d.name} · ${ERAS[d.era].name}`, icon: buildingSprite(k) }))];
      case 'creature': return [star('every creature'), { value: 'hostile', label: 'hostile', detail: 'every monster' }, { value: 'boss', label: 'boss', detail: 'every boss' }, ...Object.entries(CREATURES).sort(([, a], [, b]) => creatureRank(b) - creatureRank(a)).map(([k, d]) => ({ value: k, label: k, detail: d.boss ? `BOSS · ${d.hp} hp` : d.hostile ? `hostile · ${d.hp} hp` : 'animal', icon: d.sprite }))];
      case 'event': return [{ value: 'list', label: 'list', detail: 'show all events' }, ...EVENTS.map(ev => ({ value: ev.id, label: ev.id, detail: ev.title, icon: ev.icon }))];
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
    // option lists (person name=… sex=… strength=…) keep suggesting however many options you type
    if (argIndex >= spec.length && spec[spec.length - 1] === 'personopt') return 'personopt';
    return spec[argIndex];
  }

  refreshSuggestions(browse = false) {
    const { value, parts, current, cmdName, argIndex } = this.context();
    const q = current.toLowerCase();
    let items = [];
    let hint = '';
    const cmd = COMMANDS[cmdName];

    if (!value.trim() && !browse) {
      // nothing typed: no menu until the player types (or asks with Tab / ↓)
    } else if (parts.length === 1) {
      items = Object.entries(COMMANDS)
        .filter(([name]) => name.startsWith(q) && name !== q)
        .map(([name, c]) => ({ value: name, label: name, detail: c.desc, icon: COMMAND_ICONS[name] }));
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
    }, h('span.gc-item-label', o.icon ? icon(o.icon, 18) : null, o.online ? h('b.dot-on') : null, o.label), h('span.gc-item-detail', o.detail))));
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

  // ---------------------------------------------------------------- help
  /** One line of help: the command (click to type it) and what it does. */
  helpRow(name, c) {
    const row = h('div.gc-row.gc-help',
      h('span.gc-time', ''),
      h('button.gc-cmd', { title: `help ${name}`, onclick: () => this.explain(name) }, icon(COMMAND_ICONS[name] || 'items/scroll', 16), name),
      h('span.gc-help-desc', c.desc));
    this.out.append(row);
    this.out.scrollTop = this.out.scrollHeight;
  }

  /** Everything about one command, with examples that fill in the command line when clicked. */
  explain(name) {
    const c = COMMANDS[name];
    this.print(`■ ${name}`, 'accent');
    this.print(`   ${c.desc}`);
    this.print(`   usage: ${c.usage}`, 'dim');
    const spec = ARG_SPECS[name] || [];
    const kinds = { player: 'a player: me, *, or a village / player name', target: 'who: me, *, all, or a player', res: 'a resource or * (every resource)', number: 'a number', text: 'any text', gear: 'a gear kind, a slot (weapon, shield...) or *', item: 'an item or *', creature: 'a creature, hostile, boss or *', building: 'a building or *', spawnat: 'here (next to you), me, * or a player', command: 'a command name' };
    const described = spec.filter(k => typeof k === 'string' && kinds[k]).map(k => kinds[k]);
    if (described.length) this.print(`   takes: ${[...new Set(described)].join(' · ')}`, 'dim');
    const ex = EXAMPLES[name] || [];
    if (ex.length) {
      this.print('   examples (click to use):', 'dim');
      for (const [line, what] of ex) {
        this.out.append(h('div.gc-row.gc-help', h('span.gc-time', ''),
          h('button.gc-example', { title: 'Put this on the command line', onclick: () => { this.input.value = line; this.input.focus(); this.refreshSuggestions(); } }, line),
          h('span.gc-help-desc', what)));
      }
      this.out.scrollTop = this.out.scrollHeight;
    }
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

  /** A player on your island, by name (any capitalisation, or the start of it). */
  /**
   * A player by name. Whoever is walking the island right now comes with a position; anyone else in the world
   * is still found (so you can pull them to you or play a trick on them), just without one.
   */
  playerSpot(name) {
    const want = String(name || '').toLowerCase();
    if (!want) return null;
    const match = list => list.find(p => (p.name || '').toLowerCase() === want) || list.find(p => (p.name || '').toLowerCase().startsWith(want));
    const live = match(this.game?.livePlayers || []);
    if (live) return live;
    const mp = this.mp || this.hud?.mp;
    const known = match((mp?.players || []).filter(p => p.uid !== mp?.uid));
    return known ? { uid: known.uid, name: known.name, away: true, online: !!known.online } : null;
  }

  async run(line) {
    const [cmd, ...args] = tokenize(line);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (!fn) throw new Error(`unknown command "${cmd}" — try "help"`);
    await fn.run.call(this, args);
  }

  async loadPlayers(force = false) {
    if (!this.players || force) {
      // the world you are playing in (a private world keeps its players apart from the public realm)
      try { this.players = await api.fetchPlayers(this.mp?.world || 'realm'); } catch (e) { this.players ||= []; }
      // live presence always knows who is here, even if a list could not be read
      for (const p of this.mp?.players || []) if (!this.players.some(x => x.uid === p.uid)) this.players.push({ ...p });
    }
    return this.players;
  }

  /** Like resolve, but "*" (or "all") means every player, you included. */
  async resolveMany(query) {
    if (query === '*' || query === 'all') {
      const me = { me: true, uid: this.user.uid, villageName: this.game.state.owner.villageName };
      let list = [];
      try { list = await this.loadPlayers(true); } catch (e) { this.print(`could not load other players (${e.message}); applying to your village only`, 'warn'); }
      return [me, ...list.filter(p => p.uid !== this.user.uid)];
    }
    return [await this.resolve(query)];
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
    usage: 'help [command | word | all]', desc: 'How to use the console: groups of commands, one command in detail with examples, or a search',
    run([word, ...more]) {
      const q = [word, ...more].filter(Boolean).join(' ').toLowerCase();
      // one command: what it does, how to type it, examples you can click
      if (q && COMMANDS[q]) { this.explain(q); return; }
      // anything else: search names, descriptions and examples
      if (q && q !== 'all') {
        const hits = Object.entries(COMMANDS).filter(([k, c]) => `${k} ${c.usage} ${c.desc} ${(EXAMPLES[k] || []).map(e => e[0]).join(' ')}`.toLowerCase().includes(q));
        if (!hits.length) throw new Error(`nothing matches "${q}". Try: help, help give, help monster`);
        this.print(`${hits.length} command${hits.length === 1 ? '' : 's'} about "${q}":`, 'accent');
        for (const [k, c] of hits) this.helpRow(k, c);
        this.print('Click a command name for its details.', 'dim');
        return;
      }
      this.print('HEARTBORN ADMIN CONSOLE', 'accent');
      this.print('Type a command and press Enter. Tab completes, ↑↓ pick a suggestion or an old command, Esc or F2 closes.', 'dim');
      this.print('Players: "me" is you, "*" is everyone, or type a village or player name. In a dungeon, hero commands act down there.', 'dim');
      const groups = {};
      for (const [k, c] of Object.entries(COMMANDS).sort(([a], [b]) => commandRank(a) - commandRank(b))) (groups[groupOfCommand(k)] ||= []).push([k, c]);
      for (const g of COMMAND_GROUPS) {
        if (!groups[g]) continue;
        this.print('');
        this.print(`■ ${g.toUpperCase()}  ·  ${GROUP_INFO[g] || ''}`, 'accent');
        for (const [k, c] of groups[g]) this.helpRow(k, c);
      }
      this.print('');
      this.print('help <command> shows examples (help spawn) · help <word> searches (help loot) · click any command or example to use it', 'dim');
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
    usage: 'give <player|me|*> <res|*> <n> [<res> <n>…]', desc: 'Give resources (* = every resource / every player)',
    async run([who, ...pairs]) {
      const targets = await this.resolveMany(who);
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
      for (const p of targets) {
        if (p.me) { for (const [k, v] of Object.entries(res)) this.game.state.resources[k] = Math.max(0, (this.game.state.resources[k] || 0) + v); this.game.emit('change'); }
        else await api.sendCommand(p.uid, { type: 'give', res });
      }
      this.print(`✓ gave ${Object.entries(res).map(([k, v]) => `${v} ${k}`).join(', ')} to ${targets.length === 1 ? targets[0].villageName : `${targets.length} villages`}`, 'ok');
    },
  },
  karma: {
    usage: 'karma <player|me|*> <n>', desc: 'Set karma',
    async run([who, value]) {
      const n = Number(value);   // admins may go past the normal -100..100
      if (Number.isNaN(n)) throw new Error('karma needs a number');
      const targets = await this.resolveMany(who);
      for (const p of targets) {
        if (p.me) { this.game.state.karma = n; this.game.emit('change'); }
        else await api.sendCommand(p.uid, { type: 'karma', value: n });
      }
      this.print(`✓ karma of ${targets.length === 1 ? targets[0].villageName : `${targets.length} villages`} → ${n}`, 'ok');
    },
  },
  shield: {
    usage: 'shield <player|me|*> <hours>', desc: 'Protect from attacks',
    async run([who, hours]) {
      const hrs = Number(hours) || 24;
      const targets = await this.resolveMany(who);
      for (const p of targets) {
        if (p.me) this.game.state.shieldUntil = Date.now() + hrs * 3600000;
        else await api.sendCommand(p.uid, { type: 'shield', hours: hrs });
      }
      this.print(`✓ ${hrs}h shield for ${targets.length === 1 ? targets[0].villageName : `${targets.length} villages`}`, 'ok');
    },
  },
  msg: {
    usage: 'msg <player|*> <text…>', desc: 'Private message banner',
    async run([who, ...words]) {
      const text = words.join(' ');
      if (!text) throw new Error('message is empty');
      const targets = (await this.resolveMany(who)).filter(p => !p.me);
      for (const p of targets) await api.sendCommand(p.uid, { type: 'message', text });
      this.print(`✓ message queued for ${targets.length === 1 ? targets[0].villageName : `${targets.length} players`}`, 'ok');
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
    feature: 'storyEvents',
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
    usage: 'spawn <creature|*|hostile|boss> [count] [here|me|<player>|*]', desc: 'Spawn creatures next to you (here), as raiders on a village, or at other players',
    async run([type, count = '1', target = 'here']) {
      const kinds = type === '*' ? Object.keys(CREATURES)
        : type === 'hostile' ? Object.keys(CREATURES).filter(k => CREATURES[k].hostile && !CREATURES[k].boss)
          : type === 'boss' ? Object.keys(CREATURES).filter(k => CREATURES[k].boss) : [type];
      if (!CREATURES[kinds[0]]) throw new Error(`unknown creature (${Object.keys(CREATURES).join(', ')})`);
      const n = Math.max(1, Math.min(200, Math.floor(Number(count) || 1)));
      if (target === 'here') {   // right around your hero, wherever you are (a dungeon too)
        const g = this.hud?.dungeon || this.game;
        const v = heroOf(g);
        if (!v) throw new Error('no hero to spawn next to');
        let made = 0;
        for (const k of kinds) for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, r = 64 + Math.random() * 64;
          const x = v.x + Math.cos(a) * r, y = v.y + Math.sin(a) * r;
          if (g.world.walkable(x, y) || CREATURES[k].flying) { g.spawnCreature(k, x, y, { hx: x, hy: y }); made++; }
        }
        this.print(`✓ ${made} spawned next to you`, 'ok');
        return;
      }
      const targets = await this.resolveMany(target);
      for (const p of targets) for (const k of kinds) {
        if (p.me) this.game.spawnRaiders(k, n);
        else await api.sendCommand(p.uid, { type: 'spawn', creature: k, count: n });
      }
      this.print(`✓ ${n} ${type === '*' ? `of each of ${kinds.length} creatures` : type} → ${targets.length === 1 ? targets[0].villageName : `${targets.length} villages`}`, 'ok');
    },
  },
  warband: {
    usage: 'warband [soldiers] [seconds]', desc: 'Send a barbarian army at your village',
    run([count = '4', secs = '60']) {
      const s = this.game.state;
      s.incoming.push({ id: `w${Date.now().toString(36)}`, kind: 'warband', name: 'The Admin Horde', count: Math.max(1, Math.floor(Number(count) || 4)), scale: 1, arrivesAt: s.time + (Number(secs) || 60), warned: false });
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
    usage: 'reset <player|me> confirm', desc: 'Wipe a village and start it fresh (asks to confirm)',
    async run([who, confirm]) {
      const p = await this.resolve(who || 'me');
      if (confirm !== 'confirm') {
        this.print(`⚠ this wipes ${p.villageName} forever. Run: reset ${who} confirm`, 'warn');
        return;
      }
      if (p.me) {   // your own village: start over right here
        this.print(`✓ ${p.villageName} is being reset`, 'ok');
        if (this.hud?.onRestart) { this.toggle(); await this.hud.onRestart(); return; }
        throw new Error('reset me needs the game screen');
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
    feature: 'laws',
    usage: 'laws', desc: 'Show your laws',
    run() {
      const laws = this.game.state.laws || {};
      for (const c of LAW_CATEGORIES) this.print(`${c.name.padEnd(12)} ${c.options.find(o => o.id === laws[c.id])?.name || '—'}`);
    },
  },
  skip: {
    usage: 'skip <days>', desc: 'Fast-forward your village',
    run([days = '1']) {
      const d = Math.max(0.01, Number(days) || 1);
      const sum = this.game.simulate(DAY_LENGTH * d);
      this.game.emit('change');
      this.print(`✓ skipped ${d} day(s): pop ${sum.pop >= 0 ? '+' : ''}${sum.pop}, births ${sum.births}, deaths ${sum.deaths}`, 'ok');
    },
  },
  era: {
    usage: 'era [up|*|<0-5>]', desc: 'Change your era (* = the last era)',
    run([arg = 'up']) {
      const s = this.game.state;
      s.era = arg === '*' ? ERAS.length - 1 : arg === 'up' ? Math.min(ERAS.length - 1, s.era + 1) : Math.max(0, Math.min(ERAS.length - 1, Number(arg) || 0));
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

  person: {
    feature: 'people',
    usage: 'person [count|*] [name=Ada] [sex=m|f|*] [age=30] [job=mine|*] [skills=8|*] [combat=10 …] [traits=brave,strong|good|*] [calling=soldier|*] [trained] [versatile] [trade=mine|*] [hp=100|*] [happy=100|*] [strength=10] [speed=10] [stamina=10] [body=*] [size=2]',
    desc: 'Spawn villagers with the stats you choose (* = everything / the maximum)',
    run(args) {
      const g = this.game;
      const jobKeys = Object.keys(JOBS).filter(j => j !== 'idle' && j !== 'prisoner');
      // "person *" = one of every job
      const everyJob = args[0] === '*';
      const count = everyJob ? (args.shift(), jobKeys.length) : /^\d+$/.test(args[0] || '') ? Math.max(1, Number(args.shift())) : 1;
      const opts = {};
      for (const a of args) {
        const [k, ...rest] = a.split('=');
        opts[k.toLowerCase()] = rest.length ? rest.join('=') : true;
      }
      const num = (val, max) => (val === '*' ? max : Number(val));
      const cycle = (list, i) => list[i % list.length];
      const made = [];
      for (let i = 0; i < count; i++) {
        const v = g.addWanderer({ child: opts.age != null && Number(opts.age) < 12 });
        if (opts.name) v.name = count > 1 ? `${opts.name} ${i + 1}` : String(opts.name);
        if (opts.sex === 'm' || opts.sex === 'f') v.sex = opts.sex;
        else if (opts.sex === '*') v.sex = i % 2 ? 'f' : 'm';
        if (opts.age != null) v.age = Math.max(0, Number(opts.age) || 0);
        if (opts.skills != null) for (const s of Object.keys(v.skills)) v.skills[s] = num(opts.skills, 100) || 0;
        for (const s of Object.keys(v.skills)) if (opts[s] != null) v.skills[s] = num(opts[s], 100) || 0;
        // * is every personality trait; earned titles (knighted, veteran, gifted…) are only given when named, or with traits=all
        if (opts.traits === '*') v.traits = [...new Set([...v.traits.filter(t => TRAITS[t]?.earned), ...Object.keys(TRAITS).filter(t => !TRAITS[t].earned)])];
        else if (opts.traits === 'all') v.traits = Object.keys(TRAITS);
        else if (opts.traits === 'good') v.traits = Object.keys(TRAITS).filter(t => TRAITS[t].good && !TRAITS[t].earned);
        else if (opts.traits) v.traits = String(opts.traits).split(',').filter(t => TRAITS[t]);
        if (opts.calling === '*') v.calling = cycle(Object.keys(CALLINGS).filter(c => c !== 'none'), i);
        else if (opts.calling && CALLINGS[opts.calling]) v.calling = opts.calling;
        if (opts.trained) v.trained = true;
        if (opts.hp != null) v.hp = Math.max(1, num(opts.hp, 100000) || 100);   // admin heroes may go past 100
        if (opts.happy != null) v.happy = num(opts.happy, 100) || 0;
        if (opts.size != null) v.size = Math.max(0.3, Math.min(8, Number(opts.size) || 1));   // how big they are drawn (1 = normal)
        for (const k of ['strength', 'speed', 'stamina']) {   // body stats, 1-10
          const val = opts[k] ?? opts.body;
          if (val != null) v.body = { ...v.body, [k]: val === '*' ? 10 : Math.max(1, Number(val) || 5) };
        }
        if (opts.versatile || opts.trade === '*') v.traits = [...new Set([...v.traits, 'versatile'])];
        if (opts.trade && JOBS[opts.trade]) { v.profession = opts.trade; if (!opts.job) assignJob(g, v, opts.trade, true); }   // a new trade means new work (and a new look)
        const job = opts.job === '*' || (everyJob && !opts.job) ? cycle(jobKeys, i) : opts.job;
        if (job && JOBS[job]) { if (!opts.trade && !opts.versatile && !v.traits.includes('versatile')) v.profession = job === 'recruit' ? 'warrior' : job; assignJob(g, v, job, true); }   // not a "personal order": the Steward/office may still move them
        made.push(v);
      }
      const bad = Object.keys(opts).filter(k => !['name', 'sex', 'age', 'skills', 'traits', 'calling', 'trained', 'hp', 'happy', 'job', 'trade', 'versatile', 'strength', 'speed', 'stamina', 'body', 'size'].includes(k) && !(k in made[0].skills));
      g.recalc();
      g.emit('change');
      this.print(`✓ spawned ${made.length}: ${made.slice(0, 5).map(v => `${v.name} (${v.sex}, ${Math.floor(v.age)}, ${v.job})`).join(', ')}${made.length > 5 ? '…' : ''}`, 'ok');
      if (bad.length) this.print(`ignored unknown options: ${bad.join(', ')} — skills are ${Object.keys(made[0].skills).join(', ')}; traits: ${Object.keys(TRAITS).join(', ')}`, 'warn');
    },
  },
  item: {
    feature: 'people',
    usage: 'item <item|*> [count] [villager name | all | * | selected]', desc: 'Drop items into villagers’ packs (* = every item / everyone)',
    run([key, count = '1', ...who]) {
      const g = this.game;
      if (!key || key === 'list') { this.table(Object.entries(ITEMS).map(([k, i]) => ({ item: k, name: i.label, does: i.desc || i.slot || '' })), ['item', 'name', 'does']); return; }
      const keys = key === '*' ? Object.keys(ITEMS) : [key];
      if (!ITEMS[keys[0]]) throw new Error(`unknown item (item list): ${Object.keys(ITEMS).join(', ')}`);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      const target = who.join(' ').toLowerCase() || 'selected';
      let people;
      if (target === 'all' || target === '*') people = g.state.villagers;
      else if (target === 'selected') people = g.selected?.kind === 'villager' ? [g.selected.ref] : [];
      else people = g.state.villagers.filter(v => v.name.toLowerCase() === target || v.name.toLowerCase().startsWith(target)).slice(0, 1);
      if (!people.length) throw new Error(target === 'selected' ? 'click a villager first, or name one: item potion 3 Ada' : `no villager called "${target}"`);
      for (const v of people) for (const k of keys) addItem(v, k, n);
      g.emit('change');
      this.print(`✓ ${n} × ${keys.length > 1 ? `every item (${keys.length})` : ITEMS[key].label} → ${people.length === 1 ? people[0].name : `${people.length} villagers`}`, 'ok');
    },
  },

  gear: {
    usage: 'gear <kind|slot|*> [mythic|legendary|epic|rare|common|*] [count] [equip] (admin weapons are always Admin rarity)', desc: 'Give yourself weapons, shields, helmets, armour and trinkets (gear list shows them all with their pictures)',
    run([kind, rarityArg = 'common', count = '1', flag]) {
      const g = this.game;
      if (!kind || kind === 'list') {
        for (const [slot, list] of Object.entries(CATALOG)) {   // every kind, with its picture
          this.print(slot.toUpperCase(), 'accent');
          this.out.append(h('div.gc-gear-grid', Object.entries(list).filter(([, d]) => d.icon !== null && (!d.noLoot || d.admin)).map(([k, d]) => h('div.gc-gear', { title: d.name },
            icon(gearIconKey({ base: k, slot, icon: d.icon }) || 'items/relic', 26), h('b', k), h('span.gc-item-detail', d.dmg ? `${d.dmg} dmg` : d.block ? `blocks ${Math.round(d.block * 100)}%` : d.armor ? `${Math.round(d.armor * 100)}% armour` : Object.keys(d.bonus || {}).join(', '))))));
        }
        this.out.scrollTop = this.out.scrollHeight;
        return;
      }
      if (flag === undefined && ['equip'].includes(count)) { flag = count; count = '1'; }
      const names = ['common', 'rare', 'epic', 'legendary', 'mythic'];
      const rarities = rarityArg === '*' ? [0, 1, 2, 3, 4] : [Math.max(0, names.indexOf(rarityArg)) + (/^\d$/.test(rarityArg) ? Number(rarityArg) : 0)];
      const kinds = kind === 'admin' ? Object.keys(CATALOG.weapon).filter(k => CATALOG.weapon[k].admin)
        : kind === '*' ? Object.values(CATALOG).flatMap(list => Object.keys(list).filter(k => !list[k].admin))
        : CATALOG[kind] ? Object.keys(CATALOG[kind])
          : [kind];
      const valid = kinds.filter(k => Object.values(CATALOG).some(list => list[k] && list[k].icon !== null && (!list[k].noLoot || list[k].admin)));
      if (!valid.length) throw new Error(`unknown gear "${kind}" (try: gear list)`);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      const v = heroOf(g);
      const given = [];
      for (const k of valid) for (const r of rarities) for (let i = 0; i < n; i++) {
        const it = makeGear(g, k, r);
        takeGear(g, it, v);
        if (flag === 'equip') equip(g, it.id);
        given.push(it);
      }
      g.emit('change');
      // show what arrived, with pictures
      const rows = given.slice(0, 12).map(it => h('div.gc-gear', icon(gearIconKey(it) || 'items/relic', 22), h('b', { style: { color: RARITY[it.rarity].color } }, it.name), h('span.gc-item-detail', it.dmg ? ` damage` : it.block ? `blocks ${Math.round(it.block * 100)}%` : it.armor ? `${Math.round(it.armor * 100)}% armour` : '')));
      this.print(`✓ ${given.length} piece${given.length === 1 ? '' : 's'} of gear${flag === 'equip' ? ' (equipped)' : ''}${given.length > 12 ? `, showing 12` : ''}`, 'ok');
      this.out.append(h('div.gc-gear-list', rows));
      this.out.scrollTop = this.out.scrollHeight;
    },
  },

  missile: {
    feature: 'missiles',
    usage: 'missile <nuke|missile|orbital> <me|player>', desc: 'Aim a free strike anywhere: your own land or any realm (ignores shields), then watch it fly on the World Map',
    async run([kind = 'missile', ...who]) {
      if (!STRIKE_KINDS[kind]) { who.unshift(kind); kind = 'missile'; }
      const k = STRIKE_KINDS[kind];
      const target = who.join(' ') || 'me';
      const [p] = await this.resolveMany(target);
      if (!p) throw new Error(`no realm called "${target}"`);
      if (p.me) {
        if (this.open) this.toggle();   // get the console out of the way of the targeting map
        openAimMap(this.game, {
          title: `${k.label}: your own land`, orbital: !!k.orbital, radius: k.radius, fireLabel: 'Fire',
          note: `Admin strike: free, ${k.radius} tile blast.`,
          onFire: aim => {
            adminStrike(this.game, kind, aim);
            if (this.hud) Object.assign(this.hud.renderer.camera, { x: (aim.tx + 0.5) * 32, y: (aim.ty + 0.5) * 32 });
          },
        });
        return;
      }
      if (!this.mp) throw new Error('striking another realm needs multiplayer');
      const profile = await getProfile(p.uid);
      const land = makeVisitGame({ ...profile, uid: p.uid });
      if (this.open) this.toggle();
      openAimMap(land, {
        title: `${k.label}: ${p.villageName}`, orbital: !!k.orbital, radius: k.radius, fireLabel: 'Launch',
        note: `Admin strike: free, ignores shields, lands in about 20 seconds. ${k.radius} tile blast.`,
        onFire: async aim => {
          await this.mp.launchMission(p.uid, kind, aim, { admin: true, radius: k.radius });
          this.print(`✓ ${k.label} launched at ${p.villageName}`, 'ok');
          this.hud?.openMap();   // watch it fly
        },
      });
    },
  },
  items: {
    usage: 'items <item|*> [count]', desc: 'Give potions, bombs and other consumables: items bomb 10, items * 5',
    async run([key, count = '1']) {
      const C = await import('../game/consumables.js');
      if (!key) throw new Error(`items <item|*> [count]. Items: ${Object.keys(C.CONSUMABLES).join(', ')}`);
      const keys = key === '*' ? Object.keys(C.CONSUMABLES) : [key];
      if (!C.CONSUMABLES[keys[0]]) throw new Error(`unknown item. Items: ${Object.keys(C.CONSUMABLES).join(', ')}`);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      for (const k of keys) C.giveItem(this.game, k, n);
      this.print(`✓ ${n} × ${keys.length > 1 ? 'every item' : C.CONSUMABLES[key].name} (in your hotbar and Inventory)`, 'ok');
    },
  },
  tool: {
    usage: 'tool <tool|kind|*> [count]', desc: 'Give tools for your inventory: tool pickaxe_diamond, tool axe (every axe), tool * (one of everything)',
    async run([key, count = '1']) {
      const T = await import('../game/tools.js');
      if (!key) throw new Error(`tool <tool|kind|*> [count]. Tools: ${Object.keys(T.TOOLS).join(', ')}`);
      const keys = key === '*' ? Object.keys(T.TOOLS) : T.TOOLS[key] ? [key] : Object.keys(T.TOOLS).filter(k => T.TOOLS[k].kind === key);
      if (!keys.length) throw new Error(`unknown tool. Tools: ${Object.keys(T.TOOLS).join(', ')}`);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      for (const k of keys) T.giveTool(this.game, k, n);
      this.print(`✓ gave ${keys.length > 1 ? `${keys.length} tools` : T.TOOLS[keys[0]].name}${n > 1 ? ` ×${n}` : ''} (open your Inventory with I)`, 'ok');
    },
  },
  get: {
    usage: 'get <anything> [count] [rarity] [equip]', desc: 'Give yourself anything: gear (get katana 1 legendary equip), tools, items and potions, resources and materials, pets (get pet:dragon), eggs, or all-gear / all-tools / all-items / all-pets / all-materials',
    async run([what, ...rest]) {
      if (!what) throw new Error('get <anything> [count] [rarity] [equip] (start typing to see everything)');
      const g = this.game, v = heroOf(g);
      const num = rest.find(x => /^\d+$/.test(x));
      const n = Math.max(1, Math.min(9999, Number(num) || 1));
      const rarityName = rest.find(x => ['common', 'rare', 'epic', 'legendary', 'mythic'].includes(x));
      const rarity = rarityName ? ['common', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarityName) : null;
      const equipIt = rest.includes('equip');
      const T = await import('../game/tools.js');
      const C = await import('../game/consumables.js');
      const P = await import('../game/pets.js');
      const F = await import('../game/forging.js');
      const got = [];
      const giveGear = (base, slot) => { const d = CATALOG[slot][base]; const it = makeGear(g, base, d.admin ? 5 : rarity ?? Math.max(d.minRarity || 0, 0)); takeGear(g, it, v); if (equipIt) equip(g, it.id); got.push({ name: it.name, icon: gearIconKey(it), color: RARITY[it.rarity].color }); };
      const givePet = k => { const r = P.petsOf(g); const pet = { id: `pet${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, kind: k, name: P.PETS[k].name }; r.pets.push(pet); r.pet = pet.id; got.push({ name: pet.name, icon: P.PETS[k].sprite }); };
      if (what === 'all-gear') { for (const [slot, list] of Object.entries(CATALOG)) for (const [k, d] of Object.entries(list)) if (d.icon !== null && !d.noLoot && !d.admin) giveGear(k, slot); }
      else if (what === 'all-tools') { for (const k of Object.keys(T.TOOLS)) { T.giveTool(g, k, n); got.push({ name: T.TOOLS[k].name, icon: T.TOOLS[k].icon }); } }
      else if (what === 'all-items') { for (const k of Object.keys(C.CONSUMABLES)) { C.giveItem(g, k, n); got.push({ name: `${n} x ${C.CONSUMABLES[k].name}`, icon: C.CONSUMABLES[k].icon }); } }
      else if (what === 'all-pets') { for (const k of Object.keys(P.PETS)) givePet(k); }
      else if (what === 'all-materials') { for (const k of F.FORGE_KEYS) { g.state.resources[k] = (g.state.resources[k] || 0) + (num ? n : 50); } got.push({ name: `${num ? n : 50} of every material` }); }
      else if (what === 'book' || what === 'books' || what.startsWith('book:')) { const E = await import('../game/enchanting.js'); const k = what.split(':')[1]; if (k && !E.ENCHANTS[k]) throw new Error(`no enchantment "${k}"`); for (let i = 0; i < Math.min(n, 50); i++) { const bk = E.newBook(g, k || null, k ? E.ENCHANTS[k].max : null); got.push({ name: `Book: ${E.enchName(bk.key, bk.level)}`, icon: `books/book_${bk.key}` }); } }
      else if (what === 'egg' || what === 'eggs') { P.giveEgg(g, n); got.push({ name: `${n} pet egg${n > 1 ? 's' : ''}`, icon: 'pets/egg_common' }); }
      else if (what === 'potion' || what === 'potions') { rpgOf(g).potions = (rpgOf(g).potions || 0) + n; got.push({ name: `${n} Health Potion${n > 1 ? 's' : ''}`, icon: 'gear/health_potion' }); }
      else if (what.startsWith('pet:') || (P.PETS[what] && !T.TOOLS[what])) { const k = what.replace(/^pet:/, ''); if (!P.PETS[k]) throw new Error(`no pet "${k}" (pets: ${Object.keys(P.PETS).join(', ')})`); for (let i = 0; i < Math.min(n, 20); i++) givePet(k); }
      else if (T.TOOLS[what]) { T.giveTool(g, what, n); got.push({ name: `${n > 1 ? n + ' x ' : ''}${T.TOOLS[what].name}`, icon: T.TOOLS[what].icon }); }
      else if (C.CONSUMABLES[what]) { C.giveItem(g, what, n); got.push({ name: `${n} x ${C.CONSUMABLES[what].name}`, icon: C.CONSUMABLES[what].icon }); }
      else if (RESOURCES.includes(what)) { g.state.resources[what] = (g.state.resources[what] || 0) + (num ? n : 100); got.push({ name: `${num ? n : 100} ${what}`, icon: RES_ICON[what] }); }
      else {
        const slot = Object.keys(CATALOG).find(s => CATALOG[s][what]);
        if (!slot) throw new Error(`nothing called "${what}". Start typing to see everything you can get.`);
        for (let i = 0; i < Math.min(n, 50); i++) giveGear(what, slot);
      }
      g.emit('change');
      this.print(`✓ got ${got.length > 1 ? `${got.length} things` : got[0]?.name || what}${equipIt ? ' (equipped)' : ''}`, 'ok');
      if (got.length > 1 || got[0]?.icon) {
        this.out.append(h('div.gc-gear-list', got.slice(0, 16).map(x => h('div.gc-gear', x.icon ? icon(x.icon, 22) : null, h('b', x.color ? { style: { color: x.color } } : {}, x.name)))));
        if (got.length > 16) this.print(`…and ${got.length - 16} more`, 'dim');
        this.out.scrollTop = this.out.scrollHeight;
      }
    },
  },
  enchant: {
    usage: 'enchant <enchantment|*|random|roll|book|clear|list|menu> [level] [weapon|armor|helmet|shield|tool]', desc: 'Enchant your worn gear or held tool for free: enchant sharpness 5, enchant fortune 3 tool, enchant * (everything maxed), enchant roll (with the animation), enchant book vampirism 3 (or enchant book random 1 10), enchant clear weapon, enchant menu',
    async run([key = 'list', a, b]) {
      const E = await import('../game/enchanting.js');
      const T = await import('../game/tools.js');
      const g = this.game, r = rpgOf(g);
      if (key === 'list') { for (const [k, e] of Object.entries(E.ENCHANTS)) this.print(`${k} · ${e.name} · max ${e.max} · ${e.for.join('/')} · ${e.desc(e.max)}`); return; }
      if (key === 'menu') { if (!this.hud) throw new Error('no game screen'); this.toggle(); const M = await import('./enchantMenu.js'); M.openEnchantMenu(this.hud); return; }
      if (key === 'book' || key === 'books') {   // enchant book [enchantment] [level] [count]
        if (a && a !== 'random' && !E.ENCHANTS[a]) throw new Error(`unknown enchantment. Try: ${Object.keys(E.ENCHANTS).join(', ')}`);
        const lv = /^\d+$/.test(b || '') ? Number(b) : null;
        const n = Math.min(50, Number(arguments[0][3]) || 1);
        const made = [];
        for (let i = 0; i < n; i++) made.push(E.newBook(g, a && a !== 'random' ? a : null, lv ?? (a && a !== 'random' ? E.ENCHANTS[a].max : null)));
        this.print(`✓ ${made.length} book${made.length > 1 ? 's' : ''}: ${made.map(x => E.enchName(x.key, x.level)).join(', ')}`, 'ok'); return;
      }
      if (key === 'roll') {   // enchant roll: the real roll with its animation, free
        const t = (where ? [targetFor(where)] : [targetFor('weapon') || heldTool()]).filter(Boolean)[0];
        if (!t) throw new Error('equip something or hold a tool');
        const set = E.rollEnchantSet(g, t);
        const have = E.enchantsOf(g, t);
        for (const k of Object.keys(have)) delete have[k];
        for (const x of set) have[x.key] = x.level;
        g.emit('change'); this.toggle();
        const M = await import('./enchantMenu.js'); await M.rollReel(set, { title: `Enchanting ${nameOf(t)}` }); return;
      }
      const level = /^\d+$/.test(a || '') ? Number(a) : null;
      const where = level == null ? a : b;
      const heldTool = () => { const k = T.hotbarOf(g)[r.hotSel]; const key2 = T.TOOLS[k] && !T.TOOLS[k].utility ? k : Object.keys(T.toolsOf(g)).find(x => T.TOOLS[x] && !T.TOOLS[x].utility); return key2 ? { tool: key2 } : null; };
      const targetFor = w => (w === 'tool' ? heldTool() : r.gear[w] ? { item: r.gear[w] } : null);
      const nameOf = t => (t.tool ? T.TOOLS[t.tool].name : t.item.name);
      const all = () => [...['weapon', 'armor', 'helmet', 'shield'].map(targetFor), heldTool()].filter(Boolean);
      if (key === '*') {
        let n = 0;
        for (const t of all()) for (const [k, e] of Object.entries(E.ENCHANTS)) if (e.for.includes(E.targetKind(t))) { E.enchantsOf(g, t)[k] = e.max; n++; }
        g.emit('change');
        this.print(n ? `✓ ${n} enchantments at max on your gear and tool` : '✗ nothing to enchant (equip gear or hold a tool)', n ? 'ok' : 'err');
        return;
      }
      const targets = where ? [targetFor(where)].filter(Boolean) : null;
      if (key === 'clear') {
        for (const t of targets || all()) { if (t.tool) delete r.toolEnch?.[t.tool]; else delete t.item.ench; }
        g.emit('change'); this.print(`✓ enchantments removed${where ? ` from ${where}` : ' from all your gear and tool'}`, 'ok'); return;
      }
      if (key === 'random') {
        const t = (targets || [targetFor('weapon') || heldTool()])[0];
        if (!t) throw new Error('equip something or hold a tool');
        const set = E.rollEnchantSet(g, t, 1);
        const have = E.enchantsOf(g, t);
        for (const k of Object.keys(have)) delete have[k];
        for (const e of set) have[e.key] = e.level;
        g.emit('change');
        this.print(`✓ new set on ${nameOf(t)}: ${set.map(e => E.enchName(e.key, e.level)).join(', ')}`, 'ok'); return;
      }
      const e = E.ENCHANTS[key];
      if (!e) throw new Error(`unknown enchantment (enchant list). Try: ${Object.keys(E.ENCHANTS).join(', ')}`);
      const t = (targets || [e.for.includes('tool') ? heldTool() : e.for.map(targetFor).find(Boolean)])[0];
      if (!t) throw new Error(`nothing to put ${e.name} on: ${e.for.includes('tool') ? 'hold a tool' : `equip a ${e.for.join(' or ')}`}`);
      if (!e.for.includes(E.targetKind(t))) throw new Error(`${e.name} only goes on ${e.for.join('/')}`);
      const res = E.enchant(g, t, { force: { key, level: level ?? e.max } });
      this.print(res.ok ? `✓ ${E.enchName(res.key, res.level)} on ${nameOf(t)}` : `✗ ${res.why}`, res.ok ? 'ok' : 'err');
    },
  },
  troll: {
    usage: 'troll <player> <freeze|launch|boom|spook|bring|goto|swap|mobs|say ...>', desc: 'Have a laugh with someone in your world: freeze them, launch them, spook them, pull them to you, swap places, or drop monsters on them. "troll list" shows who is here.',
    async run([who, what = 'spook', ...rest]) {
      const g = this.game;
      const mp = this.mp || this.hud?.mp;
      if (!mp) throw new Error('this only works in a world you share with others');
      const here = (g.livePlayers || []);
      if (!who || who === 'list') {
        for (const p of here) this.print(`${p.name} · ${Math.round(Math.hypot(p.x - (heroOf(g)?.x || 0), p.y - (heroOf(g)?.y || 0)) / 32)} tiles away`);
        const names = new Set(here.map(p => p.name));
        for (const p of (mp.players || [])) {
          if (p.uid === mp.uid || names.has(p.name)) continue;
          this.print(`${p.name} · ${p.online ? 'in the world, not on the island' : 'offline'}`);
        }
        if (!here.length && (mp.players || []).length <= 1) this.print('nobody else is in this world right now');
        return;
      }
      const spot = this.playerSpot(who);
      if (!spot) throw new Error(`no player called "${who}" on this island (troll list)`);
      const me = heroOf(this.hud?.dungeon || g);
      if (what === 'bring') { mp.sendCommand(spot.uid, { t: 'tp', x: Math.round(me.x), y: Math.round(me.y) }); this.print(`✓ ${spot.name} is on their way to you`, 'ok'); return; }
      if ((what === 'goto' || what === 'swap' || what === 'mobs') && spot.away) throw new Error(`${spot.name} is not on the island right now: bring, freeze, boom, spook and say still work`);
      if (what === 'goto') { me.x = spot.x; me.y = spot.y; if (this.hud) Object.assign(this.hud.renderer.camera, { x: me.x, y: me.y }); this.print(`✓ you are standing on ${spot.name}`, 'ok'); return; }
      if (what === 'swap') {
        const mx = me.x, my = me.y;
        me.x = spot.x; me.y = spot.y;
        if (this.hud) Object.assign(this.hud.renderer.camera, { x: me.x, y: me.y });
        mp.sendCommand(spot.uid, { t: 'tp', x: Math.round(mx), y: Math.round(my) });
        this.print(`✓ swapped places with ${spot.name}`, 'ok'); return;
      }
      if (what === 'mobs') {
        const n = Math.min(12, Number(rest[0]) || 4);
        let made = 0;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, d = 48 + Math.random() * 40;
          if (g.spawnCreature('zombie', spot.x + Math.cos(a) * d, spot.y + Math.sin(a) * d)) made++;
        }
        mp.sendCommand(spot.uid, { t: 'spook' });
        this.print(made ? `✓ ${made} zombies around ${spot.name}` : '✗ nowhere to put them', made ? 'ok' : 'err'); return;
      }
      if (what === 'say') {
        const text = rest.join(' ');
        if (!text) throw new Error('troll <player> say <what to tell them>');
        mp.sendCommand(spot.uid, { t: 'say', text });
        this.print(`✓ told ${spot.name}: ${text}`, 'ok'); return;
      }
      if (!['freeze', 'launch', 'boom', 'spook'].includes(what)) throw new Error('troll <player> <freeze|launch|boom|spook|bring|goto|swap|mobs|say>');
      mp.sendCommand(spot.uid, { t: what, s: Number(rest[0]) || undefined });
      this.print(`✓ ${what} on ${spot.name}`, 'ok');
    },
  },
  map: {
    usage: 'map <open|reveal|hide|markers|clear>', desc: 'The island map: open it, reveal the whole island or forget it (map hide), list markers, or remove them all (map clear)',
    async run([what = 'open']) {
      const M = await import('./islandMap.js');
      const g = this.game;
      if (what === 'open') { if (!this.hud) throw new Error('no game screen'); this.toggle(); M.openIslandMap(this.hud); return; }
      if (what === 'reveal') { M.revealAll(g, true); this.print('✓ the whole island is on your map', 'ok'); return; }
      if (what === 'hide') { M.revealAll(g, false); this.print('✓ map forgotten (only the land around you is left)', 'ok'); return; }
      if (what === 'markers') { const l = M.markersOf(g); if (!l.length) this.print('no markers'); for (const m of l) this.print(`${m.label} · ${Math.round(m.x)}, ${Math.round(m.y)}${g.state.track === m.id ? ' · tracking' : ''}`); return; }
      if (what === 'clear') { g.state.markers = []; g.state.track = null; g.emit('change'); this.print('✓ markers removed', 'ok'); return; }
      throw new Error('map <open|reveal|hide|markers|clear>');
    },
  },
  station: {
    usage: 'station <enchanting|crafting|market>', desc: 'Place an Enchanting Table, Crafting Table or Market Stall right next to you',
    run([kind = 'enchanting']) {
      const g = this.game;
      const type = kind.startsWith('craft') ? 'crafting_table' : kind.startsWith('market') || kind === 'shop' ? 'market_stall' : 'enchanting_table';
      const v = heroOf(g);
      if (!v) throw new Error('you need to be playing your hero');
      const tx = Math.floor(v.x / 32), ty = Math.floor(v.y / 32);
      const era = g.state.era;
      for (const [k, n] of Object.entries(BUILDING_DEFS[type].cost)) g.state.resources[k] = (g.state.resources[k] || 0) + n;
      let placed = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [1, 1], [-1, 1], [2, 1]]) {
        g.state.era = Math.max(era, BUILDING_DEFS[type].era);
        const r = g.placeBuilding(type, tx + dx, ty + dy);
        g.state.era = era;
        if (r?.ok) { placed = r.building; break; }
      }
      if (!placed) throw new Error('no free spot next to you');
      g.finishBuilding(placed);
      g.emit('change');
      this.print(`✓ ${BUILDING_DEFS[type].name} placed next to you (press E beside it)`, 'ok');
    },
  },
  pet: {
    usage: 'pet [open|egg n|give <kind>|hatch|list|clear]', desc: 'Pets: open the window, get eggs, give yourself a pet (chicken, rabbit, pig, slime, bat, wolf, forest_spirit, dragon), hatch an egg, list or remove all',
    async run([act = 'open', arg]) {
      const P = await import('../game/pets.js');
      const g = this.game, r = P.petsOf(g);
      if (act === 'egg') { P.giveEgg(g, Math.max(1, Number(arg) || 1)); this.print(`✓ ${r.eggs} eggs`, 'ok'); return; }
      if (act === 'give') {
        const kinds = arg === '*' ? Object.keys(P.PETS) : [arg];
        if (!kinds.every(k => P.PETS[k])) throw new Error(`pet give <kind>: ${Object.keys(P.PETS).join(', ')}`);
        for (const k of kinds) { const pet = { id: `pet${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, kind: k, name: P.PETS[k].name }; r.pets.push(pet); r.pet = pet.id; }
        g.emit('change'); this.print(`✓ ${kinds.map(k => P.PETS[k].name).join(', ')} (following you)`, 'ok'); return;
      }
      if (act === 'hatch') { const p = P.hatch(g); this.print(p ? `✓ hatched ${p.name}` : '✗ no eggs (pet egg 3)', p ? 'ok' : 'err'); return; }
      if (act === 'list') { this.print(`eggs ${r.eggs} · ${r.pets.map(p => p.name + (r.pet === p.id ? ' (following)' : '')).join(', ') || 'no pets'}`); return; }
      if (act === 'clear') { r.pets = []; r.pet = null; r.eggs = 0; g.emit('change'); this.print('✓ pets and eggs removed', 'ok'); return; }
      if (!this.hud) throw new Error('no game screen');
      this.toggle();
      const M = await import('./petsMenu.js'); M.openPets(this.hud);
    },
  },
  journal: {
    usage: 'journal [open|newday|finish|unlock|reset]', desc: 'Open the Journal, start a new day (new chest and challenges), finish today\'s challenges, unlock every achievement, or reset achievements',
    async run([act = 'open']) {
      const J = await import('../game/journal.js');
      const g = this.game, r = rpgOf(g);
      if (act === 'newday') { if (r.daily) r.daily.day = null; J.dailyOf(g); g.emit('change'); this.print(`✓ new day: ${r.daily.challenges.map(c => c.text).join(' · ')}`, 'ok'); return; }
      if (act === 'finish') { for (const c of J.dailyOf(g).challenges) c.have = c.need; g.emit('change'); this.print('✓ today\'s challenges are done (claim them in the Journal)', 'ok'); return; }
      if (act === 'unlock') { r.achievements ||= {}; for (const a of J.ACHIEVEMENTS) r.achievements[a.id] ||= Date.now(); g.emit('change'); this.print(`✓ all ${J.ACHIEVEMENTS.length} achievements unlocked`, 'ok'); return; }
      if (act === 'reset') { r.achievements = {}; r.title = null; g.emit('change'); this.print('✓ achievements reset', 'ok'); return; }
      if (!this.hud) throw new Error('no game screen');
      this.toggle();
      const M = await import('./journalMenu.js'); M.openJournal(this.hud);
    },
  },
  shop: {
    usage: 'shop [open|reroll|sellall]', desc: 'Open the Market Stall anywhere, give it new offers now, or sell every material you carry',
    async run([act = 'open']) {
      const S = await import('../game/shop.js');
      const g = this.game;
      if (act === 'reroll') { const s = S.shopOf(g, { reroll: true }); this.print(`✓ new offers: ${s.offers.map(o => S.offerName(o)).join(', ')}`, 'ok'); return; }
      if (act === 'sellall') { let gold = 0; for (const k of S.sellable(g)) gold += S.sell(g, k, 1e9).gold || 0; this.print(`✓ sold everything for ${gold} gold`, 'ok'); return; }
      if (!this.hud) throw new Error('no game screen');
      this.toggle();
      const M = await import('./shopMenu.js'); M.openShop(this.hud);
    },
  },
  trade: {
    usage: 'trade <player>', desc: 'Open the trade window with a player (multiplayer worlds)',
    async run([who]) {
      if (!this.hud) throw new Error('no game screen');
      if (!this.mp) throw new Error('trading works in multiplayer worlds');
      const p = await this.resolve(who);
      if (p.me) throw new Error("that's you");
      this.toggle();
      this.hud.tradeModal(p);
    },
  },
  trades: {
    usage: 'trades [accept|decline] [n]', desc: 'List the item trades waiting for you, or accept / decline one by number',
    async run([act, n = '1']) {
      if (!this.mp) throw new Error('trading works in multiplayer worlds');
      const list = this.mp.inbox.filter(o => o.type === 'itemtrade');
      const text = b => [...Object.entries(b?.res || {}).map(([k, v]) => `${v} ${k}`), ...(b?.gear || []).map(it => it.name), ...Object.entries(b?.tools || {}).map(([k, v]) => `${v} ${k}`)].join(', ') || 'nothing';
      if (!act) {
        if (!list.length) this.print('no trades waiting', 'dim');
        list.forEach((o, i) => this.print(`${i + 1}. ${o.fromName}: gives ${text(o.give)} · wants ${text(o.want)}`));
        return;
      }
      const o = list[Number(n) - 1];
      if (!o) throw new Error('no trade with that number (type trades)');
      await this.mp.respond(o, act === 'accept');
      this.print(`✓ trade ${act === 'accept' ? 'accepted' : 'declined'}`, 'ok');
    },
  },
  index: {
    usage: 'index [*|clear]', desc: 'Open your Index, fill it completely (*) or empty it (clear)',
    async run([arg]) {
      const g = this.game, r = rpgOf(g);
      if (arg === 'clear') { r.index = {}; g.emit('change'); this.print('✓ Index emptied', 'ok'); return; }
      if (arg === '*') {
        const O = await import('../data/objects.js'); const T = await import('../game/tools.js'); const F = await import('../game/forging.js');
        const idx = (r.index ||= {});
        const fill = (cat, keys) => { idx[cat] ||= {}; for (const k of keys) idx[cat][k] = Math.max(idx[cat][k] || 0, 1); };
        fill('ore', Object.keys(O.OBJECTS).filter(k => O.OBJECTS[k].work === 'mine'));
        fill('mob', Object.keys(O.CREATURES));
        fill('gear', Object.values(CATALOG).flatMap(l => Object.keys(l)));
        fill('tool', Object.keys(T.TOOLS));
        fill('mat', F.MATERIAL_KEYS);
        g.emit('change'); this.print('✓ everything is in your Index', 'ok'); return;
      }
      if (!this.hud) throw new Error('no game screen');
      this.toggle();
      const I = await import('./indexBook.js'); I.openIndex(this.hud);
    },
  },
  dungeon: {
    usage: 'dungeon [floor|leave]', desc: 'Go straight down into a dungeon at any floor (deeper floors are harder), or leave the one you are in',
    run([floor = '1']) {
      if (!this.hud) throw new Error('no game screen');
      if (floor === 'leave') { if (!this.hud.dungeon) throw new Error('you are not in a dungeon'); this.hud.leaveDungeon(); this.print('✓ back on the surface', 'ok'); return; }
      const n = Math.max(1, Math.min(99, Math.floor(Number(floor) || 1)));
      if (this.hud.visiting || this.game.sail) throw new Error('come home first');
      this.toggle();
      this.hud.enterDungeon(null, n);   // works from the surface and from inside a dungeon (it keeps the same cave mouth)
      this.print(`✓ floor ${n}`, 'ok');
    },
  },

  drop: {
    usage: 'drop <item|*> [count]', desc: 'Drop items on the ground at your cursor; walk over them to pick them up',
    run([key, count = '1']) {
      const g = this.hud?.dungeon || this.game;
      if (!key) throw new Error('drop <item|*> [count], e.g. drop sword 3');
      const keys = key === '*' ? Object.keys(ITEMS) : [key];
      if (!ITEMS[keys[0]]) throw new Error(`unknown item (item list): ${Object.keys(ITEMS).join(', ')}`);
      const at = this.hud?.dungeon ? heroOf(this.hud.dungeon) : g.cursor || g.center;
      const n = Math.max(1, Math.floor(Number(count) || 1));
      // several items fan out in a little circle so each one can be grabbed
      keys.forEach((k, i) => {
        const a = (i / keys.length) * Math.PI * 2, r = keys.length > 1 ? 14 + keys.length * 1.5 : 0;
        dropItem(g, k, n, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
      });
      this.print(`✓ dropped ${n} × ${keys.length > 1 ? `every item (${keys.length})` : ITEMS[key].label} at your cursor`, 'ok');
    },
  },

  errors: {
    usage: 'errors [n] | errors clear', desc: 'Crash reports sent from players’ devices',
    async run([arg]) {
      if (arg === 'clear') { await clearErrors(); this.print('✓ error reports cleared', 'ok'); return; }
      const list = await recentErrors(Number(arg) || 15);
      if (!list.length) { this.print('No error reports. Everything is running smoothly.', 'ok'); return; }
      for (const e of list) {
        this.print(`[${new Date(e.ts).toLocaleString()}] v${e.version} · ${e.where} · ${e.uid?.slice(0, 6)}…`, 'warn');
        this.print(`   ${e.message}`);
        if (e.stack) this.print(`   ${e.stack.split('\n')[1]?.trim() || ''}`, 'dim');
      }
    },
  },
  reports: {
    usage: 'reports [n] | reports clear', desc: 'Chat messages players reported',
    async run([arg]) {
      if (arg === 'clear') { await clearReports(); this.print('✓ reports cleared', 'ok'); return; }
      const list = await recentReports(Number(arg) || 15);
      if (!list.length) { this.print('No reports.', 'ok'); return; }
      this.table(list.map(r => ({ when: new Date(r.ts).toLocaleString(), player: r.targetName, message: r.text, reason: r.reason })), ['when', 'player', 'message', 'reason']);
      this.print('Ban with: ban <player> <reason>', 'dim');
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
  heal: {
    usage: 'heal', desc: 'Full health and stamina, cure poison, burning and slowness',
    run() {
      for (const g of [this.game, this.hud?.dungeon].filter(Boolean)) {
        const max = heroStats(g).maxHp;
        for (const v of g.state.villagers) { v.hp = Math.max(v.hp, v.id === g.hero?.id ? max : 100); v.sick = 0; v.hunger = 100; }
        if (g.hero) Object.assign(g.hero, { stamina: heroStats(g).maxStamina, dot: null, slow: null, stagger: 0 });
      }
      this.print('✓ healed', 'ok');
    },
  },
  god: {
    usage: 'god [on|off]', desc: 'Nothing can hurt you (toggles)',
    run([arg]) {
      const r = rpgOf(this.game);
      r.god = arg === 'on' ? true : arg === 'off' ? false : !r.god;
      this.print(`✓ god mode ${r.god ? 'ON: nothing can hurt you' : 'off'}`, 'ok');
    },
  },
  level: {
    usage: 'level <n> [points]', desc: 'Set your hero level (and give attribute points)',
    run([n, points]) {
      const lv = Math.max(1, Math.min(200, Math.floor(Number(n) || 0)));
      if (!Number(n)) throw new Error('usage: level 20');
      const r = rpgOf(this.game);
      const gained = Math.max(0, lv - r.level);
      Object.assign(r, { level: lv, xp: 0, points: r.points + (points != null ? Number(points) || 0 : gained) });
      this.game.emit('change');
      this.print(`✓ level ${lv}, ${r.points} point(s) to spend (G)`, 'ok');
    },
  },
  potions: {
    usage: 'potions <n>', desc: 'Set how many health potions you carry',
    run([n = '10']) { rpgOf(this.game).potions = Math.max(0, Math.floor(Number(n) || 0)); this.game.emit('change'); this.print(`✓ ${rpgOf(this.game).potions} potions`, 'ok'); },
  },
  tp: {
    usage: 'tp <cursor|home|cave|boss|key|exit|x y|player [here]>', desc: 'Teleport your hero, or tp <player> to jump to them, tp <player> here to pull them to you',
    run([where = 'cursor', y]) {
      const other = where && this.playerSpot?.(where);   // a player by name: go to them, or pull them here
      if (other) {
        const me = heroOf(this.hud?.dungeon || this.game);
        if (!me) throw new Error('no hero');
        const mp = this.mp || this.hud?.mp;
        if (y === 'here' || y === 'me') {
          mp.sendCommand(other.uid, { t: 'tp', x: Math.round(me.x), y: Math.round(me.y) });
          this.print(`✓ pulled ${other.name} to you`, 'ok');
          return;
        }
        if (other.away) throw new Error(`${other.name} is in this world but not walking the island right now (try: tp ${other.name} here)`);
        me.x = other.x; me.y = other.y;
        if (this.hud) Object.assign(this.hud.renderer.camera, { x: me.x, y: me.y });
        this.print(`✓ teleported to ${other.name}`, 'ok');
        return;
      }
      const dg = this.hud?.dungeon;
      const g = dg || this.game;
      const v = heroOf(g);
      if (!v) throw new Error('no hero');
      const d = dg?.dungeon;
      const spot = where === 'cursor' ? this.game.cursor
        : where === 'home' ? (dg ? null : g.center)
          : where === 'cave' ? (g.state.dungeons?.length ? g.state.dungeons[0] : (updateEntrances(g, true), updateEntrances(g, true), updateEntrances(g, true), g.state.dungeons?.[0]))
            : where === 'boss' && d ? { x: (d.boss.x + d.boss.w / 2) * 32, y: (d.boss.y + d.boss.h / 2) * 32 }
              : where === 'key' && d ? d.key
                : where === 'exit' && d ? { x: d.exit.x, y: d.exit.y + 48 }
                  : y != null ? { x: Number(where) * 32, y: Number(y) * 32 } : null;
      if (!spot) throw new Error(dg && where === 'home' ? 'use: dungeon leave' : `nowhere called "${where}"`);
      if (where === 'boss' && d && !d.open) { d.hasKey = true; }
      v.x = spot.x; v.y = spot.y;
      if (this.hud) Object.assign(this.hud.renderer.camera, { x: v.x, y: v.y });
      this.print(`✓ teleported to ${where}${y != null ? ` ${y}` : ''}`, 'ok');
    },
  },
  kill: {
    usage: 'kill [tiles|all] [noloot]', desc: 'Slay hostile creatures around you (they drop loot and XP unless noloot)',
    run([range = '12', flag]) {
      const g = this.hud?.dungeon || this.game;
      const v = heroOf(g);
      const r = range === 'all' || range === '*' ? Infinity : (Number(range) || 12) * 32;
      const hit = g.state.creatures.filter(c => CREATURES[c.t]?.hostile && (!v || Math.hypot(c.x - v.x, c.y - v.y) <= r));
      for (const c of hit) {
        if (flag === 'noloot') { g.state.creatures = g.state.creatures.filter(x => x !== c); continue; }
        c.hp = 1; damageCreature(g, c, 99999, v);
      }
      g.state.battles = {};
      this.print(`✓ ${hit.length} hostile creature(s) slain`, 'ok');
    },
  },
  chest: {
    usage: 'chest [small|big|boss] [count]', desc: 'Put treasure chests at your cursor (or next to you)',
    run([kind = 'small', count = '1']) {
      const g = this.hud?.dungeon || this.game;
      const at = (!this.hud?.dungeon && this.game.cursor) || heroOf(g);
      if (!at) throw new Error('no spot');
      const n = Math.max(1, Math.min(50, Number(count) || 1));
      for (let i = 0; i < n; i++) (g.state.chests ||= []).push({ id: `adm${Date.now().toString(36)}${i}`, x: at.x + (i % 5) * 28 - 28, y: at.y + Math.floor(i / 5) * 28 + 20, tier: kind === 'big' ? 1 : 0, boss: kind === 'boss' });
      this.print(`✓ ${n} ${kind} chest(s)`, 'ok');
    },
  },
  speed: {
    usage: 'speed <0.25-10>', desc: 'How fast the world runs (1 = normal)',
    run([x = '1']) {
      const v = Math.max(0.25, Math.min(10, Number(x) || 1));
      this.game.speed = v;
      if (this.hud?.dungeon) this.hud.dungeon.speed = v;
      this.print(`✓ world speed ×${v}`, 'ok');
    },
  },
  build: {
    usage: 'build <type|*> [count]', desc: 'Instantly build near the village centre (* = one of every building)',
    run([type, count = '1']) {
      const types = type === '*' ? Object.keys(BUILDINGS) : [type];
      if (!BUILDINGS[types[0]]) throw new Error(`unknown building (try: ${Object.keys(BUILDINGS).slice(0, 8).join(', ')}…)`);
      const g = this.game;
      let made = 0, full = 0;
      for (const t of types) {
        for (let i = 0; i < Math.max(1, Math.floor(Number(count) || 1)); i++) {
          for (const [k, v] of Object.entries(BUILDINGS[t].cost)) g.state.resources[k] = Math.max(g.state.resources[k] || 0, v);
          const era = g.state.era;
          g.state.era = Math.max(era, BUILDINGS[t].era);
          const spot = g.findBuildSpot(t);
          const r = spot && g.placeBuilding(t, spot.tx, spot.ty);
          g.state.era = era;
          if (!r?.ok) { full++; break; }
          g.finishBuilding(r.building);
          made++;
        }
      }
      g.emit('change');
      const what = types.length > 1 ? `buildings (${full} types had no room)` : BUILDINGS[type].name;
      this.print(made ? `✓ built ${made} ${what}` : '✗ no free space', made ? 'ok' : 'err');
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
  tutorial: { feature: 'tutorial', group: 'World', usage: 'tutorial', desc: 'Restart the tutorial', run() { this.game.state.tutorial = { step: 0, done: false }; this.print('✓ tutorial restarted', 'ok'); } },
  stats: {
    usage: 'stats', desc: 'Your hero and your land at a glance',
    run() {
      const g = this.game, s = g.state, r = rpgOf(g), st = heroStats(g), v = heroOf(this.hud?.dungeon || g);
      this.print(JSON.stringify({
        hero: v ? { name: v.name, hp: `${Math.round(v.hp)}/${st.maxHp}`, level: r.level, points: r.points, potions: r.potions || 0, god: !!r.god, gear: Object.fromEntries(Object.entries(r.gear).map(([k, it]) => [k, it?.name || null])), bag: r.bag.length, deepest: r.deepest || 0 } : null,
        land: { day: g.day + 1, era: ERAS[s.era].name, buildings: s.buildings.length, chests: (s.chests || []).length, caves: (s.dungeons || []).length, defense: Math.round(g.defense), karma: Math.round(s.karma) },
        resources: s.resources, inDungeon: this.hud?.dungeon ? this.hud.dungeon.dungeon.depth : false,
      }, null, 2));
    },
  },

  // ---------------- empire
  empire: {
    feature: 'empire',
    usage: 'empire list | event [n] | discover | war <n> | win <n> | peace <n>', desc: 'Inspect and control neighbouring kingdoms',
    run([sub = 'list', arg]) {
      const g = this.game;
      const e = empireOf(g);
      const pickOne = () => { const k = e.kingdoms[Number(arg) - 1]; if (!k) throw new Error(`no kingdom #${arg} (empire list)`); return k; };
      // "empire win *" etc. act on every kingdom; the last one is returned for the message
      const pick = () => {
        if (arg !== '*') return pickOne();
        if (!e.kingdoms.length) throw new Error('no kingdoms discovered yet (empire discover)');
        const rest = e.kingdoms.slice(0, -1);
        for (const k of rest) {
          if (sub === 'war') { k.status = 'war'; k.warScore = 0; }
          if (sub === 'win') { k.status = 'war'; k.warScore = 99; k.strength = 1; }
          if (sub === 'peace') { k.status = 'neutral'; k.warScore = 0; k.attitude = 20; }
        }
        return e.kingdoms.at(-1);
      };
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
      if (!this.mp) { this.print('solo world (no multiplayer)'); return; }
      const players = this.mp.players || [];
      this.print(`world ${this.mp.world || 'realm'} · ${players.length} realms · ${players.filter(p => p.online).length} online`);
    },
  },
};

// commands of switched-off systems stay in this file but out of the console
for (const [k, c] of Object.entries(COMMANDS)) if (c.feature && !on(c.feature)) delete COMMANDS[k];

function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function load() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
