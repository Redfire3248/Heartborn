import { h, icon, avatar, RES_ICON, costChips, bar, clear, modal, confirmModal, fmt, timeAgo } from './dom.js';
import { openEnchantMenu } from './enchantMenu.js';
import { atEnchantTable, ENCHANTS, enchName } from '../game/enchanting.js';
import { openIndex } from './indexBook.js';
import { openLayoutEditor, watchLayout } from './layoutEdit.js';
import { quickCraft, setQuickCraft } from '../core/prefs.js';
import { TRAITS as FORGE_TRAITS, abilityOf as weaponAbility } from '../game/forging.js';
import { openTableMenu, openMaterialsBag, matIcon } from './tableMenu.js';
import { MATERIALS, MATERIAL_KEYS } from '../game/forging.js';
import { forgeMinigame } from './forge.js';
import { heroBiome, THEMES } from '../game/worldTypes.js';
import { AVATARS, avatarId, avatarArt, setLook } from '../game/avatars.js';
import { iconUrl, spriteAvailable } from '../core/assets.js';
import { TILE, ADULT_AGE, MAP_W, MAP_H, RESOURCES, DAY_LENGTH } from '../core/constants.js';
import { BUILDINGS, ERAS, CATEGORIES, sizeOf, buildingSprite } from '../data/buildings.js';
import { OFFICES, officeUnlocked, officialOf, appoint, dismiss, setOfficeOption, TRADE_WORKPLACE } from '../game/court.js';
import { OBJECTS, CREATURES, villagerSprite } from '../data/objects.js';
import { TRAITS } from '../data/traits.js';
import { JOBS, assignJob, displayRole } from '../game/villagers.js';
import { DEEDS, runDeed, sacrificeVillager, exileVillager, smiteCreature } from '../game/deeds.js';
import { maxHp } from '../game/creatures.js';
import { rulerOf, rulerTypeOf, rulerTitle, setHeir, setCalling, encourage, ENCOURAGE, inventory, equipment, isTrained, crown, addItem, takeItem } from '../game/dynasty.js';
import { CALLINGS, RULER_TYPES, ITEMS } from '../data/people.js';
import { accuse, punishTraitor, throwBomb, counterIntel, isSpy, hasMissiles, hasOrbital, MISSILE_COST, strikeOwnLand, strikeRadius } from '../game/intrigue.js';
import { openAimMap } from './aimMap.js';
import { BODY, bodyStat } from '../game/body.js';
import { autoPickOn, runAutoPick } from '../game/autopick.js';
import { arriveAbroad, leaveAbroad, spyActions } from '../game/abroad.js';
import { rpgOf, heroStats, heroWeapon, xpToNext, spendPoint, equip, equipBest, gearScore, unequip, scrapGear, RARITY, CATALOG, BLADE_SPECIALS, questProgress } from '../game/rpg.js';
import { gearIconKey, hasArt } from '../render/gearArt.js';
import { homeOf, residents } from '../game/homes.js';
import { itemAt, pickUp, moveItem, dropFromPack, dropStack } from '../game/groundItems.js';
const BADGE_TRAITS = ['gifted', 'knighted', 'versatile'];   // already shown as badges at the top of a profile
const BODY_COLOR = { strength: '#ff8a5a', speed: '#7fd4ff', stamina: '#8fe07a' };
const BODY_TIP = { strength: 'Heavy work (chopping, mining, building, farming, forging) and fighting go faster and hit harder', speed: 'Walks and runs faster', stamina: 'Works harder, gets hungry more slowly and takes less damage' };
import { startLead, endLead, heroOf, updateHero, bountyOf, compass, setAvatar, avatarOf, useAbility as useWeaponAbility, damageHero, knockOutHero } from '../game/hero.js';
import { makeVisitGame } from '../game/visit.js';
import { makeDungeonGame, leaveSurface, returnFromDungeon, bossOf } from '../game/dungeon.js';
import { HouseEditor } from './houseEditor.js';
import { RECIPES, CRAFT_CATS, canCraft, craft, needsTable, atTable, ownsTool, missingToDiscover, craftTime, forgeStages, nearestStation } from '../game/crafting.js';
import { CONSUMABLES, itemsOf, buffActive } from '../game/consumables.js';
import { on, buildingOn, eraFree } from '../core/features.js';
import { ACTIONS, CONTROL_GROUPS, is, held, keyOf, keyLabel, setBind, resetBinds, RESERVED } from '../core/controls.js';
import { TOOLS, toolsOf, hotbarOf, selectSlot, setSlot, swapSlots, TOOL_KINDS } from '../game/tools.js';
import { doorOf } from '../game/houses.js';
import { LAW_CATEGORIES, DEFAULT_LAWS, LAW_COST, describeEffects } from '../data/laws.js';
import { rally, standDown, tributeCost, payWarbandTribute, scoutSummary } from '../game/war.js';
import { leaderboard, getProfile } from '../net/save.js';
import { fmtRes, travelMs, fmtMinutes, realmPos } from '../net/multiplayer.js';
import { openRealmMap } from './realmMap.js';

// phones and tablets: no right-click, no Esc key
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** Phones and tablets place buildings in front of the hero with a Build here button. */
const MOBILE_PLACE = () => TOUCH || (typeof innerWidth === 'number' && innerWidth <= 760);
import { computeBridges, bridgeAt } from '../game/bridges.js';
import { talentLabel, fullName, EGO_PROUD } from '../game/talents.js';
import { SPELLS, canCast, castSpell } from '../game/magic.js';
import { UPGRADES, MAX_LEVEL, PER_LEVEL, jobLevel, upgradeCost, upgradeJob, OFFICE_UPGRADES, officeLevel, officeUpgradeCost, upgradeOffice } from '../game/upgrades.js';
import { BOATS, fleetOf, buildBoat, setSail, returnToPort, repairBoat, updateSailing, fire, RELOAD, seaLift, enterOpenSea } from '../game/sailing.js';
import { TOPICS, talkTo } from '../game/talk.js';
import { activeGoals, claimGoal, rewardText, goalsLeftInEra } from '../game/goals.js';
import { findAt, collectFind } from '../game/finds.js';
import { describeBuilding, effectBadges } from '../data/describe.js';
import { Tutorial } from './tutorial.js';
import { abilityOf, abilityCooldown, canUseAbility, useAbility } from '../game/abilities.js';
import { canDoJob, isVersatile, professionLabel, PROFESSIONS } from '../game/professions.js';
import { hasOffice, employmentOf, setTarget, applyNow, applyPreset, moveWorkers, autoPick, bestForOffice, STAFFABLE, JOB_SKILL } from '../game/employment.js';
import { empireOf, empirePower, empireTitle, empireAction, ACTIONS as EMPIRE_ACTIONS, PERSONALITIES, STATUS } from '../game/empire.js';
import { openProfile, friendsPanel } from './social.js';
import { installButton } from './screens.js';
import { startItemDrag } from './itemDrag.js';
import { pxIcon } from './pixelIcons.js';
import { play, soundSettings, setVolume } from '../core/sound.js';
import { cleanText, mutedPlayers, setMuted, reportMessage } from '../net/chatSafety.js';
import { BUILD, LATEST_CHANGES, checkLatest } from '../core/version.js';

const TOP_RES = ['food', 'wood', 'stone', 'weapons', 'bombs', 'gold', 'gems', 'science', 'influence'];   // ores, metals and boss materials are in the Materials bag
// bombs and science only appear once they matter
const SHOW_WHEN = {
  bombs: g => !g.solo && (g.state.resources.bombs > 0 || g.hasBuilding('powder_mill')), science: g => !g.solo && (g.state.resources.science > 0 || g.state.era >= 3),
  // a lone hero has no army and no influence to spend: those stay out of the bar
  weapons: g => !g.solo, influence: g => !g.solo,
  coal: g => g.state.resources.coal > 0,
  copper: g => g.state.resources.copper > 0,
  silver: g => g.state.resources.silver > 0,
  obsidian: g => g.state.resources.obsidian > 0,
  mythril: g => g.state.resources.mythril > 0,
  frostite: g => g.state.resources.frostite > 0,
  magmite: g => g.state.resources.magmite > 0,
};
// the engine telegraph, top to bottom
const TELEGRAPH = [['FULL', 1], ['HALF', 0.6], ['SLOW', 0.3], ['STOP', 0], ['BACK', -0.4]];

const TASK_TEXT = {
  wander: 'Wandering', patrol: 'On patrol', flee: 'Fleeing!', fight: 'Fighting!', hunt: 'Hunting', eat: 'Eating',
  study: 'Studying magic', spytrain: 'Learning the spy trade', train: 'Drilling for war', craft: 'Forging weapons', rest: 'Sleeping', heal: 'Being healed', build: 'Building', chop: 'Chopping wood', mine: 'Mining', gather: 'Gathering',
  deepmine: 'Mining deep', farm: 'Farming', fish: 'Fishing', explore: 'Exploring the wilds',
};
const MINI_COLORS = ['#1d4e89', '#3a9ad9', '#e3cd8c', '#5c9e3c', '#66a843', '#8a5a36', '#44613a', '#55535a', '#eef4fa', '#e5561e', '#8c8c8c', '#6b4526'];

const MINI_SCALE = 4;   // minimap canvas pixels per tile

const DOCK_GROUPS = [
  { id: 'build', short: 'Build', icon: 'ui/build', tip: 'Build (B)', tabs: [['build', 'Build']] },
  { id: 'people', short: 'People', icon: 'items/population', tip: 'People & Court (J)', tabs: [['jobs', '👥 People & Jobs'], ['court', '👑 Court']] },
  { id: 'rule', short: 'Rule', icon: 'items/scroll', tip: 'Rule, Empire & Chronicle (K)', tabs: [['deeds', '📜 Laws'], ['empire', '👑 Empire'], ['log', '📖 Chronicle']] },
  { id: 'realm', short: 'World', icon: 'ui/map', tip: 'Realm & Multiplayer (M)', tabs: [['world', '🌍 World'], ['ranks', '🏆 Rankings']], alias: ['map'], map: true },
  null,
  { id: 'settings', short: 'Settings', icon: 'ui/settings', tip: 'Save & Settings', tabs: [['settings', 'Settings']] },
];
// menus of systems that are switched off (see core/features.js) are left out; a group with no tabs left goes too
const TAB_FEATURE = { jobs: 'people', court: 'court', deeds: 'laws', empire: 'empire', log: 'chronicle' };
for (const grp of DOCK_GROUPS) if (grp) grp.tabs = grp.tabs.filter(([id]) => !TAB_FEATURE[id] || on(TAB_FEATURE[id]));
for (let i = DOCK_GROUPS.length - 1; i >= 0; i--) if (DOCK_GROUPS[i] && !DOCK_GROUPS[i].tabs.length) DOCK_GROUPS.splice(i, 1);
const groupOf = id => DOCK_GROUPS.find(g => g?.tabs.some(t => t[0] === id));
const BOSS_NAMES = { cave_troll: 'Cave Troll', forest_spirit: 'Forest Spirit', slime_king: 'The Slime King', spider_queen: 'The Spider Queen', stone_golem: 'The Stone Golem', lich: 'The Lich', dragon: 'Ancient Dragon' };

export class HUD {
  constructor({ game, renderer, input, mp, user, isAdmin, onSave, onSignOut, onRestart, onVisit, onReturnHome, world, username, onSwitchWorld, onBackToMenu, onSeaView, onAbroad, onDungeon }) {
    Object.assign(this, { game, renderer, input, mp, user, isAdmin, onSave, onSignOut, onRestart, onVisit, onReturnHome, world, username, onSwitchWorld, onBackToMenu, onSeaView, onAbroad, onDungeon });
    // ships at sea talk to other players through the multiplayer layer
    if (mp) game.seaNet = { publish: (s, boat) => mp.publishShip(s, boat), shot: b => mp.sendShot(b), sunk: (by, boat) => mp.reportSunk(by, boat), leave: () => mp.leaveSea() };
    this.root = document.getElementById('ui');
    this.panel = null;
    this.buildType = null;
    this.follow = null;
    this.lastSavedAt = 0;
    this.prevRes = {};
    this.tickTimer = 0;
    this.els = {};
    this.build();

    this.onBack = () => {
      const x = [...document.querySelectorAll('.modal-bg .modal-x, .analyze-bg .an-x')].pop();
      if (x) x.click();
      else if (this.houseEditor) this.houseEditor.close();
      else if (!this.els.invPanel?.hidden) this.els.invPanel.hidden = true;
      else if (this.panel) this.closePanel();
      else if (window.__hb?.app?.console?.open) window.__hb.app.console.toggle();
      else this.hint('Open Settings to leave the game', 1800);
      history.pushState({ hb: 1 }, '');   // stay on this page for the next back press
    };
    history.pushState({ hb: 1 }, '');
    window.addEventListener('popstate', this.onBack);
    game.on('log', e => this.toast(e));
    game.on('announce', t => this.announce(t));
    game.on('event', ev => this.showEvent(ev));
    game.on('change', () => this.requestRefresh());
    game.on('scoutReport', r => { if (on('invasions') || on('warbands')) this.showScoutReport(r); });
    // go in once the current swing or step has finished (never in the middle of updating the hero)
    game.on('dungeon', e => setTimeout(() => this.enterDungeon(e), 0));
    game.on('house', b => setTimeout(() => this.enterHouse(b), 0));
    game.on('rareLoot', d => this.rareLootReveal(d));
    game.on('discover', () => { if (!this._indexToastAt || performance.now() - this._indexToastAt > 4000) { this._indexToastAt = performance.now(); this.toast({ text: 'New entry in your Index (N)', kind: 'event' }); } });
    if (mp) {
      // player vs player
      game.pvp = (uid, dmg, x, y, name) => mp.sendHit(uid, dmg, x, y, name);
      mp.on('pvpHit', hit => this.takePlayerHit(hit));
      mp.on('chat', () => this.panel === 'world' && this.worldTab === 'chat' && this.refreshPanel());
      mp.on('players', () => this.panel === 'world' && this.worldTab === 'players' && this.refreshPanel());
      mp.on('armies', () => this.panel === 'world' && this.worldTab === 'players' && this.refreshPanel());
      this.missionTimer = setInterval(() => { if (this.panel === 'world' && this.worldTab === 'players' && (mp.missions().length || mp.armies().length) && !this.panelEl?.matches(':hover')) this.refreshPanel(); }, 1000);
      mp.on('visitAsks', asks => this.showVisitAsks(asks));
      mp.on('players', players => {
        // rebuild bridges only when the set of neighbours (or who is online) changes
        const key = players.map(p => `${p.uid}${p.online ? 1 : 0}`).sort().join();
        if (key === this.bridgeKey) return;
        this.bridgeKey = key;
        game.bridges = computeBridges(game.world, user.uid, players);
      });
      mp.on('inbox', () => { this.showIncomingTrades(); this.updateBadges(); if (this.panel === 'world' && this.worldTab === 'offers') this.refreshPanel(); });
      mp.on('announcement', a => { this.announce(`📜 ${a.text}`); this.toast({ text: `Announcement: ${a.text}`, kind: 'event' }); });
    }
  }

  // ------------------------------------------------------------ layout
  build() {
    const g = this.game;
    // top bar
    const resCard = h('div.card');
    this.els.res = {};
    for (const k of TOP_RES) {
      const v = h('span.v', '0'), cap = h('span.cap', '');
      const el = h('div.res', { title: k[0].toUpperCase() + k.slice(1) }, icon(RES_ICON[k], 24), h('div', v, cap));
      this.els.res[k] = { el, v, cap };
      resCard.append(el);
    }
    // your ores and boss materials follow; what does not fit folds into a +N button (opens the Materials bag)
    this.els.resCard = resCard;
    this.els.matRes = {};
    this.els.resMore = h('button.res.res-more', { title: 'More materials', hidden: true, onclick: () => openMaterialsBag(this) }, h('span.v', '+0'));
    resCard.append(this.els.resMore);
    this.els.pop = h('span.v', '3');
    this.els.housing = h('span.cap', '');
    if (!g.solo) resCard.prepend(h('div.res', { title: 'Population / housing' }, icon('items/population', 24), h('div', this.els.pop, this.els.housing)));

    this.els.karmaDot = h('i');
    this.els.karmaTitle = h('div.karma-title', 'Neutral');
    this.els.era = h('span.era-badge', ERAS[0].name);
    this.els.shield = h('span.shield-badge');
    const karmaCard = h('div.card.karma-card',
      h('div.col', { style: { gap: '2px', alignItems: 'center' } },
        h('div.karma', { title: 'Karma — good deeds bring luck and happiness; evil brings power and curses' },
          icon('items/karma_evil', 22), h('div.karma-track', this.els.karmaDot), icon('items/karma_good', 22)),
        h('div.row', { style: { gap: '6px' } }, this.els.karmaTitle, this.els.era, this.els.shield)));

    this.els.day = h('div.day', 'Day 1');
    this.els.season = h('div.season', 'Spring · Year 1');
    const clockCard = h('div.card.clock-card', h('div.clock', this.els.day, this.els.season));
    this.els.bellCount = h('span.bell-count', { hidden: true }, '0');
    const bell = h('button.card.bell', { title: 'Notifications', onclick: () => this.toggleNotifications() }, pxIcon('bell'), this.els.bellCount);
    // one row: resources, notifications and the day (the karma bar is gone)
    this.root.append(h('div.topbar', resCard, on('notifications') ? bell : null, clockCard));
    this.els.karmaCard = karmaCard;

    // dock
    const dock = h('div.card.dock');
    this.els.dock = {};
    // one dock button per group; related panels share it as tabs
    this.groupTab = {};
    for (const grp of DOCK_GROUPS) {
      if (!grp) { dock.append(h('hr')); continue; }
      const ids = grp.tabs.map(t => t[0]);
      const btn = h('button', {
        onclick: () => (ids.includes(this.panel) ? this.closePanel() : this.openPanel(this.groupTab[grp.id] || ids[0])),
      }, icon(grp.icon, 34), h('span.dock-label', grp.short), h('span.tip', grp.tip));
      for (const id of [...ids, ...(grp.alias || [])]) this.els.dock[id] = btn;
      dock.append(btn);
    }
    this.root.append(dock);

    this.els.feed = h('div.feed');
    this.root.append(this.els.feed);

    // minimap
    const mapSize = g.world?.w || MAP_W;
    this.mini = h('canvas', { width: Math.round(MAP_W * MINI_SCALE), height: Math.round(MAP_H * MINI_SCALE) });
    this.miniK = MAP_W / mapSize;   // bigger worlds are drawn smaller so the minimap keeps its size
    // clicking the minimap opens the World Map
    this.mini.addEventListener('click', () => this.openMap());
    this.root.append(h('div.card.minimap', { title: 'Open the World Map (V)' }, this.mini));
    // back to the main screen (saves first); while visiting, back takes you home first
    this.root.append(h('button.card.home-btn', {
      title: 'Back to the main screen',
      onclick: () => {
        if (this.visiting) { this.onReturnHome(); return; }
        this.onBackToMenu?.();
      },
    }, h('span.back-arrow', '‹'), h('span.home-label', 'Back')));
    // jump the camera back to the village (the H key, for phones)
    this.root.append(h('button.card.center-btn', {
      title: 'Back to your village (H)',
      onclick: () => { if (this.visiting) { this.onReturnHome(); return; } this.follow = null; this.input.panTo(this.game.center.x, this.game.center.y); },
    }, pxIcon('target'), h('span.home-label', 'Village')));
    // lead in person: walk your ruler around yourself
    this.leadInput = { mx: 0, my: 0, act: false, dash: false, block: false };
    this.root.append(h('button.card.lead-btn', { title: 'Your character: level, points, gear and loot (G)', onclick: () => this.toggleLead() },
      icon('ui/character', 22), h('span.home-label', 'Character')));
    this.els.heroBar = h('div.card.hero-bar', { hidden: true });
    this.els.heroPad = h('div.hero-pad', { hidden: true });
    this.els.hotbar = h('div.hotbar', { hidden: true });
    this.els.hotName = h('div.hot-name');
    this.els.invPanel = h('div.card.inv-panel', { hidden: true });
    this.root.append(this.els.heroBar, this.els.heroPad, h('div.hotbar-wrap', this.els.invPanel, this.els.hotName, this.els.hotbar));
    watchLayout();
    // sailing: status, Fire, Return to port, and a steering pad for touch screens
    this.sailInput = { throttle: 0, turn: 0, fire: false, wheel: 0 };
    this.els.sailBar = h('div.sail-bar', { hidden: true });
    this.root.append(this.els.sailBar);

    // what right-click / Esc do on a computer, as buttons (phones have neither)
    this.els.touchBar = h('div.touch-bar');
    this.root.append(this.els.touchBar);
    this.drawMinimapBase();

    this.els.threats = h('div.threats');
    this.root.append(this.els.threats);

    // goals tracker
    // phones start with the goals folded away (the header still shows how many are ready)
    let collapsed = matchMedia('(max-width: 760px), (max-height: 520px)').matches;
    try { const saved = localStorage.getItem('hb-goals-collapsed'); if (saved != null) collapsed = saved === '1'; } catch {}
    this.els.goalsHead = h('button.goals-head', { onclick: () => this.toggleGoals() });
    this.els.goalsList = h('div.goals-list');
    this.els.goals = h(`div.card.goals${collapsed ? '.collapsed' : ''}`, this.els.goalsHead, this.els.goalsList);
    this.root.append(this.els.goals);

    this.tutorial = on('tutorial') ? new Tutorial(this) : null;

  }

  // ------------------------------------------------------------ per-frame
  tick(dt) {
    const g = this.game;
    if (this.follow) {
      if (!g.state.villagers.includes(this.follow)) this.follow = null;
      else {
        const c = this.renderer.camera;
        c.x += (this.follow.x - c.x) * Math.min(1, dt * 5);
        c.y += (this.follow.y - c.y) * Math.min(1, dt * 5);
      }
    }
    if (g.sail) {
      const k = this.input.keys, t = this.sailInput;
      const throttle = t.throttle;
      const turn = (held(k, 'right') || k.has('arrowright') ? 1 : 0) - (held(k, 'left') || k.has('arrowleft') ? 1 : 0) || t.turn;
      if (!g.paused && !g.pendingEvent) updateSailing(g, dt, { throttle, turn, fire: held(k, 'attack') || t.fire });
      this.updateHelm(dt, turn);
      const c = this.renderer.camera;
      if (g.sail) { c.x += (g.sail.x - c.x) * Math.min(1, dt * 4); c.y += (g.sail.y - c.y) * Math.min(1, dt * 4); }
    }
    // the person you control: your avatar at home, or your visitor / spy in another land
    const abroad = this.visiting && this.abroad?.land?.hero ? this.abroad : null;
    const hg = abroad ? abroad.land : this.dungeon && !this.visiting ? this.dungeon : !this.visiting ? g : null;
    if (this.houseEditor) {
      // inside a home: no character, the house view takes the screen
    } else if (hg?.hero) {
      const k = this.input.keys, t = this.leadInput;
      const mx = (held(k, 'right') || k.has('arrowright') ? 1 : 0) - (held(k, 'left') || k.has('arrowleft') ? 1 : 0) + t.mx;
      const my = (held(k, 'down') || k.has('arrowdown') ? 1 : 0) - (held(k, 'up') || k.has('arrowup') ? 1 : 0) + t.my;
      // dash fires once per press; block is held
      const dashDown = held(k, 'dash') || t.dash;
      const dash = dashDown && !this._dashHeld;
      const potionDown = held(k, 'potion') || t.potion;
      let potion = potionDown && !this._potionHeld;
      if (potion && hg === g && (atTable(g, heroOf(g)) || atEnchantTable(g, heroOf(g)))) {   // the closer table opens
        potion = false;
        const st = nearestStation(g, heroOf(g));
        if (st?.type === 'enchanting_table' || (!st && atEnchantTable(g, heroOf(g)) && !atTable(g, heroOf(g)))) openEnchantMenu(this);
        else this.openTable();
      }
      this._potionHeld = potionDown;
      this._dashHeld = dashDown;
      const fights = !abroad || abroad.role === 'visitor';   // a visitor can fight other players; a disguised spy cannot
      if (abroad || (!g.paused && !g.pendingEvent)) updateHero(hg, dt, { mx, my, act: fights && (held(k, 'attack') || t.act), dash: fights && dash, potion: !abroad && potion, block: fights && (held(k, 'block') || t.block) });
      if (hg === this.dungeon) { this.tickDungeon(); if (performance.now() - (this._mapDrawnAt || 0) > 150) { this._mapDrawnAt = performance.now(); this.drawDungeonMap(); } }
      if (this.mobilePlace && this.buildType && hg === g && !this.mobilePlace.manual) {   // the house waits just in front of you
        const hv = heroOf(g);
        const a = g.hero.facing ?? Math.PI / 2, size = BUILDINGS[this.buildType].size;
        const dist = (1.2 + size * 0.6) * TILE;
        if (hv) this.onHover(Math.floor((hv.x + Math.cos(a) * dist) / TILE), Math.floor((hv.y + Math.sin(a) * dist) / TILE));
      }
      if (this.mobilePlace && (Math.abs(mx) > 0.2 || Math.abs(my) > 0.2)) this.mobilePlace.manual = false;   // walking brings it back in front of you
      this.updateBossBar(hg, dt);
      if (hg._pickSound) { hg._pickSound = false; play('pickup'); }
      { const me = heroOf(hg); const low = !!me && !this.houseEditor && me.hp > 0 && me.hp < (hg.hero.maxHp || 100) * 0.25; if (low !== this._lowHp) { this._lowHp = low; this.root.classList.toggle('low-hp', low); } }
      if (this.els.abilityBtn && hg.hero) { const left = Math.max(0, (hg.hero.abilityReady || 0) - hg.state.time), max = hg.hero.abilityMax || 1; this.els.abilityBtn.style.setProperty('--cd', String(left / max)); this.els.abilityBtn.classList.toggle('cooling', left > 0); const wpn = rpgOf(hg).gear.weapon; this.els.abilityBtn.hidden = !weaponAbility(wpn); }
      if (hg === g && !this.houseEditor) {
        const biome = heroBiome(g);
        if (biome && biome !== this._biome) {
          if (this._biome) this.biomeBanner(biome);
          questProgress(g, 'explore', { type: biome, v: heroOf(g) });
          this._biome = biome;
        }
      }
      const v = heroOf(hg);
      const c = this.renderer.camera;
      // the camera always stays on you
      if (v) { this.follow = null; c.x += (v.x - c.x) * Math.min(1, dt * 6); c.y += (v.y - c.y) * Math.min(1, dt * 6); }
    } else {
      this.ensureAvatar();
      const me = heroOf(abroad ? abroad.land : g);
      if (abroad && me && this.mp && abroad.hostUid) this.mp.publishStranger(abroad.hostUid, abroad.strangerId, me, { disguised: abroad.role === 'spy' });
      // at home with visitors about: they see you walking too (so you can fight)
      else if (!abroad && !this.dungeon && me && this.mp && this.user && g.strangers?.length) this.mp.publishStranger(this.user.uid, `host_${this.user.uid}`, me);
    }
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;
    this.tickTimer = 0.25;

    const s = g.state;
    for (const k of TOP_RES) {
      const { el, v, cap } = this.els.res[k];
      if (SHOW_WHEN[k]) el.hidden = !SHOW_WHEN[k](g);
      const val = Math.floor(s.resources[k] || 0);
      const vt = fmt(val);
      if (v.textContent !== vt) v.textContent = vt;
      const c = g.caps[k];
      const ct = '';   // no storage limits any more
      if (cap.textContent !== ct) cap.textContent = ct;
      el.classList.toggle('full', !!c && val >= c);
      const prev = this.prevRes[k];
      if (prev != null && val !== prev) {
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(val > prev ? 'flash-up' : 'flash-down');
      }
      this.prevRes[k] = val;
    }
    this.updateResOverflow();
    if (this.els.pop.textContent !== String(s.villagers.length)) this.els.pop.textContent = s.villagers.length;
    if (this.els.housing.textContent !== `/${g.housing}`) this.els.housing.textContent = `/${g.housing}`;
    this.els.karmaDot.style.left = `${(s.karma + 100) / 2}%`;
    const karmaText = `${g.karmaTitle} (${Math.round(s.karma)})`;
    if (this.els.karmaTitle.textContent !== karmaText) this.els.karmaTitle.textContent = karmaText;
    if (this.els.era.textContent !== ERAS[s.era].name) this.els.era.textContent = ERAS[s.era].name;
    const shieldH = Math.ceil(((s.shieldUntil || 0) - Date.now()) / 3600000);
    const hour = Math.floor(g.hour);
    // only touch the DOM when the text really changes (per-frame rewrites flicker on phones)
    const shieldText = shieldH > 0 ? `${shieldH}h` : '';
    if (this._shieldText !== shieldText) { this._shieldText = shieldText; this.els.shield.replaceChildren(...(shieldText ? [pxIcon('shield'), shieldText] : [])); }
    const dayText = `Day ${g.day + 1} · ${String(hour).padStart(2, '0')}:00`;
    const night = g.isNight;
    if (this._dayText !== dayText || this._night !== night) { this._dayText = dayText; this._night = night; this.els.day.replaceChildren(`${dayText} `, pxIcon(night ? 'moon' : 'sun')); }
    const seasonText = `${g.season} · Year ${g.year}`;
    if (this.els.season.textContent !== seasonText) this.els.season.textContent = seasonText;

    this.updateInspector();
    this.updateTouchBar();
    this.updateSailBar();
    this.updateHeroBar();
    this.updateGoals();
    this.updateThreats();
    this.drawMinimapDots();
    if (this.panel === 'jobs' || this.panel === 'deeds' || this.panel === 'build') this.softRefresh();
    if (this.panel === 'court') {
      const key = JSON.stringify([s.court, s.ruler, s.villagers.map(v => v.id + v.job + (v.office || '') + v.traits.length).join(), g.builtBuildings().length]);
      if (key !== this.courtKey && !this.panelEl?.contains(document.activeElement)) { this.courtKey = key; this.refreshPanel(); }
    }
  }

  onKey(e) {
    if (this.houseEditor) return;   // the house view has its own keys
    const k = e.key.toLowerCase();
    if (this._rebinding) return;   // Settings is waiting for a key
    if (is(k, 'map')) { this.openMap(); return; }
    if (k === 'escape' && this.visiting) { this.onReturnHome(); return; }
    if (is(k, 'character') && !this.game.sail) { this.toggleLead(); return; }
    if (is(k, 'inventory')) { this.inventory(); return; }
    if (is(k, 'index')) { openIndex(this); return; }
    const slot = ACTIONS.findIndex(a => a.id.startsWith('hot') && is(k, a.id)) - ACTIONS.findIndex(a => a.id === 'hot1');
    // like Minecraft: hover something in the inventory and press a number to put it in that hotbar slot
    if (slot >= 0 && this._invHover && !this.els.invPanel.hidden) { setSlot(this.game, slot, this._invHover); this._hotbarKey = null; this.renderInventory(); return; }
    if (slot >= 0 && (this.game.hero || this.dungeon)) { selectSlot(this.game, slot); this._hotbarKey = null; return; }
    if (is(k, 'drop') && (this.game.hero || this.dungeon)) { this.dropHeld(); return; }
    if (is(k, 'ability') && (this.game.hero || this.dungeon)) { useWeaponAbility(this.dungeon || this.game); return; }
    if (is(k, 'craft') && this.game.hero) { this.openTable(); return; }
    if (this.game.hero) {   // walking your ruler: WASD move, Space strikes, Esc stops
      if (is(k, 'attack') || k === ' ' || k.startsWith('arrow')) e.preventDefault?.();
      if (k === 'escape' && !this.buildType && !this.demolishMode && !this.game.selected && !this.panel) return;
      if (['up', 'down', 'left', 'right', 'attack', 'dash', 'block', 'potion'].some(id => is(k, id))) return;
    }
    if (this.game.sail) {   // the helm takes the keys
      if (k === 'escape') returnToPort(this.game);
      if (is(k, 'attack')) e.preventDefault?.();
      if (is(k, 'up') || k === 'arrowup') { e.preventDefault?.(); this.setTelegraph(+1); }
      if (is(k, 'down') || k === 'arrowdown') { e.preventDefault?.(); this.setTelegraph(-1); }
      return;
    }
    if (k === 'escape') { if (this.demolishMode) this.toggleDemolish(false); else if (this.buildType) this.cancelBuild(); else if (this.game.selected) this.select(null); else this.closePanel(); }
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault?.(); this.undo(); }
    else if (is(k, 'demolish')) this.toggleDemolish();
    else if (is(k, 'rebuild') && this.lastBuild) { if (this.game.canAfford(BUILDINGS[this.lastBuild].cost)) this.startBuild(this.lastBuild); else this.hint(`Not enough resources for another ${BUILDINGS[this.lastBuild].name}`, 1500); }
    else if (k === '/') { e.preventDefault?.(); this.buildSearchFocused = true; if (this.panel === 'build') this.panelEl?.querySelector('.build-search')?.focus(); else this.openPanel('build'); }
    else if (is(k, 'build')) this.togglePanel('build');
    else if (is(k, 'craft')) this.openTable();
    else if (is(k, 'jobs') && on('people')) this.togglePanel('jobs');
    else if (is(k, 'court') && on('court')) this.togglePanel('court');
    else if (is(k, 'deeds') && on('laws')) this.togglePanel('deeds');
    else if (is(k, 'log') && on('chronicle')) this.togglePanel('log');
    else if (is(k, 'world')) this.togglePanel('world');
    else if (k === 'h' && !this.game.hero) { this.follow = null; this.input.panTo(this.game.center.x, this.game.center.y); }
  }

  // ------------------------------------------------------------ you, the avatar
  /** The G key / Avatar button: your character sheet (you are always playing as your avatar). */
  toggleLead() {
    if (this.visiting) return;
    this.characterSheet();
  }

  playAs(v) {
    const r = setAvatar(this.game, v);
    if (r.error) { this.hint(r.error, 2500); return; }
    this.select(null);
    this.closePanel?.();
    this.hint(`You are now ${v.name}. Your level, gear and quests come with you.`, 5000);
  }

  /** Always be someone: at home you play your avatar (after sailing or if they fall, you pick up as the next one). */
  ensureAvatar() {
    const g = this.game;
    if (this.visiting || g.hero || g.sail) return;
    if (this._leadTry && performance.now() - this._leadTry < 2000) return;
    this._leadTry = performance.now();
    const first = !this._introShown;
    const r = startLead(g);
    if (r.error || !first) return;
    this._introShown = true;
    // no controls tip any more (the player asked for no on-screen instructions)
  }

  updateHeroBar() {
    const abroad = this.visiting && this.abroad?.land?.hero ? this.abroad : null;
    const g = abroad ? abroad.land : this.dungeon || this.game;
    this.updateDungeonCard();
    const v = (abroad || !this.visiting) && heroOf(g);
    this.updateHotbar(!abroad && v ? v : null);
    const bar = this.els.heroBar, pad = this.els.heroPad;
    this.root.classList.toggle('leading', !!v);
    pad.classList.toggle('abroad', !!abroad && abroad.role === 'spy');
    if (!v) {
      if (!bar.hidden) { bar.hidden = true; pad.hidden = true; bar.replaceChildren(); pad.replaceChildren(); this._heroKey = null; Object.assign(this.leadInput, { mx: 0, my: 0, act: false, dash: false, block: false }); }
      return;
    }
    bar.classList.toggle('card', !!abroad);   // abroad it is one card; at home it splits into small cards
    bar.classList.toggle('abroad-bar', !!abroad);
    if (abroad) { this.updateAbroadBar(abroad, v); return; }
    const hero = g.hero;
    const r = rpgOf(g);
    const st = heroStats(g);
    const w = heroWeapon(g, v);
    const bounty = bountyOf(g);
    if (bar.hidden) { bar.hidden = false; pad.hidden = false; this.buildHeroPad(); }
    // the bars move every frame; the rest only rebuilds when something changes
    const els = this.els;
    const fill = (el, frac) => { if (el) el.style.width = `${Math.max(0, Math.min(100, frac * 100))}%`; };
    const key = [v.id, r.level, r.points, r.potions || 0, w.name, this._questsOpen, r.quests.map(q => q.id + q.have).join(), bounty ? bounty.bounty.name + Math.round(Math.hypot(bounty.x - v.x, bounty.y - v.y) / TILE / 3) : ''].join('|');
    if (key !== this._heroKey) {
      this._heroKey = key;
      const dist = bounty ? Math.round(Math.hypot(bounty.x - v.x, bounty.y - v.y) / TILE) : 0;
      els.heroHp = h('div.hero-hearts', { title: 'Health' });
      this._heartsKey = null;
      els.heroSt = h('div');
      els.heroXp = h('div');
      // split into small cards down the left side: you (health, stamina, level) and your quests
      const questsOpen = this._questsOpen ?? !matchMedia('(max-width: 760px), (max-height: 520px)').matches;
      bar.replaceChildren(
        h('div.card.hero-vitals', { title: 'Open your character (G)', onclick: () => this.characterSheet() },
          h('div.hero-top',
            h('span.hero-level', `Lv ${r.level}`), h('b', v.name),
            gearIconKey(w) ? icon(gearIconKey(w), 16) : '',
            r.points ? h('span.hero-points', `+${r.points}`) : '',
            h('span.hero-potions', { title: 'Health potions: press E to drink' }, icon('gear/health_potion', 14), String(r.potions || 0))),
          els.heroHp,
          h('div.hero-meter.st', { title: 'Stamina: attacks, dashes and blocking use it' }, els.heroSt),
          h('div.hero-meter.xp', { title: 'Experience' }, els.heroXp)),
        // no quest board any more: only a bounty, when one is out there
        bounty ? h('div.card.hero-questcard', h('div.hero-bounty', icon('items/icon_gold', 14), `${bounty.bounty.name} · ${bounty.bounty.gold} gold · ${dist < 3 ? 'right here!' : `${dist} tiles ${compass(bounty.x - v.x, bounty.y - v.y)}`}`)) : '');
    }
    // health as hearts, Zelda style: one heart per 20 health, halves in between
    const hearts = Math.ceil(st.maxHp / 20);
    const heartState = Array.from({ length: hearts }, (_, i) => (v.hp >= (i + 1) * 20 ? 'full' : v.hp >= i * 20 + 10 ? 'half' : 'empty')).join();
    if (heartState !== this._heartsKey) {
      this._heartsKey = heartState;
      els.heroHp.replaceChildren(...heartState.split(',').map(s => icon(`gear/heart_${s}`, 18)));
    }
    fill(els.heroSt, (hero.stamina ?? st.maxStamina) / st.maxStamina);
    if (els.potionCount) { const n = String(r.potions || 0); if (els.potionCount.textContent !== n) els.potionCount.textContent = n; els.potionCount.parentElement.classList.toggle('empty', !r.potions); }
    fill(els.heroXp, r.xp / xpToNext(r.level));
    els.heroSt?.parentElement?.classList.toggle('low', (hero.stamina ?? 100) < 15);
  }

  /**
   * Analyze a piece of gear: it floats in a glow of its rarity while a scan passes over it, then its name, every stat
   * (bars fill one after another, compared with what you wear) and its special abilities are revealed.
   */
  analyzeGear(it) {
    const g = this.game;
    const def = CATALOG[it.slot]?.[it.base] || {};
    const R = RARITY[it.rarity] || RARITY[0];
    const worn = rpgOf(g).gear[it.slot];
    const wornDef = worn ? CATALOG[worn.slot]?.[worn.base] || {} : null;
    const stat = (label, value, max, text, compare, better = 'higher') => ({ label, value, max, text, compare, better });
    const stats = [];
    if (it.slot === 'weapon') {
      stats.push(stat('Damage', it.dmg, 70, `${it.dmg}`, worn?.dmg));
      stats.push(stat('Attack speed', 1 / def.speed, 4.5, `${(1 / def.speed).toFixed(1)} / sec`, wornDef?.speed ? 1 / wornDef.speed : null));
      stats.push(stat(def.ranged ? 'Range' : 'Reach', def.range, def.ranged ? 11 : 2.2, `${def.range} tiles`, wornDef?.range));
      if (!def.ranged) stats.push(stat('Swing width', def.arc, 2.7, `${Math.round(def.arc * 57)}°`, wornDef?.arc));
      stats.push(stat('Damage per second', it.dmg / def.speed, 120, `${Math.round(it.dmg / def.speed)}`, worn?.dmg && wornDef?.speed ? worn.dmg / wornDef.speed : null));
    } else if (it.slot === 'shield') {
      stats.push(stat('Block', it.block, 1, `${Math.round(it.block * 100)}% stopped`, worn?.block));
      stats.push(stat('Parry window', def.parry, 0.4, `${Math.round(def.parry * 1000)} ms`, wornDef?.parry));
      stats.push(stat('Move while guarding', def.slow, 0.8, `${Math.round(def.slow * 100)}% speed`, wornDef?.slow));
      if (it.armor) stats.push(stat('Armour', it.armor, 0.5, `+${Math.round(it.armor * 100)}%`, worn?.armor));
    } else if (it.slot === 'armor' || it.slot === 'helmet') {
      stats.push(stat('Armour', it.armor, it.slot === 'helmet' ? 0.2 : 0.7, `${Math.round(it.armor * 100)}% less damage`, worn?.armor));
    }
    for (const [k, n] of Object.entries(it.bonus || {})) {
      const label = { dmg: 'Damage bonus', hp: 'Health bonus', speed: 'Move speed' }[k] || k;
      stats.push(stat(label, Math.abs(n), k === 'hp' ? 60 : 0.3, k === 'hp' ? `+${n}` : `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`, worn?.bonus?.[k]));
    }
    // special abilities, read from what the gear really does
    const abilities = [];
    if (def.crit) abilities.push(['Keen Edge', `+${Math.round(def.crit * 100)}% chance of a critical hit`]);
    if (def.stun) abilities.push(['Staggering Blows', `Stuns what you hit for ${(1 + def.stun).toFixed(1)}s and knocks it further back`]);
    if (def.ranged) abilities.push(['Ranged', `Looses shots up to ${def.range} tiles away`]);
    if (def.thorns) abilities.push(['Thorns', `Deals ${def.thorns} damage back to anything that hits your guard`]);
    if (def.parry >= 0.3) abilities.push(['Quick Parry', 'A long window to turn a blow aside and stagger the attacker']);
    if (def.slow && def.slow <= 0.35) abilities.push(['Wall of Iron', 'Blocks almost everything, but you move slowly behind it']);
    for (const [k, l] of Object.entries(it.ench || {})) if (ENCHANTS[k]) abilities.push([`Enchanted: ${enchName(k, l)}`, ENCHANTS[k].desc(l)]);
    if (def.speed && def.speed <= 0.3) abilities.push(['Flurry', 'Strikes so fast your combos come out in a blur']);
    if (def.arc >= 2.2) abilities.push(['Wide Sweep', 'Cuts through every foe in a wide arc']);
    if (BLADE_SPECIALS[it.base]) abilities.unshift([BLADE_SPECIALS[it.base].name, BLADE_SPECIALS[it.base].desc]);
    if (/dragon/.test(it.base)) abilities.push(['Dragonforged', 'Made from a dragon: tough and fierce']);
    if (def.minRarity >= 3) abilities.push(['Legendary Relic', 'Only ever found as Legendary']);
    if (!abilities.length) abilities.push(['Reliable', 'Honest, well made gear with no tricks']);

    const iconKey = gearIconKey(it) || 'items/relic';
    const bars = stats.map((s, i) => {
      const pct = Math.max(3, Math.min(100, (s.value / s.max) * 100));
      const diff = s.compare != null && worn && worn.id !== it.id ? s.value - s.compare : null;
      return h('div.an-stat', { style: { animationDelay: `${0.9 + i * 0.12}s` } },
        h('div.an-stat-top', h('span', s.label), h('b', s.text),
          diff ? h(`span.an-diff.${diff > 0 ? 'up' : 'down'}`, diff > 0 ? '▲' : '▼') : ''),
        h('div.an-bar', h('div', { style: { '--w': `${pct}%`, animationDelay: `${1.0 + i * 0.12}s`, background: `linear-gradient(90deg, ${R.color}88, ${R.color})` } })));
    });
    const abil = abilities.map(([name, text], i) => h('div.an-ability', { style: { animationDelay: `${1.2 + stats.length * 0.12 + i * 0.15}s` } },
      h('span.an-ability-mark', '◆'), h('div', h('b', name), h('div.faint', text))));
    const bg = h('div.analyze-bg', { onclick: e => { if (e.target === bg) close(); } },
      h('div.analyze', { style: { '--rarity': R.color } },
        h('div.an-stage',
          h('div.an-rays'),
          h('div.an-ring'), h('div.an-ring.two'),
          h('div.an-item', icon(iconKey, 128)),
          h('div.an-scan')),
        h('div.an-body',
          h('div.an-rarity', R.name.toUpperCase()),
          h('h2.an-name', it.name),
          h('div.an-kind.faint', `${def.name || it.base} · ${it.slot}`),
          h('div.an-stats', bars),
          h('h3.an-head', 'Special abilities'),
          h('div.an-abilities', abil),
          h('button.modal-x.an-x', { title: 'Close', onclick: () => close() }, hasArt('ui/close') ? icon('ui/close', 18) : '✕'))));
    const close = () => { bg.classList.add('closing'); setTimeout(() => bg.remove(), 200); };
    document.getElementById('ui').append(bg);
    play('ability');
  }

/** Analyze a tool: its power, speed and yield, what it can mine, its material and how to craft it (same look as gear). */
  analyzeTool(key) {
    const g = this.game;
    const t = TOOLS[key];
    if (!t) return;
    const power = t.power || 0;
    const rarity = power > 10 ? 4 : power >= 9 ? 3 : power >= 6 ? 2 : power >= 3 ? 1 : 0;
    const R = RARITY[rarity];
    const stats = [];
    const bar = (label, value, max, text) => ({ label, value, max, text });
    if (t.power != null) stats.push(bar('Power', power, 14, String(power)));
    const base = { pickaxe: 2, axe: 3 }[t.kind];
    if (base) {
      const hits = Math.max(1, base + 1 - Math.floor((power + 1) / 3));
      stats.push(bar('Swings per rock or tree', 1 / hits, 1, `${hits}`));
      stats.push(bar('Yield', 1 + power * 0.12, 3, `x${(1 + power * 0.12).toFixed(2)}`));
    }
    if (t.kind === 'shovel') stats.push(bar('Digs per find', 1 / Math.max(1, 4 - Math.floor(power / 3)), 1, String(Math.max(1, 4 - Math.floor(power / 3)))));
    if (t.kind === 'hammer') stats.push(bar('Build speed', 1 + power * 0.15, 3.5, `x${(1 + power * 0.15).toFixed(2)}`));
    const abilities = [[TOOL_KINDS[t.kind]?.name || t.name, t.does]];
    if (t.kind === 'pickaxe') {
      const ores = Object.entries(OBJECTS).filter(([, d]) => d.work === 'mine' && d.tier).sort((a, b) => a[1].tier - b[1].tier);
      const can = ores.filter(([, d]) => d.tier <= power).map(([k]) => k.replace(/_ore$/, '').replace(/_/g, ' '));
      const next = ores.find(([, d]) => d.tier > power);
      abilities.push(['Can mine', can.length ? can.join(', ') : 'only plain rock']);
      if (next) abilities.push(['Too weak for', `${next[0].replace(/_ore$/, '').replace(/_/g, ' ')} (needs power ${next[1].tier})`]);
      else abilities.push(['Master pickaxe', 'Mines every ore in the world']);
    }
    if (t.mythic) abilities.push(['Mythic', 'Made from a rare mythic material']);
    for (const [k, l] of Object.entries(rpgOf(g).toolEnch?.[key] || {})) if (ENCHANTS[k]) abilities.push([`Enchanted: ${enchName(k, l)}`, ENCHANTS[k].desc(l)]);
    const recipe = RECIPES.find(r => r.id === `tool:${key}`);
    const owned = toolsOf(g)[key] || 0;
    const iconKey = hasArt(t.icon) ? t.icon : t.fallbackIcon || 'items/relic';
    const bars = stats.map((s, i) => h('div.an-stat', { style: { animationDelay: `${0.9 + i * 0.12}s` } },
      h('div.an-stat-top', h('span', s.label), h('b', s.text)),
      h('div.an-bar', h('div', { style: { '--w': `${Math.max(3, Math.min(100, (s.value / s.max) * 100))}%`, animationDelay: `${1.0 + i * 0.12}s`, background: `linear-gradient(90deg, ${R.color}88, ${R.color})` } }))));
    const abil = abilities.map(([name, text], i) => h('div.an-ability', { style: { animationDelay: `${1.2 + stats.length * 0.12 + i * 0.15}s` } }, h('span.an-ability-mark', '◆'), h('div', h('b', name), h('div.faint', text))));
    const bg = h('div.analyze-bg', { onclick: e => { if (e.target === bg) close(); } },
      h('div.analyze', { style: { '--rarity': R.color } },
        h('div.an-stage', h('div.an-rays'), h('div.an-ring'), h('div.an-ring.two'), h('div.an-item', icon(iconKey, 128)), h('div.an-scan')),
        h('div.an-body',
          h('div.an-rarity', R.name.toUpperCase()),
          h('h2.an-name', t.name),
          h('div.an-kind.faint', `${TOOL_KINDS[t.kind]?.name || 'Tool'}${t.mat ? ` · ${t.mat}` : ''} · you have ${owned}`),
          stats.length ? h('div.an-stats', bars) : '',
          h('h3.an-head', 'What it does'),
          h('div.an-abilities', abil),
          recipe ? h('div.an-recipe', h('span.faint', `Craft${needsTable(recipe) ? ' (Crafting Table)' : ' (by hand)'}: `), costChips(recipe.cost, g.state.resources)) : '',
          h('button.modal-x.an-x', { title: 'Close', onclick: () => close() }, hasArt('ui/close') ? icon('ui/close', 18) : '✕'))));
    const close = () => { bg.classList.add('closing'); setTimeout(() => bg.remove(), 200); };
    document.getElementById('ui').append(bg);
    play('ability');
  }

  /** Analyze whatever a hotbar or inventory key is: a tool, or the weapon you carry. */
  analyzeKey(k) {
    if (!k) return;
    if (TOOLS[k]) this.analyzeTool(k);
    else if (k === 'weapon') { const w = rpgOf(this.game).gear.weapon; if (w) this.analyzeGear(w); else this.hint('Equip a weapon to analyze it', 1500); }
    else this.hint('Nothing to analyze there', 1200);
  }

  /** Your character: level, points to spend, gear you wear and loot in your bag. */
  /** Hotbar: nine slots along the bottom. The selected one is what you hold and what your swing does. */
  updateHotbar(v) {
    const bar = this.els.hotbar;
    const g = this.game;
    if (!v || this.houseEditor) { if (!bar.hidden) { bar.hidden = true; this.els.invPanel.hidden = true; } return; }
    const slots = hotbarOf(g);
    const r = rpgOf(g);
    // used up (0 left): the slot empties instead of showing a 0
    slots.forEach((k, i) => { if ((k === 'potion' && !(r.potions > 0)) || (k?.startsWith?.('item:') && !(itemsOf(g)[k.slice(5)] > 0))) slots[i] = null; });
    const w = heroWeapon(g, v);
    const tools = toolsOf(g);
    const key = [slots.join(), r.hotSel, r.potions || 0, w.name, Object.entries(tools).join(), Object.entries(itemsOf(g)).join()].join('|');
    bar.hidden = false;
    if (key === this._hotbarKey) return;
    this._hotbarKey = key;
    bar.replaceChildren(...slots.map((k, i) => {
      const info = this.slotInfo(k, v);
      return h('button.hot-slot' + (i === r.hotSel ? '.on' : '') + (k ? '' : '.empty'), {
        title: info ? `${i + 1}: ${info.name} (drag to move)` : `${i + 1}: empty`,
        dataset: { slot: i },
        onclick: () => { if (this._dragged) return; selectSlot(g, i); this._hotbarKey = null; if (!this.els.invPanel.hidden) this.renderInventory(); },
        oncontextmenu: e => { e.preventDefault(); this.analyzeKey(slots[i]); },
        onpointerdown: e => k && this.startSlotDrag(e, { from: i, value: k, icon: info.icon }),
      }, h('span.hot-num', String(i + 1)), info ? icon(info.icon, 28) : null, info?.count != null ? h('span.hot-count', String(info.count)) : null);
    }), h('button.hot-bag', { title: 'Inventory (I)', onclick: () => this.inventory() }, icon(hasArt('ui/inventory') ? 'ui/inventory' : 'tools/backpack', 24)));
    const held = slots[r.hotSel];
    const info = this.slotInfo(held, v);
    this.els.hotName.textContent = info ? info.name : '';
    if (!this.els.invPanel.hidden) this.renderInventory();
  }

  /**
   * Drag something onto a hotbar slot: from another slot (they swap) or from the inventory grid.
   * Works with a mouse and with a finger; a plain tap still just selects.
   */
  startSlotDrag(e, drag) {
    if (e.button > 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null;
    this._dragged = false;
    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
      if (!ghost) { ghost = h('div.hot-ghost', icon(drag.icon, 32)); document.body.append(ghost); this._dragged = true; }
      ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const over = under?.closest?.('.hot-slot');
      for (const s of this.els.hotbar.querySelectorAll('.hot-slot')) s.classList.toggle('drop', s === over);
      this.els.invPanel.classList.toggle('drop-here', drag.from != null && !!under?.closest?.('.inv-panel'));
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      this.els.invPanel.classList.remove('drop-here');
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const over = under?.closest?.('.hot-slot');
      const to = over ? Number(over.dataset.slot) : -1;
      const g = this.game;
      if (to >= 0) {
        if (drag.from != null) swapSlots(g, drag.from, to);
        else setSlot(g, to, drag.value);
        play('click');
      } else if (drag.from != null && !over) {
        setSlot(g, drag.from, null);   // dragged off the bar or back into the bag: take it out of the hotbar (you still own it)
        play('click');
      }
      this._hotbarKey = null;
      this.updateHotbar(heroOf(this.dungeon || g) || heroOf(g));
      if (!this.els.invPanel.hidden) this.renderInventory();
      setTimeout(() => { this._dragged = false; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** Icon, name and count for a hotbar value. */
  slotInfo(k, v) {
    if (!k) return null;
    const g = this.game;
    if (k === 'weapon') { const w = heroWeapon(g, v); return { name: w.base === 'fists' ? 'Fists' : w.name, icon: gearIconKey(w) || w.icon || 'items/sword' }; }
    if (k === 'potion') return { name: 'Health Potion', icon: 'gear/health_potion', count: rpgOf(g).potions || 0 };
    if (k.startsWith('item:')) { const c = CONSUMABLES[k.slice(5)]; return c ? { name: c.name, icon: c.icon, count: itemsOf(g)[k.slice(5)] || 0, does: c.does } : null; }
    const t = TOOLS[k];
    if (!t) return null;
    const n = toolsOf(g)[k] || 0;
    return { name: t.name, icon: hasArt(t.icon) ? t.icon : t.fallbackIcon, count: n > 1 ? n : null };
  }

  /** The inventory grid opens above the hotbar: click a thing to put it in the selected slot. */
  inventory() {
    const panel = this.els.invPanel;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) this.renderInventory();
  }

/** The Crafting Table menu (at a table), or hand crafting (anywhere). */
  openTable() {
    if (this._tableModal && document.body.contains(this._tableModal.el)) return;
    this._tableModal = openTableMenu(this, { atTable: atTable(this.game, heroOf(this.game)) });
  }

  /** Drop one of whatever you hold (or the hovered inventory slot) on the ground in front of you. */
  dropHeld(key = null) {
    const g = this.dungeon || this.game;
    const bar = hotbarOf(this.game);
    key ||= bar[rpgOf(this.game).hotSel];
    if (!key || key === 'weapon') { this.hint('Nothing to drop', 1000); return; }
    const it = dropStack(g, heroOf(g), key, 1);
    if (!it) { this.hint('Nothing to drop', 1000); return; }
    this._hotbarKey = null;
    if (!this.els.invPanel.hidden) this.renderInventory();
  }

  renderInventory() {
    const g = this.game, panel = this.els.invPanel;
    const v = heroOf(this.dungeon || g) || heroOf(g);
    const r = rpgOf(g);
    const bar = hotbarOf(g);
    const owned = toolsOf(g);
    const cell = (k, extra = '') => {
      const info = this.slotInfo(k, v);
      const inBar = bar.indexOf(k);
      return h('button.inv-cell' + (inBar === r.hotSel ? '.held' : inBar >= 0 ? '.inbar' : '') + extra, {
        title: `${info.name}${info.count > 1 ? ` ×${info.count}` : ''}`,
        // click: into your hotbar (the first empty slot) or, if it is already there, hold it
        onclick: () => {
          if (this._dragged) return;
          if (inBar >= 0) selectSlot(g, inBar);
          else { const free = bar.indexOf(null); setSlot(g, free >= 0 ? free : r.hotSel, k); }
          this._hotbarKey = null; this.renderInventory();
        },
        oncontextmenu: e => { e.preventDefault(); this.dropHeld(k); },   // right-click drops one
        onmouseenter: () => { this._invHover = k; },
        onmouseleave: () => { if (this._invHover === k) this._invHover = null; },
        onpointerdown: e => this.startSlotDrag(e, { from: null, value: k, icon: info.icon }),
      }, icon(info.icon, 30), info.count != null ? h('span.hot-count', String(info.count)) : null, inBar >= 0 ? h('span.hot-num', String(inBar + 1)) : null);
    };
    const keys = Object.keys(owned).filter(k => TOOLS[k]).sort((a, b) => (TOOLS[a].kind > TOOLS[b].kind ? 1 : TOOLS[a].kind < TOOLS[b].kind ? -1 : TOOLS[b].power - TOOLS[a].power));
    const heldInfo = this.slotInfo(bar[r.hotSel], v);
    panel.replaceChildren(
      h('div.inv-head', h('b', 'Inventory'), h('div.spacer'),
        h('button.btn.sm', { title: 'Everything you have found (N)', onclick: () => openIndex(this) }, 'Index'),
        h('button.btn.sm.analyze-btn', { title: 'Analyze the item under your cursor (or what you hold). Tip: right-click a hotbar slot', onclick: () => this.analyzeKey(this._invHover || bar[r.hotSel]) }, 'Analyze'),
        h('button.btn.sm', { title: 'Ores, metals and boss materials', onclick: () => openMaterialsBag(this) }, 'Materials'),
        h('button.btn.sm', { title: 'Craft (C). At a Crafting Table: everything', onclick: () => this.openTable() }, 'Craft'),
        h('button.btn.sm', { title: 'Your gear and stats (G)', onclick: () => this.characterSheet() }, 'Gear'),
        h('button.modal-x.inv-x', { title: 'Close (I)', onclick: () => { panel.hidden = true; } }, hasArt('ui/close') ? icon('ui/close', 16) : '✕')),
      (() => {
        // like Minecraft: what sits in your hotbar is not shown again in here
        const off = k => !bar.includes(k);
        const filled = [...(off('weapon') ? [cell('weapon')] : []), ...((r.potions || 0) > 0 && off('potion') ? [cell('potion')] : []), ...Object.keys(itemsOf(g)).filter(k => CONSUMABLES[k] && itemsOf(g)[k] > 0 && off(`item:${k}`)).map(k => cell(`item:${k}`)), ...keys.filter(off).map(k => cell(k))];
        const size = Math.max(27, Math.ceil(filled.length / 9) * 9);   // a fixed grid of slots, like a chest
        return h('div.inv-cells', ...filled, ...Array.from({ length: size - filled.length }, () => h('div.inv-cell.empty')));
      })(),
      h('div.faint.inv-hint', 'Click: to hotbar · drag a hotbar item here to put it back · right-click: drop'));
    void heldInfo;
  }

  characterSheet() {
    const g = this.game;
    const render = () => {
      const r = rpgOf(g);
      const st = heroStats(g);
      const v = heroOf(g) || avatarOf(g);
      const w = heroWeapon(g, v);
      // one detail bar for whatever you tapped: something you wear, or something in the bag
      const sel = this._bagSel;
      const worn = Object.entries(r.gear).find(([, it]) => it && it.id === sel);
      const picked = worn ? worn[1] : r.bag.find(x => x.id === sel);
      const slotCell = (slot, label) => {
        const it = r.gear[slot];
        return h(`button.doll-slot.doll-${slot}${sel && it?.id === sel ? '.sel' : ''}`, {
          title: it ? `${it.name}: ${gearText(it)}` : `${label}: empty`,
          style: it ? { borderColor: RARITY[it.rarity].color, boxShadow: `inset 0 0 12px ${RARITY[it.rarity].color}44` } : null,
          onclick: () => { if (!it) return; this._bagSel = sel === it.id ? null : it.id; render(); },
        }, it ? icon(gearIconKey(it) || 'items/relic', 32) : h('span.doll-empty', label));
      };
      const attr = (id, label, desc) => h('div.attr-row', { title: desc },
        h('span.attr-name', label), h('b', String(r[id])), h('span.faint.attr-desc', desc),
        h('button.btn.sm.primary.attr-plus', { disabled: !r.points, onclick: () => { spendPoint(g, id); render(); } }, '+'));
      const chip = (label, value) => h('div.stat-chip', h('span', label), h('b', String(value)));
      const xpK = Math.min(1, r.xp / xpToNext(r.level));
      body.replaceChildren(...[
        h('div.char-top',
          h('div', h('h2', v?.name || 'You'), h('div.xp-line', h('span', `Level ${r.level}`), h('div.xp-bar', h('i', { style: { width: `${xpK * 100}%` } })), h('span.faint', `${r.xp}/${xpToNext(r.level)} XP`)))),
        h('div.char-main',
          h('div.doll',
            slotCell('helmet', 'Helmet'), slotCell('weapon', 'Weapon'), slotCell('armor', 'Armour'), slotCell('shield', 'Shield'), slotCell('trinket', 'Trinket'),
            h('div.doll-figure', spriteAvailable(avatarArt(avatarId(g))) ? icon(avatarArt(avatarId(g)), 96) : icon('items/crown_leader', 64)),
            spriteAvailable(avatarArt('king')) ? h('button.btn.sm.ghost.doll-look', { onclick: () => { this._showLook = !this._showLook; render(); } }, this._showLook ? 'Done' : 'Change look') : ''),
          h('div.char-stats',
            h('div.stat-chips', chip('Health', st.maxHp), chip('Stamina', st.maxStamina), chip('Damage', `x${st.dmgMult.toFixed(2)}`), chip('Crit', `${Math.round(st.crit * 100)}%`), chip('Armour', `${Math.round(st.armor * 100)}%`), chip('Speed', `x${st.speed.toFixed(2)}`)),
            h('div.attr-head', h('span', 'Attributes'), r.points ? h('span.points-badge', `${r.points} point${r.points === 1 ? '' : 's'}`) : ''),
            attr('might', 'Might', '+8% damage'), attr('vigor', 'Vigor', '+12 health'), attr('agility', 'Agility', 'stamina, speed, crits'))),
        this._showLook ? h('div.avatar-grid', AVATARS.map(a => h(`button.avatar-opt${avatarId(g) === a.id ? '.on' : ''}`, {
          title: a.name, dataset: { avatar: a.id },
          onclick: () => { setLook(g, a.id); this._showLook = false; render(); },
        }, icon(avatarArt(a.id), 40), h('span', a.name)))) : null,
        picked ? h('div.bag-detail', { style: { borderColor: RARITY[picked.rarity].color } },
          icon(gearIconKey(picked) || 'items/relic', 36),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('b', { style: { color: RARITY[picked.rarity].color } }, picked.name), h('div.faint', `${picked.slot} · ${gearText(picked)}`)),
          h('div.bag-actions',
            h('button.btn.sm.analyze-btn', { onclick: () => this.analyzeGear(picked) }, 'Analyze'),
            worn
              ? h('button.btn.sm', { onclick: () => { unequip(g, worn[0]); this._bagSel = null; render(); } }, 'Take off')
              : h('button.btn.sm.primary', { onclick: () => { equip(g, picked.id); this._bagSel = null; render(); } }, 'Equip'),
            worn ? '' : h('button.btn.sm', { title: 'Break it down for gold', onclick: () => { const gold = scrapGear(g, picked.id); this.hint(`+${gold} gold`, 1500); this._bagSel = null; render(); } }, 'Scrap'))) : null,
        h('div.bag-head', h('b', `Bag (${r.bag.length})`), h('div.spacer'),
          r.bag.some(it => it.rarity <= 1 && gearScore(it) <= gearScore(r.gear[it.slot])) ? h('button.btn.sm', { title: 'Scrap every Common and Rare piece that is no better than what you wear', onclick: () => {
            const junk = r.bag.filter(it => it.rarity <= 1 && gearScore(it) <= gearScore(r.gear[it.slot]));
            let gold = 0; for (const it of junk) gold += scrapGear(g, it.id);
            this.hint(`Scrapped ${junk.length} piece${junk.length === 1 ? '' : 's'}: +${gold} gold`, 1800); this._bagSel = null; render();
          } }, 'Scrap junk') : '',
          r.bag.length ? h('button.btn.sm.primary', { title: 'Put on the best piece you own for every slot', onclick: () => { const n = equipBest(g); this.hint(n ? `Equipped ${n} better piece${n === 1 ? '' : 's'}` : 'You already wear your best gear', 1800); this._bagSel = null; render(); } }, 'Equip best') : ''),
        h('div.bag-grid', ...r.bag.map(it => {
          const better = gearScore(it) > gearScore(r.gear[it.slot]);
          return h('button.bag-cell' + (it.rarity >= 4 ? `.rarity-${RARITY[it.rarity].name.toLowerCase()}` : '') + (sel === it.id ? '.sel' : ''), { title: `${it.name}: ${gearText(it)}`, style: { borderColor: RARITY[it.rarity].color }, onclick: () => { this._bagSel = sel === it.id ? null : it.id; render(); } },
            icon(gearIconKey(it) || 'items/relic', 32), better ? h('span.bag-up', '▲') : '');
        }), ...Array.from({ length: Math.max(0, 18 - r.bag.length) }, () => h('div.bag-cell.empty'))),
      ].filter(Boolean));
    };
    const gearText = it => it.slot === 'shield' ? `blocks ${Math.round((it.block || 0) * 100)}%${it.armor ? ` · +${Math.round(it.armor * 100)}% armour` : ''}` : it.slot === 'weapon' ? `${it.dmg} damage` : it.slot === 'armor' || it.slot === 'helmet' ? `${Math.round(it.armor * 100)}% armour` : Object.entries(it.bonus || {}).map(([k, n]) => k === 'hp' ? `+${n} health` : `+${Math.round(n * 100)}% ${k === 'dmg' ? 'damage' : k}`).join(', ');
    const body = h('div.char-sheet');
    const m = modal([body], { cls: 'char-modal', closeX: true });
    render();
  }
  /** In another land: who you are there, and (as a spy) what you can do right where you stand. */
  updateAbroadBar(abroad, v) {
    const bar = this.els.heroBar;
    const spy = abroad.role === 'spy';
    const here = spy ? spyActions(abroad.land, v) : null;
    const key = ['abroad', abroad.role, v.id, abroad.busy ? 1 : 0, here ? here.actions.map(a => a.id + (a.target?.tx ?? a.target?.x ?? '')).join(',') + here.guards : ''].join('|');
    if (bar.hidden) { bar.hidden = false; this.els.heroPad.hidden = false; this.buildHeroPad(); }
    if (key === this._heroKey) return;
    this._heroKey = key;
    const land = this.visiting?.villageName || 'their land';
    bar.replaceChildren(
      h('div.hero-top', icon(spy ? 'units/spy' : 'items/crown_leader', 22), h('b', v.name), h('div.spacer'),
        h('button.btn.sm', { onclick: () => this.onReturnHome() }, spy ? 'Slip away' : 'Leave')),
      spy
        ? h('div.hero-deeds', `Disguised as a traveller in ${land}. Walk up to a building or a person to act. One act ends the mission.`)
        : h('div.hero-deeds', `Visiting ${land}. Walk around with WASD or the stick.`),
      spy && here.guards ? h('div.hero-bounty', { style: { color: '#ff8a7a' } }, `${here.guards} guard${here.guards === 1 ? '' : 's'} watching: much riskier here`) : '',
      spy ? h('div.row', { style: { flexWrap: 'wrap', gap: '5px' } }, here.actions.map(a => h('button.btn.sm', {
        title: a.desc, disabled: !!abroad.busy, onclick: () => this.spyAct(a, here.guards),
      }, a.label))) : '');
  }

  /** Take control of a spy who has arrived in another land. */
  async infiltrate(m) {
    const g = this.game;
    const agent = g.state.villagers.find(v => v.away?.missionId === m.id);
    if (!agent || !this.mp) { this.hint('Your spy is no longer there', 3000); return; }
    let profile, land;
    try {
      profile = await getProfile(m.to);
      land = makeVisitGame({ ...profile, uid: m.to });
    } catch (e) { this.hint(e.message || 'Could not reach that land', 4000); return; }
    this.mp.infiltrating = m.id;
    this.onAbroad?.(land, { ...profile, uid: m.to, spy: true });
    const copy = arriveAbroad(land, agent, { role: 'spy' });
    this.abroad = { land, role: 'spy', mission: m, hostUid: m.to, strangerId: `${this.user.uid}_${m.id}` };
    this.joinIsland(land, m.to);
    Object.assign(this.renderer.camera, { x: copy.x, y: copy.y, zoom: 2.4 });
    this.hint(`You are ${agent.name}, disguised in ${profile.villageName}. Walk to a building or a person and choose what to do.`, 7000);
  }

  /** Visiting: your avatar arrives at the edge of their village and you walk it about. */
  arriveAsVisitor(land, profile) {
    const person = avatarOf(this.game);
    if (!person) return;
    const copy = arriveAbroad(land, person, { role: 'visitor' });
    this.abroad = { land, role: 'visitor', hostUid: profile.uid, strangerId: this.user.uid };
    this.joinIsland(land, profile.uid);
    Object.assign(this.renderer.camera, { x: copy.x, y: copy.y, zoom: 2.4 });
  }

  /** On someone else's island: see the players there live, and fight them. */
  joinIsland(land, hostUid) {
    if (!this.mp) return;
    land.pvp = (uid, dmg, x, y, name) => this.mp.sendHit(uid, dmg, x, y, name);
    this.mp.watchIsland(hostUid, land);
  }

  /** Another player hit you: it lands on whoever you are playing right now (not while you are in a dungeon or at home indoors). */
  takePlayerHit(hit) {
    if (this.dungeon) return;
    const g = this.abroad?.land || this.game;
    const v = heroOf(g);
    if (!v || !g.hero) return;
    const from = { x: hit.x, y: hit.y };
    const dmg = damageHero(g, v, hit.dmg, from);
    if (!dmg) return;
    v.hp -= dmg;
    v._hurtFlash = 0.25;
    g.fx.shake = Math.max(g.fx.shake, 0.6);
    g.float(v.x, v.y - TILE * 1.3, `-${Math.round(dmg)}`, '#ff6a5a');
    if (v.hp <= 0) { knockOutHero(g, v); this.toast({ text: `${hit.name || 'Another player'} knocked you out`, kind: 'bad' }); }
  }

  leaveAbroad() {
    const ab = this.abroad;
    if (!ab) return;
    this.mp?.clearStranger(ab.hostUid, ab.strangerId);
    this.mp?.unwatchIsland();
    if (ab.mission && this.mp?.infiltrating === ab.mission.id) this.mp.infiltrating = null;   // the spy waits; take control again before time runs out
    leaveAbroad(ab.land);
    this.abroad = null;
  }

  async spyAct(action, guards) {
    const ab = this.abroad;
    if (!ab?.mission || ab.busy) return;
    ab.busy = true;
    this._heroKey = null;
    try {
      const done = await this.mp.actInPerson(ab.mission, action.id, action.target || null, guards);
      const r = done?.result;
      if (!r) { this.hint('Too late: the mission was already decided.', 4000); return; }
      const t = action.target;
      if (r.success && t) {
        const spot = t.tx != null ? { x: (t.tx + 1) * TILE, y: (t.ty + 1) * TILE } : { x: t.x, y: t.y };
        ab.land.puff(spot, action.id === 'sabotage' ? 'effects/flame' : 'effects/hit_star', 14, 24);
        if (action.id === 'assassinate') ab.land.state.villagers = ab.land.state.villagers.filter(o => Math.hypot(o.x - t.x, o.y - t.y) > 8 || o.id.startsWith('abroad_'));
      }
      const text = r.caught ? 'Caught! The guards drag your spy away.'
        : r.success ? { sabotage: 'It burns! Now slip away.', steal: `You got away with ${r.gold || 0} gold!`, assassinate: 'It is done.', incite: 'They will turn on their ruler.', scout: 'You have counted everything.' }[action.id] || 'Done.'
          : 'It went wrong, but you escaped.';
      this.announce(text);
      this.hint(text, 4000);
      setTimeout(() => { if (this.abroad === ab) this.onReturnHome(); }, 2500);
    } catch (e) {
      this.hint(e.message, 3000);
    } finally {
      ab.busy = false;
      this._heroKey = null;
    }
  }

  /** On-screen stick and ACT button (shown on touch screens). */
  buildHeroPad() {
    const t = this.leadInput;
    const knob = h('div.hero-knob');
    const stick = h('div.hero-stick', knob);
    let id = null;
    const move = e => {
      const r = stick.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      t.mx = Math.abs(dx) > 0.15 ? dx : 0; t.my = Math.abs(dy) > 0.15 ? dy : 0;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    const end = () => { id = null; t.mx = 0; t.my = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; stick.setPointerCapture?.(id); move(e); });
    stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    const hold = (cls, key, label, iconKey, size) => {
      const b = h(`button.${cls}`, {
        onpointerdown: e => { e.preventDefault(); t[key] = true; b.classList.add('down'); },
        onpointerup: () => { t[key] = false; b.classList.remove('down'); },
        onpointerleave: () => { t[key] = false; b.classList.remove('down'); },
        onpointercancel: () => { t[key] = false; b.classList.remove('down'); },
      }, iconKey ? icon(iconKey, size) : null, h('span', label));
      return b;
    };
    const act = hold('hero-act', 'act', 'ATTACK', 'items/sword', 30);
    const dash = hold('hero-dash', 'dash', 'DASH', null, 0);
    const block = hold('hero-block', 'block', 'BLOCK', 'items/shield', 20);
    const potion = hold('hero-potion', 'potion', '', 'gear/health_potion', 26);
    this.els.potionCount = h('span.hero-potion-count', '0');
    potion.append(this.els.potionCount);
    const ability = h('button.hero-btn.hero-ability', { title: 'Weapon ability (F)', onpointerdown: e => { e.preventDefault(); useWeaponAbility(this.dungeon || this.game); } }, icon('effects/magic_orb', 22), h('span', 'SKILL'), h('i.ability-cd'));
    this.els.abilityBtn = ability;
    this.els.heroPad.replaceChildren(stick, act, dash, block, potion, ability);
  }

  /** Cancel / Done / Undo buttons while placing or demolishing: the on-screen right-click and Esc. */
  updateTouchBar() {
    const mode = this.buildType ? `build:${this.buildType}` : this.demolishMode ? 'demolish' : '';
    const key = `${mode}|${this.undoStack?.length ? 1 : 0}`;
    if (this._touchKey === key) return;
    this._touchKey = key;
    const bar = this.els.touchBar;
    bar.hidden = !mode;
    if (!mode) { bar.replaceChildren(); return; }
    const undo = this.undoStack?.length && !this.mobilePlace ? h('button.btn', { onclick: () => this.undo() }, 'Undo') : null;
    const buildHere = this.mobilePlace && this.buildType ? h('button.btn.primary.build-here', { onclick: () => this.placeHere() }, 'Build here') : null;
    bar.replaceChildren(...[
      h('span.touch-label', this.buildType ? `Placing ${BUILDINGS[this.buildType].name}` : 'Demolishing'),
      undo,
      buildHere,
      this.buildType
        ? h('button.btn.danger', { onclick: () => this.cancelBuild() }, 'Cancel')
        : h('button.btn.primary', { onclick: () => this.toggleDemolish(false) }, 'Done'),
    ].filter(Boolean));
  }

  // ------------------------------------------------------------ goals
  toggleGoals() {
    const on = this.els.goals.classList.toggle('collapsed');
    try { localStorage.setItem('hb-goals-collapsed', on ? '1' : '0'); } catch {}
  }

  /** Top bar: owned materials after the main resources, as many as fit, then +N for the rest. */
  updateResOverflow() {
    const s = this.game.state, card = this.els.resCard, more = this.els.resMore;
    for (const k of MATERIAL_KEYS) {
      if (TOP_RES.includes(k)) continue;
      const n = Math.floor(s.resources[k] || 0);
      let e = this.els.matRes[k];
      if (n > 0 && !e) {
        const v = h('span.v', '0');
        e = this.els.matRes[k] = { v, el: h('div.res.mat-res', { title: MATERIALS[k].name, onclick: () => openMaterialsBag(this) }, icon(matIcon(k), 24), h('div', v)) };
        card.insertBefore(e.el, more);
      } else if (!n && e) { e.el.remove(); delete this.els.matRes[k]; continue; }
      if (e) { const t = fmt(n); if (e.v.textContent !== t) e.v.textContent = t; }
    }
    const all = [...card.querySelectorAll('.res:not(.res-more)')].filter(el => !el.hidden);
    const key = `${innerWidth}x${innerHeight}|${all.map(el => el.textContent).join()}`;
    if (key === this._resFitKey) return;
    this._resFitKey = key;
    for (const el of all) el.classList.remove('overflow');
    more.hidden = true;
    const tooBig = () => card.scrollWidth > card.clientWidth + 1 || card.offsetHeight > 80;   // items do not shrink, so an overfull bar shows up as overflow
    let hidden = 0;
    for (let i = all.length - 1; i > 0 && tooBig(); i--) {
      all[i].classList.add('overflow');
      hidden++;
      more.hidden = false;
      more.firstChild.textContent = `+${hidden}`;
    }
    more.title = hidden ? `${hidden} more: open your Materials` : 'More materials';
  }

  /** Rebuild the rows only when the set of goals (or which are done) changes; otherwise just move the bars. */
  updateGoals() {
    const g = this.game;
    const box = this.els.goals;
    box.hidden = !!this.visiting || !on('goals');
    if (this.visiting || !on('goals')) return;
    // on phones the status bar wraps to different heights: sit just below it
    if (innerWidth <= 760) {
      const top = `${Math.round((this.root.querySelector('.statusbar')?.getBoundingClientRect().bottom || 118) + 6)}px`;
      if (box.style.top !== top) box.style.top = top;
    } else if (box.style.top) box.style.top = '';
    const goals = activeGoals(g);
    const { era, done, total } = goalsLeftInEra(g);
    const headText = `Goals · ${ERAS[era].name} ${done}/${total}`;
    const ready = goals.filter(x => x.done).length;
    const headKey = headText + ready;
    if (this._goalsHead !== headKey) {
      this._goalsHead = headKey;
      this.els.goalsHead.replaceChildren(...[icon('items/star_rank', 20), h('span', headText), ready ? h('span.goals-ready', `${ready} ready`) : null, h('span.goals-caret', '▾')].filter(Boolean));
    }
    const key = goals.map(x => x.id + (x.done ? '!' : '')).join();
    if (this._goalsKey !== key) {
      this._goalsKey = key;
      this.goalRows = {};
      this.els.goalsList.replaceChildren(...(goals.length ? goals.map(goal => {
        const fill = h('i');
        const count = h('span.goal-count');
        const row = h(`div.goal${goal.done ? '.done' : ''}`,
          icon(goal.icon, 26),
          h('div.goal-body',
            h('div.goal-text', goal.text),
            h('div.goal-bar', fill),
            h('div.goal-reward', rewardText(goal.reward))),
          goal.done
            ? h('button.btn.sm.primary.goal-claim', { onclick: () => this.claimGoal(goal.id) }, 'Claim')
            : count);
        this.goalRows[goal.id] = { fill, count };
        return row;
      }) : [h('div.faint', { style: { padding: '4px 2px' } }, 'Every goal done. You rule a legend.')]));
    }
    for (const goal of goals) {
      const r = this.goalRows?.[goal.id];
      if (!r) continue;
      const pct = `${Math.round((goal.have / goal.need) * 100)}%`;
      if (r.fill.style.width !== pct) r.fill.style.width = pct;
      const text = `${fmt(goal.have)}/${fmt(goal.need)}`;
      if (r.count.textContent !== text) r.count.textContent = text;
    }
  }

  claimGoal(id) {
    const r = claimGoal(this.game, id);
    if (!r) return;
    play('complete');
    const c = this.game.center;
    this.game.float(c.x, c.y - TILE * 2, `Goal complete! ${rewardText(r.goal.reward)}`, '#ffcf5a');
    this.game.puff({ x: c.x, y: c.y - TILE }, 'effects/coin', 14, 40);
    if (r.chest) play('ability');   // the game announces the chest itself
    this._goalsKey = null;
    this.updateGoals();
  }

  // ------------------------------------------------------------ world interaction
  onHover(tx, ty, w) {
    this.renderer.hoverTile = { tx, ty };
    if (w) this.game.cursor = { x: w.x, y: w.y };   // where admin drop puts things
    if (this.buildType && !this.placeDrag) {
      const size = BUILDINGS[this.buildType].size;
      const ax = tx - Math.floor((size - 1) / 2), ay = ty - Math.floor((size - 1) / 2);
      this.renderer.ghost = { type: this.buildType, tx: ax, ty: ay, ok: this.game.canPlace(this.buildType, ax, ay).ok };
    }
  }

  onClick(w, tx, ty, shift) {
    const g = this.game;
    if (this.buildType) {
      if (this.mobilePlace) { this.mobilePlace.manual = true; this.onHover(tx, ty); return; }
      const gh = this.renderer.ghost;
      if (!gh) return;
      const res = g.placeBuilding(this.buildType, gh.tx, gh.ty);
      if (!res.ok) { this.hint(res.why, 1800); return; }
      this.pushUndo({ kind: 'place', buildings: [res.building] });
      play('build');
      // walls and gates stay in placement mode so you can draw lines of them
      if (!shift && !this.buildType.startsWith('wall') && !this.buildType.startsWith('gate')) this.cancelBuild();
      return;
    }
    // something to pick up
    const find = findAt(g, w.x, w.y);
    if (find) {
      const r = collectFind(g, find);
      if (r) { play('coin'); this.hint(r.text, 2500); }
      return;
    }
    // stepping onto a bridge: cross into the neighbour's land
    const bridge = bridgeAt(g.bridges, tx, ty);
    if (bridge) { this.bridgePrompt(bridge); return; }
    // pick the closest thing under the cursor
    let best = null, bd = TILE * 0.7;
    for (const v of g.state.villagers) {
      if (v.away) continue;
      const d = Math.hypot(v.x - w.x, v.y - TILE * 0.4 - w.y);
      if (d < bd) { bd = d; best = { kind: 'villager', ref: v }; }
    }
    for (const c of g.state.creatures) {
      const def = CREATURES[c.t];
      const d = Math.hypot(c.x - w.x, c.y - def.size * TILE * 0.4 + (def.flying ? -TILE * 1.2 : 0) - w.y);
      if (d < Math.max(bd, def.size * TILE * 0.5) && d < bd + 4) { bd = d; best = { kind: 'creature', ref: c }; }
    }
    if (!best) {
      const b = g.buildingAt(tx, ty) || g.buildingAt(tx, ty + 1);
      if (b) best = { kind: 'building', ref: b };
    }
    if (!best) {
      const o = g.world.objectAt(tx, ty) || g.world.objectAt(tx, ty + 1);
      if (o) best = { kind: 'object', ref: o };
    }
    this.select(best);
  }

  select(sel) {
    this.game.selected = sel;
    this.follow = null;
    this.inspectorKey = null;
    this.updateInspector(true);
  }

  // ---- grid placement: drag to fill an area (walls trace the outline)
  anchorOf(type, tx, ty) {
    const size = BUILDINGS[type].size;
    return { tx: tx - Math.floor((size - 1) / 2), ty: ty - Math.floor((size - 1) / 2) };
  }

  planArea(type, a, b) {
    const def = BUILDINGS[type];
    const step = def.size;
    const outline = /^(wall|gate)_/.test(type);
    const x0 = Math.min(a.tx, b.tx), x1 = Math.max(a.tx, b.tx);
    const y0 = Math.min(a.ty, b.ty), y1 = Math.max(a.ty, b.ty);
    const spots = [];
    // step outward from the anchor so the grid stays aligned to where you started
    const xs = [], ys = [];
    for (let x = a.tx; x >= x0; x -= step) xs.push(x);
    for (let x = a.tx + step; x <= x1; x += step) xs.push(x);
    for (let y = a.ty; y >= y0; y -= step) ys.push(y);
    for (let y = a.ty + step; y <= y1; y += step) ys.push(y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    for (const y of ys.sort((p, q) => p - q)) {
      for (const x of xs.sort((p, q) => p - q)) {
        if (outline && x !== minX && x !== maxX && y !== minY && y !== maxY) continue;
        spots.push({ tx: x, ty: y });
        if (spots.length >= 300) break;
      }
    }
    // mark what fits and what the treasury can pay for, in placement order
    const budget = { ...this.game.state.resources };
    let affordable = 0;
    for (const sp of spots) {
      sp.ok = this.game.canPlace(type, sp.tx, sp.ty, { ignoreCost: true }).ok;
      if (!sp.ok) continue;
      sp.afford = Object.entries(def.cost).every(([k, n]) => budget[k] >= n);
      if (sp.afford) { for (const [k, n] of Object.entries(def.cost)) budget[k] -= n; affordable++; }
    }
    const valid = spots.filter(sp => sp.ok).length;
    return { spots, valid, affordable };
  }

  // ---- undo (Ctrl+Z): the last placement or demolish
  pushUndo(action) {
    this.undoStack ||= [];
    this.undoStack.push({ ...action, at: Date.now() });
    if (this.undoStack.length > 20) this.undoStack.shift();
  }

  undo() {
    const g = this.game;
    const a = this.undoStack?.pop();
    if (!a) { this.hint('Nothing to undo', 1200); return false; }
    if (a.kind === 'place') {
      // remove what was placed; unfinished buildings give their full cost back
      let n = 0;
      for (const b of a.buildings) {
        if (!g.state.buildings.includes(b)) continue;
        const refund = b.built ? 0.4 : 1;
        for (const [k, v] of Object.entries(BUILDINGS[b.type].cost)) g.state.resources[k] += Math.floor(v * refund);
        g.state.buildings = g.state.buildings.filter(x => x !== b);
        n++;
      }
      g.recalc();
      this.hint(`Undid placing ${n} building${n === 1 ? '' : 's'}`, 1500);
    } else if (a.kind === 'demolish') {
      // bring the buildings back and take the refund again (if you still have it)
      let n = 0;
      for (const snap of a.buildings) {
        const size = sizeOf(snap);
        let free = true;
        for (let y = 0; y < size && free; y++) for (let x = 0; x < size; x++) if (g.buildingAt(snap.tx + x, snap.ty + y)) { free = false; break; }
        if (!free) continue;
        g.state.buildings.push({ ...snap });
        n++;
      }
      for (const [k, v] of Object.entries(a.refund || {})) g.state.resources[k] = Math.max(0, g.state.resources[k] - v);
      g.recalc();
      this.hint(`Restored ${n} building${n === 1 ? '' : 's'}`, 1500);
    }
    play('undo');
    g.emit('change');
    return true;
  }

  // ---- demolish tool (X): click a building or drag a box over many
  toggleDemolish(on = !this.demolishMode) {
    if (on) { this.cancelBuild(); this.select(null); }
    this.demolishMode = on;
    this.demolishDrag = null;
    this.renderer.ghost = null;
    this.planTip?.remove();
    if (on) this.hint(TOUCH ? 'Demolish: tap a building or drag a box over many · tap Done to stop' : '🗑 Demolish — click a building or drag a box over many · X / Esc / right-click to stop');
    else this.hintEl?.remove();
  }

  buildingsInBox(a, b) {
    const x0 = Math.min(a.tx, b.tx), x1 = Math.max(a.tx, b.tx), y0 = Math.min(a.ty, b.ty), y1 = Math.max(a.ty, b.ty);
    return this.game.state.buildings.filter(bd => {
      const s = sizeOf(bd);
      return bd.tx <= x1 && bd.tx + s - 1 >= x0 && bd.ty <= y1 && bd.ty + s - 1 >= y0;
    });
  }

  demolishPreview(tx, ty) {
    const d = this.demolishDrag;
    const list = this.buildingsInBox(d.start, { tx, ty });
    d.list = list;
    this.renderer.ghost = { demolish: list, box: { x0: Math.min(d.start.tx, tx), y0: Math.min(d.start.ty, ty), x1: Math.max(d.start.tx, tx), y1: Math.max(d.start.ty, ty) } };
    this.planTip?.remove();
    if (list.length) {
      this.planTip = h('div.plan-tip', h('b', `🗑 ${list.length} building${list.length === 1 ? '' : 's'}`), costChips(this.refundOf(list), this.game.state.resources), h('span.faint', 'back'));
      this.root.append(this.planTip);
    }
  }

  refundOf(list) {
    const total = {};
    for (const b of list) for (const [k, v] of Object.entries(BUILDINGS[b.type].cost)) total[k] = (total[k] || 0) + Math.floor(v * (b.built ? 0.4 : 0.8));
    return total;
  }

  async demolishMany(list) {
    if (!list.length) return;
    const names = {};
    for (const b of list) names[BUILDINGS[b.type].name] = (names[BUILDINGS[b.type].name] || 0) + 1;
    const summary = Object.entries(names).map(([n, c]) => `${c}× ${n}`).join(', ');
    const ok = list.length === 1 || await confirmModal(`Demolish ${list.length} buildings?`, `${summary}. You get back 40% of their cost (80% if unfinished).`, { okLabel: 'Demolish', okClass: 'danger' });
    if (!ok) return;
    const before = { ...this.game.state.resources };
    const removed = list.filter(b => this.game.state.buildings.includes(b)).map(b => ({ ...b }));
    for (const b of list) if (this.game.state.buildings.includes(b)) this.game.demolish(b);
    const refund = Object.fromEntries(Object.keys(before).map(k => [k, this.game.state.resources[k] - before[k]]).filter(([, v]) => v > 0));
    this.pushUndo({ kind: 'demolish', buildings: removed, refund });
    play('demolish');
    if (this.game.selected?.kind === 'building' && !this.game.state.buildings.includes(this.game.selected.ref)) this.select(null);
    this.hint(`Demolished ${list.length} building${list.length === 1 ? '' : 's'}`, 1600);
  }

  onPlaceStart(tx, ty) {
    if (this.demolishMode) { this.demolishDrag = { start: { tx, ty } }; this.demolishPreview(tx, ty); return; }
    if (!this.buildType) return;
    if (this.mobilePlace) { this.mobilePlace.manual = true; this.onHover(tx, ty); return; }   // a tap moves the house, Build here places it
    const start = this.anchorOf(this.buildType, tx, ty);
    this.placeDrag = { start };
    this.onPlaceMove(tx, ty);
  }

  onPlaceMove(tx, ty) {
    if (this.demolishMode) { if (this.demolishDrag) this.demolishPreview(tx, ty); return; }
    if (this.mobilePlace) { this.mobilePlace.manual = true; this.onHover(tx, ty); return; }
    const d = this.placeDrag;
    if (!d || !this.buildType) return;
    const type = this.buildType;
    const def = BUILDINGS[type];
    const end = this.anchorOf(type, tx, ty);
    d.plan = this.planArea(type, d.start, end);
    this.renderer.ghost = { type, spots: d.plan.spots };
    const total = {};
    for (const [k, n] of Object.entries(def.cost)) total[k] = n * d.plan.valid;
    const lacking = d.plan.valid - d.plan.affordable;
    this.planTip?.remove();
    if (d.plan.spots.length > 1) {
      this.planTip = h('div.plan-tip',
        h('b', `${d.plan.valid} × ${def.name}`),
        costChips(total, this.game.state.resources),
        lacking > 0 ? h('span.chip.bad', `can afford ${d.plan.affordable}`) : null);
      this.root.append(this.planTip);
    }
  }

  onPlaceEnd(tx, ty, shift) {
    if (this.demolishMode) {
      const dd = this.demolishDrag;
      this.demolishDrag = null;
      this.planTip?.remove();
      this.renderer.ghost = null;
      if (dd) { if (!dd.list) this.demolishPreview(tx, ty); this.renderer.ghost = null; this.demolishMany(dd.list || []); }
      return;
    }
    if (this.mobilePlace) return;
    const d = this.placeDrag;
    this.placeDrag = null;
    this.planTip?.remove();
    if (!d || !this.buildType) return;
    if (!d.plan) this.onPlaceMove(tx, ty);
    const type = this.buildType;
    const spots = (d.plan?.spots || []).filter(sp => sp.ok);
    if (!spots.length) {
      const why = this.game.canPlace(type, d.start.tx, d.start.ty).why || 'Cannot build there';
      this.hint(why, 1800);
      this.onHover(tx, ty);
      return;
    }
    let placed = 0;
    const made = [];
    for (const sp of spots) {
      if (!this.game.canAfford(BUILDINGS[type].cost)) break;
      const r = this.game.placeBuilding(type, sp.tx, sp.ty);
      if (r.ok) { placed++; made.push(r.building); }
    }
    if (made.length) { this.pushUndo({ kind: 'place', buildings: made }); play('build'); }
    const multi = (d.plan?.spots.length || 0) > 1;
    if (!placed) this.hint('Not enough resources', 1800);
    else if (multi) this.hint(`Placed ${placed} × ${BUILDINGS[type].name}${placed < spots.length ? ` — ran out of resources for ${spots.length - placed}` : ''}`, 2500);
    const keep = shift || multi || /^(wall|gate)_/.test(type);
    if (placed && !keep) this.cancelBuild();
    else this.onHover(tx, ty);
  }

  startBuild(type) {
    if (this.demolishMode) this.toggleDemolish(false);
    this.buildType = type;
    this.lastBuild = type;
    this.select(null);
    if (MOBILE_PLACE() && !this.desktopPlace) {   // on a phone: close the menu, the house appears in front of you
      this.closePanel();
      this.mobilePlace = { manual: false };
      this.root.classList.add('placing-mobile');
      this._touchKey = null;
      this.hint(`Walk to move the ${BUILDINGS[type].name} (or tap the ground), then tap Build here`, 4000);
      return;
    }
    this.hint(TOUCH ? `Placing ${BUILDINGS[type].name}: tap to build · drag to fill an area · tap Cancel to stop` : `Placing ${BUILDINGS[type].name} — click to build · drag to fill an area · Right-click/Esc to cancel`);
  }

  /** Phones: place the house where its outline stands. */
  placeHere() {
    const gh = this.renderer.ghost, type = this.buildType;
    if (!gh || !type) return;
    const res = this.game.placeBuilding(type, gh.tx, gh.ty);
    if (!res.ok) { this.hint(res.why, 1800); return; }
    this.pushUndo({ kind: 'place', buildings: [res.building] });
    play('build');
    this.cancelBuild();
    this.hint(this.game.solo ? `${BUILDINGS[type].name} site placed: swing at it to build it` : `${BUILDINGS[type].name} placed`, 3000);
  }

  cancelBuild() {
    this.buildType = null;
    this.mobilePlace = null;
    this.root.classList.remove('placing-mobile');
    this._touchKey = null;
    this.placeDrag = null;
    this.planTip?.remove();
    this.renderer.ghost = null;
    this.hintEl?.remove();
    this.softRefresh();
  }

  hint(text, ms = 0) {
    this.hintEl?.remove();
    this.hintEl = h('div.hint', text);
    this.root.append(this.hintEl);
    if (ms) { const el = this.hintEl; setTimeout(() => { el.remove(); if (this.buildType) this.startBuildHintRestore(); }, ms); }
    return this.hintEl;
  }

  clearHint(el) { if (el && this.hintEl === el) { el.remove(); this.hintEl = null; } }

  startBuildHintRestore() {
    if (this.buildType && !this.root.contains(this.hintEl)) this.hint(TOUCH ? `Placing ${BUILDINGS[this.buildType].name}: tap or drag to build · tap Cancel to stop` : `Placing ${BUILDINGS[this.buildType].name} — click or drag to build · Right-click/Esc to cancel`);
  }

  // ------------------------------------------------------------ panels
  togglePanel(id) { if (this.panel === id) this.closePanel(); else this.openPanel(id); }

  openPanel(id) {
    // switching tabs inside the same dock group keeps the panel: no slide-in animation replay
    if (this.panelEl && this.panel && groupOf(this.panel) && groupOf(this.panel) === groupOf(id)) {
      this.friendsUnsub?.();
      this.friendsUnsub = null;
      this.panel = id;
      this.els.dock[id]?.classList.add('on');
      this.panelEl.querySelector('.side-body')?.scrollTo?.(0, 0);
      this.refreshPanel();
      return;
    }
    this.closePanel();
    this.panel = id;
    this.els.dock[id]?.classList.add('on');
    this.panelEl = h('div.card.side');
    this.root.append(this.panelEl);
    this.refreshPanel();
  }

  closePanel() {
    this.friendsUnsub?.();
    this.friendsUnsub = null;
    if (this.panel) this.els.dock[this.panel]?.classList.remove('on');
    this.panel = null;
    this.panelEl?.remove();
    this.panelEl = null;
  }

  head(ic, title, sub) {
    return h('div.side-head', icon(ic, 32), h('div', h('h2', title), sub ? h('div.faint', sub) : null), h('div.spacer'),
      h('button.btn.icon.ghost.panel-x', { onclick: () => this.closePanel(), title: 'Close' }, '✕'),
      h('button.btn.sm.panel-back', { onclick: () => this.closePanel() }, '‹ Back'));
  }

  refreshPanel() {
    if (!this.panelEl) return;
    const scroll = this.panelEl.querySelector('.side-body')?.scrollTop || 0;
    const fn = {
      build: () => this.buildPanel(), craft: () => this.craftPanel(), jobs: () => this.jobsPanel(), court: () => this.courtPanel(), deeds: () => this.deedsPanel(), log: () => this.logPanel(), empire: () => this.empirePanel(),
      world: () => this.worldPanel(), ranks: () => this.ranksPanel(), settings: () => this.settingsPanel(),
    }[this.panel];
    if (!fn) return;
    const content = fn();
    if (!content) return;
    const grp = groupOf(this.panel);
    if (grp) this.groupTab[grp.id] = this.panel;
    if (grp && (grp.tabs.length > 1 || grp.map)) {
      content.splice(1, 0, h('div.tabs.group-tabs',
        grp.tabs.map(([id, label]) => h(`button${id === this.panel ? '.on' : ''}`, { onclick: () => this.openPanel(id) }, label)),
        grp.map ? h('button', { onclick: () => this.openMap() }, '🗺 Realm Map') : null));
    }
    // rebuilt buttons under the pointer would replay their hover fade: no transitions for one frame
    const panel = this.panelEl;
    panel.classList.add('instant');
    panel.replaceChildren(...content.filter(Boolean));
    const body = panel.querySelector('.side-body');
    if (body) body.scrollTop = scroll;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('instant')));
  }

  /** Game-driven refresh: waits while the pointer is over the panel, so buttons don't flicker mid-click. */
  requestRefresh() {
    if (!this.panelEl) return;
    if (!this.panelEl.matches(':hover')) { this.refreshPanel(); return; }
    if (this.pendingRefresh) return;
    this.pendingRefresh = true;
    const panel = this.panelEl;
    const run = () => { panel.removeEventListener('pointerleave', run); clearTimeout(timer); this.pendingRefresh = false; if (this.panelEl === panel) this.refreshPanel(); };
    const timer = setTimeout(run, 1500);   // never wait too long
    panel.addEventListener('pointerleave', run);
  }

  /** cheap refresh for panels whose numbers change constantly */
  softRefresh() {
    const s = this.game.state;
    // structure: things that change what the panel shows → rebuild
    const key = JSON.stringify([this.panel, s.villagers.length, this.buildTab, this.buildType, s.buildings.length,
      s.villagers.map(v => v.job).join(), s.era, s.laws, this.deedsTab]);
    const resKey = JSON.stringify(Object.values(s.resources).map(v => Math.floor(v)));
    if (key !== this.softKey) {
      this.softKey = key; this.resKey = resKey;
      this.refreshPanel();
      return;
    }
    if (resKey === this.resKey) return;
    this.resKey = resKey;
    // only numbers changed: never rebuild under the player's pointer
    if (this.panel === 'build') { this.updateBuildAffordability(); return; }
    const now = performance.now();
    if (this.panelEl?.matches(':hover') || now - (this.lastResRefresh || 0) < 1000) return;
    this.lastResRefresh = now;
    this.refreshPanel();
  }

  /** Craft: tools, weapons, armour and potions from your resources. */
  craftPanel() {
    const g = this.game;
    this.craftCat ??= 'tools';
    this.craftQuery ??= '';
    const tabs = h('div.tabs', CRAFT_CATS.map(([id, name]) => h(`button${this.craftCat === id ? '.on' : ''}`, { onclick: () => { this.craftCat = id; this.craftQuery = ''; this.refreshPanel(); } }, name)));
    const search = h('input.input.build-search', { type: 'search', placeholder: 'Search recipes… (e.g. pickaxe, fire, potion)', value: this.craftQuery });
    const body = h('div.side-body');
    const owned = toolsOf(g);
    const fill = () => {
      const q = this.craftQuery.trim().toLowerCase();
      const list = RECIPES.filter(r => (q ? `${r.name} ${r.desc} ${r.cat}`.toLowerCase().includes(q) : r.cat === this.craftCat))
        .sort((a, b) => Number(needsTable(a)) - Number(needsTable(b)));   // what you can make by hand first
      const table = atTable(g, heroOf(g));
      body.replaceChildren(
        h(`div.craft-station${table ? '.on' : ''}`, icon('buildings/workshop', 28),
          h('div', h('b', table ? 'At a Crafting Table' : 'Crafting by hand'),
            h('div.faint', table ? 'You can craft everything here.' : 'Basics only. Stand by a Crafting Table (Build menu, 10 wood) for the rest.'))),
        ...(q ? [h('div.faint', `${list.length} recipe${list.length === 1 ? '' : 's'} match “${this.craftQuery.trim()}”`)] : []),
        h('div.craft-list', list.map(r => {
          const missing = missingToDiscover(g, r);
          if (missing.length) {   // not found yet: a silhouette and a hint
            return h('div.craft-card.cant.undiscovered',
              h('div.craft-icon', icon(hasArt(r.icon) ? r.icon : r.fallbackIcon || r.icon, 40)),
              h('div.craft-info', h('b', '???'), h('div.faint.craft-desc', `Find ${missing.join(' and ')} to discover`)));
          }
          const ok = canCraft(g, r, heroOf(g));
          const locked = needsTable(r) && !table, owned = ownsTool(g, r);
          const have = r.makes.tool ? owned[r.makes.tool] || 0 : r.makes.potion ? rpgOf(g).potions || 0 : r.makes.item ? itemsOf(g)[r.makes.item] || 0 : null;
          const ic = hasArt(r.icon) ? r.icon : r.fallbackIcon || r.icon;
          return h(`div.craft-card${ok ? '' : '.cant'}`,
            h('div.craft-icon', { style: r.rarity ? { borderColor: RARITY[r.rarity].color } : null }, icon(ic, 40)),
            h('div.craft-info',
              h('b', { style: r.rarity ? { color: RARITY[r.rarity].color } : null }, r.name),
              h('div.faint.craft-desc', r.desc),
              h('div.craft-cost', costChips(r.cost, g.state.resources), locked ? h('span.craft-lock', 'Needs a Crafting Table') : null)),
            h('div.craft-side',
              have != null ? h('span.faint', `Have ${have}`) : null,
              h(`button.btn.sm${ok ? '.primary' : ''}`, { disabled: !ok || !!this._crafting, title: locked ? 'Stand next to a Crafting Table' : '', onclick: e => this.startCraft(r, e.currentTarget.closest('.craft-card'), fill) }, 'Craft')));
        })));
    };
    search.addEventListener('input', () => { this.craftQuery = search.value; fill(); });
    fill();
    return [this.head('items/hammer', 'Craft', `${RECIPES.length} recipes`), tabs, h('div.build-search-row', search), body];
  }

  /** Crafting takes a moment: the hammer rings, sparks fly, a bar fills; then what you made is revealed. */
  startCraft(r, card, refresh, { times = 1 } = {}) {
    if (this._crafting) return;
    const g = this.game, hero = heroOf(this.dungeon || g) || heroOf(g);
    // quick craft (Settings) or several at once: no minigames, an ordinary result each time
    if ((times > 1 || quickCraft()) && !r.makes.gear) {
      let made = 0, last = null;
      for (let i = 0; i < times; i++) { const res = craft(g, r.id, hero, { score: 0.5 }); if (!res.ok) { if (!made) this.hint(res.why, 1800); break; } made++; last = res; }
      if (made) { play('anvil'); if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/spark', 6, 12); this.hint(`Crafted ${made > 1 ? made + ' x ' : ''}${last.recipe.name}${last.extra ? ' (lucky!)' : ''}`, 1600); this._hotbarKey = null; }
      refresh();
      return;
    }
    // check before the minigames, so you never play them for nothing
    if (!canCraft(g, r, hero)) { const res = craft(g, '__check__', hero); this.hint(needsTable(r) && !atTable(g, hero) ? 'You need to be at a Crafting Table' : res.why || 'Not enough resources', 1800); return; }
    this._crafting = true;
    const tier = Math.max(r.rarity || 0, Math.floor((r.power || 0) / 3));
    forgeMinigame({ root: this.root, title: r.name, iconKey: hasArt(r.icon) ? r.icon : r.fallbackIcon || r.icon, stages: forgeStages(r), tier }).then(score => {
      this._crafting = false;
      if (score == null) { refresh(); return; }
      const res = craft(g, r.id, hero, { score });
      if (!res.ok) { this.hint(res.why, 1800); refresh(); return; }
      if (hero) g.puff({ x: hero.x, y: hero.y - 14 }, 'effects/spark', 10, 16);
      this._hotbarKey = null;
      this.craftReveal(res);
      refresh();
    });
  }

  /** (the old timed bar, kept for reference) */
  startCraftTimed(r, card, refresh) {
    if (this._crafting) return;
    const g = this.game, hero = heroOf(this.dungeon || g) || heroOf(g);
    const secs = craftTime(r);
    const bar = h('div.craft-progress', h('i'));
    card?.append(bar);
    card?.classList.add('working');
    const start = performance.now();
    let lastClang = 0;
    this._crafting = true;
    const step = now => {
      const t = (now - start) / 1000;
      bar.firstChild.style.width = `${Math.min(100, (t / secs) * 100)}%`;
      if (t - lastClang > 0.34) {
        lastClang = t;
        play('anvil');
        if (hero) { g.puff({ x: hero.x + (Math.random() - 0.5) * 12, y: hero.y - 14 }, 'effects/spark', 4, 10); if (g.hero) g.hero.swing = 0.18; }
        card?.classList.remove('clang'); void card?.offsetWidth; card?.classList.add('clang');
      }
      if (t < secs) { requestAnimationFrame(step); return; }
      this._crafting = false;
      const res = craft(g, r.id, hero);
      bar.remove(); card?.classList.remove('working', 'clang');
      if (!res.ok) { this.hint(res.why, 1800); refresh(); return; }
      this._hotbarKey = null;
      this.craftReveal(res);
      refresh();
    };
    requestAnimationFrame(step);
  }

  /** What you just crafted, shown big: its quality, rarity and any lucky bonus. */
  /** A boss material, rare metal or Legendary+ gear was picked up: show it off (several at once merge into one card). */
  rareLootReveal(d) {
    const key = d.gear ? `gear:${d.gear.id}` : `res:${d.res}`;
    const now = performance.now();
    const open = this.root.querySelector('.rare-loot');
    if (open && open.dataset.key === key && now - (this._rareAt || 0) < 2500) {   // more of the same: add to the count
      this._rareCount = (this._rareCount || 0) + (d.count || 1);
      open.querySelector('.rare-count').textContent = `x${this._rareCount}`;
      this._rareAt = now;
      return;
    }
    open?.remove();
    this._rareAt = now; this._rareCount = d.count || 1;
    let name, iconKey, rarity, sub;
    if (d.gear) { name = d.gear.name; iconKey = gearIconKey(d.gear) || 'items/relic'; rarity = d.gear.rarity; sub = 'Rare loot'; }
    else { const mt = MATERIALS[d.res]; name = mt?.name || d.res; iconKey = mt ? matIcon(d.res) : RES_ICON[d.res]; rarity = Math.max(3, mt?.rarity || 3); sub = mt?.boss ? 'Boss material' : 'Rare material'; }
    const R = RARITY[Math.min(4, rarity)];
    const el = h('div.rare-loot', { dataset: { key }, style: { '--glow': R.color }, onclick: () => el.remove() },
      h('div.rare-rays'), h('div.rare-burst'),
      h('div.rare-sub', `${R.name.toUpperCase()} · ${sub.toUpperCase()}`),
      h('div.rare-icon', icon(iconKey, 84)),
      h('b.rare-name', name),
      d.gear ? null : h('span.rare-count', `x${this._rareCount}`));
    this.root.append(el);
    play('reveal');
    clearTimeout(this._rareTimer);
    this._rareTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  craftReveal(res) {
    const it = res.item, q = res.quality, rec = res.recipe;
    const color = it ? RARITY[it.rarity].color : '#9fe0ff';
    const ic = it ? gearIconKey(it) || rec.icon : hasArt(rec.icon) ? rec.icon : rec.fallbackIcon || rec.icon;
    this.root.querySelector('.craft-reveal')?.remove();
    const el = h(`div.craft-reveal${q?.id === 'masterwork' ? '.masterwork' : ''}`, { style: { '--glow': q && q.id !== 'standard' ? q.color : color }, onclick: () => el.remove() },
      h('div.craft-reveal-rays'),
      h('div.craft-reveal-icon', icon(ic, 72)),
      h('b', { style: { color } }, res.made),
      q ? h('span.craft-quality', { style: { color: q.color, borderColor: q.color } }, q.id === 'masterwork' ? 'MASTERWORK!' : q.name) : null,
      res.score != null ? h('span.faint', `Forging ${Math.round(res.score * 100)}%`) : null,
      it?.dmg ? h('span.faint', `${it.dmg} damage`) : it?.armor ? h('span.faint', `${Math.round(it.armor * 100)}% armour`) : null,
      it?.traits?.length ? h('div.forge-stats', ...it.traits.map(t => h('span.trait-chip', { style: { color: FORGE_TRAITS[t].color, borderColor: FORGE_TRAITS[t].color } }, FORGE_TRAITS[t].name))) : null,
      it && weaponAbility(it) ? h('span', { style: { color: weaponAbility(it).color, fontWeight: 700 } }, `Ability (F): ${weaponAbility(it).name}`) : null,
      res.bump ? h('span.craft-lucky', it ? 'Forged to a higher rarity!' : 'Forged a tier higher!') : null,
      res.extra ? h('span.craft-lucky', `Lucky craft! You made ${res.extra + 1}`) : null);
    this.root.append(el);
    play(q?.id === 'masterwork' || res.extra ? 'reveal' : 'ability');
    setTimeout(() => el.remove(), q?.id === 'masterwork' ? 3600 : 2400);
  }

  buildPanel() {
    const g = this.game;
    this.buildTab ??= 0;
    this.buildQuery ??= '';
    const tabs = h('div.tabs', ERAS.map((era, i) =>
      h(`button${this.buildTab === i ? '.on' : ''}${i > g.state.era ? '.locked' : ''}`, { onclick: () => { this.buildTab = i; this.refreshPanel(); } },
        i > g.state.era ? `🔒 ${era.name}` : era.name)));

    const search = h('input.input.build-search', { type: 'search', placeholder: '🔍 Search all buildings… (e.g. food, defense, gold)', value: this.buildQuery });
    const body = h('div.side-body');
    const fill = () => {
      const q = this.buildQuery.trim().toLowerCase();
      body.replaceChildren();
      if (q) {
        // search every era by name, description and what it does
        const hits = Object.entries(BUILDINGS).filter(([type, d]) => buildingOn(type) && `${d.name} ${d.desc} ${d.cat} ${describeBuilding(type).map(e => e.text).join(' ')}`.toLowerCase().includes(q));
        body.append(h('div.faint', `${hits.length} building${hits.length === 1 ? '' : 's'} match “${this.buildQuery.trim()}”`));
        body.append(h('div.bgrid', hits.map(([type, def]) => this.buildCard(type, def))));
        return;
      }
      if (on('housesOnly')) {   // homes only: every kind, cheapest first
        const homes = Object.entries(BUILDINGS).filter(([type]) => buildingOn(type)).sort(([, a], [, b]) => Object.values(a.cost).reduce((x, y) => x + y, 0) - Object.values(b.cost).reduce((x, y) => x + y, 0));
        body.append(h('div.faint', 'Place it, then swing at the site to build it.'));
        body.append(h('div.bgrid', homes.map(([type, def]) => this.buildCard(type, def))));
        return;
      }
      if (this.buildTab > g.state.era) body.append(this.unlockChecklist(this.buildTab));
      const inEra = Object.entries(BUILDINGS).filter(([type, d]) => d.era === this.buildTab && buildingOn(type));
      for (const [cat, catName] of CATEGORIES) {
        const list = inEra.filter(([, d]) => d.cat === cat);
        if (!list.length) continue;
        body.append(h('h3', { style: { marginTop: '6px' } }, catName));
        body.append(h('div.bgrid', list.map(([type, def]) => this.buildCard(type, def))));
      }
    };
    search.addEventListener('input', () => { this.buildQuery = search.value; fill(); });
    fill();
    // keep typing focus when the panel is rebuilt
    if (this.buildSearchFocused) setTimeout(() => { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }, 0);
    search.addEventListener('focus', () => { this.buildSearchFocused = true; });
    search.addEventListener('blur', () => { this.buildSearchFocused = false; });
    const tools = h('div.build-tools',
      h(`button.btn.sm${this.demolishMode ? '.danger' : ''}`, { title: 'Click or drag a box over buildings to remove them (X)', onclick: () => { this.toggleDemolish(); this.refreshPanel(); } }, this.demolishMode ? '🗑 Demolishing… (X)' : '🗑 Demolish (X)'),
      this.undoStack?.length ? h('button.btn.sm', { title: 'Undo the last build or demolish (Ctrl+Z)', onclick: () => { this.undo(); this.refreshPanel(); } }, pxIcon('undo'), 'Undo') : null,
      this.lastBuild && BUILDINGS[this.lastBuild] ? h('button.btn.sm', { title: 'Build it again (R)', onclick: () => this.startBuild(this.lastBuild) }, icon(buildingSprite(this.lastBuild), 18), `Again (R)`) : null);
    if (on('housesOnly')) search.placeholder = 'Search homes…';
    return [this.head(on('housesOnly') ? 'ui/home' : 'items/hammer', 'Build', on('housesOnly') ? 'Homes and a Crafting Table' : `${ERAS[g.state.era].name} era`), on('housesOnly') ? null : tabs, h('div.build-search-row', search, tools), body];
  }

  /** What is still missing to reach an era: a checklist with progress. */
  unlockChecklist(eraIndex) {
    const g = this.game;
    const era = ERAS[eraIndex];
    const s = g.state;
    const rows = [];
    // earlier eras must come first
    for (let e = g.state.era + 1; e <= eraIndex; e++) {
      const E = ERAS[e];
      const items = [
        { done: s.villagers.length >= E.pop, icon: '👥', text: `Population ${Math.min(s.villagers.length, E.pop)} / ${E.pop}`, frac: s.villagers.length / E.pop },
        ...E.requires.map(t => ({ done: g.hasBuilding(t), icon: null, type: t, text: BUILDINGS[t].name + (s.buildings.some(b => b.type === t && !b.built) ? ' (building…)' : '') })),
        E.science ? { done: s.resources.science >= E.science, icon: '🔬', text: `Science ${Math.floor(Math.min(s.resources.science, E.science))} / ${E.science}`, frac: s.resources.science / E.science } : null,
      ].filter(Boolean);
      const left = items.filter(i => !i.done).length;
      rows.push(h(`div.unlock${e === g.state.era + 1 ? '.next' : ''}`,
        h('div.unlock-head', h('b', `🔓 ${E.name} era`), h('span.faint', left ? `${left} thing${left === 1 ? '' : 's'} left` : 'Ready — it unlocks at dawn')),
        h('div.unlock-items', items.map(i => h(`div.unlock-item${i.done ? '.done' : ''}`,
          h('span.unlock-check', i.done ? '✓' : '○'),
          i.type ? icon(buildingSprite(i.type), 22) : h('span', i.icon),
          h('span', i.text),
          i.frac != null && !i.done ? bar(Math.min(1, i.frac), '#ffcf5a') : null)))));
    }
    return h('div.col', { style: { gap: '8px' } }, rows);
  }

  buildCard(type, def) {
    const g = this.game;
    const locked = def.era > g.state.era && !eraFree(type);
    const afford = g.canAfford(def.cost);
    const count = g.state.buildings.filter(b => b.type === type).length;
    return h(`div.bcard${locked ? '.locked' : ''}${afford ? '' : '.cant'}${this.buildType === type ? '.sel' : ''}`, {
      'data-type': type,
      title: `${def.name} — ${def.desc}`,
      onclick: () => {
        if (locked) { this.hint(`Unlocks in the ${ERAS[def.era].name} era`, 1500); return; }
        if (!g.canAfford(def.cost)) { this.hint('Not enough resources', 1500); return; }
        this.startBuild(type);
      },
    },
    h('div.thumb', icon(buildingSprite(type), 56), count ? h('span.bcount', `×${count}`) : null),
    h('div.bcard-main',
      h('div.name', def.name),
      h('div.badges', effectBadges(type).map(b => h(`span.badge-fx${b.good ? '' : '.warn'}`, { title: b.tip }, h('i', b.icon), b.label === '' ? null : b.label))),
      h('div.costs', costChips(def.cost, g.state.resources))),
    locked ? h('span.lock', `🔒 ${ERAS[def.era].name}`) : null);
  }

  /** Resources changed but nothing else: just update which cards are affordable (no rebuild, clicks stay reliable). */
  updateBuildAffordability() {
    const g = this.game;
    for (const card of this.panelEl?.querySelectorAll('.bcard[data-type]') || []) {
      const def = BUILDINGS[card.dataset.type];
      const afford = g.canAfford(def.cost);
      card.classList.toggle('cant', !afford);
      const costs = card.querySelector('.costs');
      if (costs) costs.replaceChildren(...[].concat(costChips(def.cost, g.state.resources)).filter(Boolean));
    }
  }

  /** Employment Office controls at the top of the jobs list (or a hint to build one). */
  employmentCard() {
    const g = this.game;
    if (!hasOffice(g)) {
      return h('div.law-cat.office-card',
        h('div.row', icon('buildings/employment_office', 34), h('div', h('b', 'Employment Office'), h('div.faint', 'Build one (Village era) to set job targets: its clerks keep hundreds of people in the right jobs for you.'))));
    }
    const e = employmentOf(g);
    const total = Object.values(e.targets).reduce((a, b) => a + b, 0);
    const preset = (id, label) => h('button.btn.sm', { onclick: () => { const n = applyPreset(g, id); this.hint(`${label}: ${n} people changed jobs`, 1800); this.refreshPanel(); } }, label);
    return h('div.law-cat.office-card.active',
      h('div.row', icon('buildings/employment_office', 34),
        h('div', { style: { flex: 1 } }, h('b', '📋 Employment Office'), h('div.faint', total ? `Targets for ${total} workers · everyone else gathers food` : 'No targets yet — type numbers in the boxes or pick a plan')),
        h('label.toggle', h('input', { type: 'checkbox', checked: e.on, onchange: ev => { e.on = ev.target.checked; if (e.on) applyNow(g); this.refreshPanel(); } }), h('span', e.on ? 'On' : 'Off'))),
      h('div.row', { style: { flexWrap: 'wrap', gap: '5px' } },
        preset('balanced', '⚖ Balanced'), preset('food', '🍖 Food'), preset('industry', '⛏ Industry'), preset('builders', '🔨 Builders'), preset('clear', '✕ Clear')),
      h('div.row',
        h('button.btn.sm.primary', { onclick: () => { const n = applyNow(g); this.hint(`${n} people changed jobs`, 1500); this.refreshPanel(); } }, 'Apply now'),
        h('span.faint', 'People you ordered by hand keep their jobs')));
  }

  jobsPanel() {
    const g = this.game;
    this.jobsTab ??= 'jobs';
    const adults = g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away);
    const atWar = g.state.villagers.filter(v => v.away).length;
    const tabs = h('div.tabs',
      h(`button${this.jobsTab === 'jobs' ? '.on' : ''}`, { onclick: () => { this.jobsTab = 'jobs'; this.refreshPanel(); } }, 'Jobs'),
      h(`button${this.jobsTab === 'people' ? '.on' : ''}`, { onclick: () => { this.jobsTab = 'people'; this.refreshPanel(); } }, `People (${g.state.villagers.length})`));
    const body = h('div.side-body');

    if (this.jobsTab === 'jobs') {
      const idle = adults.filter(v => v.job === 'idle');
      body.append(h('div.row', h('span.chip', icon('items/population', 16), `${adults.length} adults`),
        h('span.chip', `${g.state.villagers.length - adults.length} children`),
        h(`span.chip${idle.length ? '.good' : ''}`, `${idle.length} idle`),
        atWar ? h('span.chip.bad', icon('items/war', 16), `${atWar} away at war`) : null,
        h('span.chip', icon('items/sword', 16), `${Math.floor(g.state.resources.weapons)} weapons`)));
      const steward = officialOf(g, 'steward');
      const manual = adults.filter(v => v.manual).length;
      // what the Steward cannot fix alone: people whose trade has no workplace
      const short = Object.entries(g.state.court?.steward?.shortages || {}).filter(([, n]) => n > 0);
      const shortText = short.map(([trade, n]) => {
        const w = TRADE_WORKPLACE[trade];
        // suggest the workplace you can build that fits the most workers
        const type = w.build.filter(t => BUILDINGS[t] && BUILDINGS[t].era <= g.state.era).sort((a, b) => (BUILDINGS[b].slots || 1) - (BUILDINGS[a].slots || 1))[0] || w.build[0];
        const per = BUILDINGS[type]?.slots || 1;
        const need = Math.ceil(n / per);
        const who = n === 1 ? PROFESSIONS[trade] : trade === 'spy' ? 'Spies' : `${PROFESSIONS[trade]}s`;
        return `${n} ${who} need ${need} more ${BUILDINGS[type]?.name || type}${need === 1 ? '' : 's'}`;
      });
      body.append(steward
        ? h('div.law.active', h('div',
            h('b', `Steward ${steward.name} puts everyone to work in their trade`),
            h('div.faint', `${manual} villager${manual === 1 ? '' : 's'} follow your personal orders instead. Jacks of all trades fill the gaps.`),
            shortText.length ? h('div.steward-short', `Gathering food until there is room: ${shortText.join(' · ')}.`) : null),
          manual ? h('button.btn.sm', { onclick: () => { for (const v of adults) v.manual = false; g._courtTimers = {}; g.emit('change'); } }, 'Hand all to Steward') : null)
        : h('div.faint', 'Tip: appoint a Steward in the Court (C) and everyone will work in their trade.'));
      body.append(this.employmentCard());
      const office = hasOffice(g);
      const targets = employmentOf(g).targets;
      const step = e => (e.ctrlKey || e.metaKey ? 100 : e.shiftKey ? 10 : 1);
      body.append(h('div.faint.job-help', 'Click − / + for 1 · Shift-click for 10 · Ctrl-click for 100 · ⭐ picks the best person for the job'));
      for (const [job, def] of Object.entries(JOBS)) {
        if (job === 'idle') continue;
        const workers = adults.filter(v => v.job === job);
        const target = h('input.input.job-target', {
          type: 'number', min: 0, placeholder: 'auto', value: targets[job] ?? '', title: 'Target: the office keeps this many people in this job',
          onchange: e => { setTarget(g, job, e.target.value); applyNow(g); this.refreshPanel(); },
        });
        // upgrading the position: everyone in it works 10% faster per level
        const level = jobLevel(g, job);
        const canUp = !!UPGRADES[job] && level < MAX_LEVEL;
        const upCost = UPGRADES[job] ? upgradeCost(g, job) : null;
        const upBtn = UPGRADES[job] ? h(`button.btn.sm.upgrade-btn${canUp && g.canAfford(upCost) ? '.ready' : ''}`, {
          disabled: !canUp,
          title: canUp ? `Upgrade ${UPGRADES[job].label} to level ${level + 1}: ${Math.round((level + 1) * PER_LEVEL * 100)}% faster work. Costs ${Object.entries(upCost).map(([k, n]) => `${n} ${k}`).join(', ')}` : 'Top level reached',
          onclick: () => { const r = upgradeJob(g, job); if (r.error) this.hint(r.error, 1800); else { play('ability'); this.refreshPanel(); } },
        }, canUp ? `Upgrade · Lv ${level + 1}` : 'MAX') : null;
        body.append(h('div.job-row',
          icon(def.icon, 36),
          h('div', h('div', { style: { fontWeight: 700 } }, def.label, level ? h('span.job-level', ` Lv ${level} · +${Math.round(level * PER_LEVEL * 100)}%`) : null), h('div.faint', def.desc),
            UPGRADES[job] && canUp ? h('div.job-upgrade-cost', costChips(upCost, g.state.resources)) : null),
          h('div.job-controls',
            h('div.stepper',
              h('button', { title: 'Remove (Shift ×10, Ctrl ×100)', onclick: e => { const n = moveWorkers(g, job, -step(e)); if (!n) this.hint(`Nobody works as ${def.label}`, 1200); } }, '−'),
              h('span.count', workers.length),
              h('button', { title: 'Add (Shift ×10, Ctrl ×100)', onclick: e => { const n = moveWorkers(g, job, step(e)); if (!n) this.hint(g.lastJobError || 'Nobody available', 1500); } }, '+')),
            h('button.btn.sm.auto-pick', {
              title: `Auto pick: move the most skilled person into ${def.label}`,
              onclick: () => { const v = autoPick(g, job); this.hint(v ? `⭐ ${v.name} (${JOB_SKILL[job] || 'skill'} ${Math.floor(v.skills[JOB_SKILL[job]] || 0)}) is now a ${def.label}` : 'Nobody available', 1800); },
            }, '⭐'),
            upBtn,
            office && STAFFABLE.includes(job) ? target : null)));
      }
    } else {
      for (const v of [...g.state.villagers].sort((a, b) => b.age - a.age)) {
        const sel = v.away ? h('span.chip.bad', '⚔ At war') : v.office ? h('span.chip.good', `👑 ${OFFICES[v.office].name}`) : v.age >= ADULT_AGE
          ? h('select.input', { style: { width: '120px' }, onchange: e => assignJob(g, v, e.target.value) },
            Object.entries(JOBS).filter(([id]) => id === v.job || canDoJob(v, id)).map(([id, d]) => h('option', { value: id, selected: v.job === id }, d.label)))
          : h('span.faint', 'Child');
        body.append(h('div.player', { style: { cursor: 'pointer' }, onclick: e => { if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'OPTION') { this.select({ kind: 'villager', ref: v }); this.follow = v; } } },
          h('img.avatar', { src: iconUrl(villagerSprite({ ...v, role: displayRole(v) })), style: { borderRadius: '8px' } }),
          h('div', h('div.pname', `${v.name} ${v.sex === 'f' ? '♀' : '♂'}`), h('div.meta', `Age ${Math.floor(v.age)}`, v.sick ? '🤒' : '', v.traits.map(t => TRAITS[t]?.label).join(', '))),
          sel));
      }
    }
    return [this.head('items/population', 'People', `${g.state.villagers.length} souls · housing ${g.housing}`), tabs, body];
  }

  courtPanel() {
    const g = this.game;
    const body = h('div.side-body');
    const ruler = rulerOf(g);
    if (ruler) {
      const typeKey = g.state.ruler.type || rulerTypeOf(ruler);
      const type = RULER_TYPES[typeKey];
      const heir = g.state.villagers.find(x => x.id === g.state.ruler.heirId);
      const effects = Object.entries(type.effects).map(([k, n]) => {
        const label = { combat: 'combat', defense: 'defense', raid: 'army strength', build: 'build speed', storage: 'storage', learn: 'learning', fate: 'luck',
          happy: 'happiness', join: 'newcomers', influence: 'influence/day', gold: 'gold', work: 'work speed', karma: 'karma/day', lawful: 'no theft' }[k] || k;
        const pct = ['combat', 'raid', 'build', 'learn', 'fate', 'join', 'gold', 'work'].includes(k);
        const val = k === 'lawful' ? '' : `${n > 0 ? '+' : ''}${pct ? Math.round(n * 100) + '%' : n} `;
        return h(`span.chip.${n > 0 || k === 'lawful' ? 'good' : 'bad'}`, `${val}${label}`);
      });
      body.append(h('div.law-cat', { style: { borderColor: 'var(--gold)' } },
        h('div.row', icon(villagerSprite({ ...ruler, role: displayRole(ruler) }), 44),
          h('div', h('h3', { style: { color: 'var(--gold)' } }, `${rulerTitle(g, ruler)} ${ruler.name}`),
            h('div.faint', `House ${g.state.ruler.dynasty} · Age ${Math.floor(ruler.age)}${ruler.age < ADULT_AGE ? ' · ruling through a regent' : ''}`))),
        h('div.row', icon(type.icon, 22), h('b', type.label), h('span.faint', type.desc)),
        h('div.row', { style: { flexWrap: 'wrap', gap: '4px' } }, effects),
        h('div.faint', 'The ruler’s traits and talents decide their type. Shape your heir with Praise, Mentor and Discipline.'),
        h('div.field', h('label', 'Heir'),
          h('select.input', { onchange: e => setHeir(g, g.state.villagers.find(x => x.id === e.target.value) || null) },
            h('option', { value: '' }, '— Eldest child of the ruler —'),
            g.state.villagers.filter(x => !x.ruling).sort((a, b) => b.age - a.age)
              .map(x => h('option', { value: x.id, selected: heir === x }, `${x.name} (${Math.floor(x.age)}) → would rule as ${RULER_TYPES[rulerTypeOf(x)].label}`))))));
    }
    body.append(h('div.faint', 'Appoint trusted villagers to run the realm. Officials stop ordinary work, but they manage everyone else for you. Your own orders always come first.'));
    const adults = g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away).sort((a, b) => a.name.localeCompare(b.name));
    for (const [key, office] of Object.entries(OFFICES)) {
      const unlocked = officeUnlocked(g, key);
      const holder = officialOf(g, key);
      const card = h(`div.law-cat${holder ? '' : ''}`,
        h('div.row', icon(office.icon, 34), h('div', h('h3', office.name), h('div.faint', office.desc))));
      if (!unlocked) {
        card.append(h('span.chip', `🔒 Needs a ${office.requires.map(t => BUILDINGS[t]?.name).join(' or ')}`));
      } else if (holder) {
        card.append(h('div.law.active',
          h('div.row', icon(villagerSprite({ ...holder, role: displayRole(holder) }), 30),
            h('div', h('b', holder.name), h('div.faint', `Age ${Math.floor(holder.age)} · ${holder.traits.map(t => TRAITS[t]?.label).join(', ') || 'no traits'}`))),
          h('button.btn.sm', { onclick: () => dismiss(g, key) }, 'Dismiss')));
        // upgrading the office itself
        const up = OFFICE_UPGRADES[key];
        if (up) {
          const lvl = officeLevel(g, key);
          const cost = officeUpgradeCost(g, key);
          card.append(h('div.office-upgrade',
            h('div', h('b', `Level ${lvl}`), h('div.faint', up.effect(lvl))),
            lvl < up.max ? h('div.office-upgrade-next', costChips(cost, g.state.resources),
              h(`button.btn.sm.upgrade-btn${g.canAfford(cost) ? '.ready' : ''}`, {
                title: `Level ${lvl + 1}: ${up.effect(lvl + 1)}`,
                onclick: () => { const r = upgradeOffice(g, key); if (r.error) this.hint(r.error, 1800); else { play('ability'); this.courtKey = null; this.refreshPanel(); } },
              }, `Upgrade · Lv ${lvl + 1}`)) : h('span.chip.good', 'Top level')));
        }
        for (const [opt, choices] of Object.entries(office.options || {})) {
          const cur = g.state.court[key]?.[opt];
          card.append(h('select.input', { onchange: e => setOfficeOption(g, key, opt, e.target.value) },
            choices.map(([val, label]) => h('option', { value: val, selected: cur === val }, label))));
        }
      } else {
        const pick = h('select.input', {
          onchange: e => {
            const v = g.state.villagers.find(x => x.id === e.target.value);
            const r = appoint(g, key, v);
            if (r.error) this.hint(r.error, 2000);
            this.courtKey = null;
          },
        }, h('option', { value: '' }, '— Appoint a villager —'),
        adults.filter(v => !v.office).map(v => h('option', { value: v.id }, `${v.name} (${Math.floor(v.age)}${v.traits.length ? ', ' + v.traits.map(t => TRAITS[t]?.label).join(', ') : ''})`)));
        card.append(h('div.row', pick, h('button.btn.sm.primary', {
          title: 'Auto pick: appoint the best person for this office',
          onclick: () => {
            const v = bestForOffice(g, key);
            if (!v) { this.hint('Nobody can serve right now', 1500); return; }
            const r = appoint(g, key, v);
            this.hint(r.error || `⭐ ${v.name} appointed ${OFFICES[key].name}`, 1800);
          },
        }, '⭐ Auto pick')));
      }
      body.append(card);
    }
    return [this.head('characters/king', 'Court', `${Object.keys(OFFICES).filter(k => officialOf(g, k)).length} of ${Object.keys(OFFICES).length} offices filled`), body];
  }

  empirePanel() {
    const g = this.game;
    const e = empireOf(g);
    const power = empirePower(g);
    const body = h('div.side-body');
    const ruled = e.kingdoms.filter(k => k.status === 'vassal' || k.status === 'province').length;
    body.append(h('div.empire-hero',
      h('div.empire-title', empireTitle(g)),
      h('div.faint', `${g.state.owner.villageName} · ${ruled} realm${ruled === 1 ? '' : 's'} under your rule`),
      h('div.row', { style: { justifyContent: 'center', flexWrap: 'wrap' } },
        h('span.chip', `⚔ Army strength ${power}`),
        e.siege ? h('span.chip.good', `🏗 ${e.siege} siege engine${e.siege > 1 ? 's' : ''}`) : null,
        e.colonies ? h('span.chip.good', `🚀 ${e.colonies} space colon${e.colonies > 1 ? 'ies' : 'y'}`) : null)));

    if (!e.kingdoms.length) {
      body.append(h('div.muted', g.state.era < 1 && g.state.villagers.length < 8
        ? 'Your tribe is too small for other kingdoms to notice. Grow to 8 people or reach the Village era.'
        : 'Your scouts are searching for neighbouring kingdoms. New realms are discovered as you grow.'));
    }
    for (const k of e.kingdoms) {
      const st = STATUS[k.status];
      const pers = PERSONALITIES[k.personality];
      const odds = power / Math.max(1, power + k.strength);
      const actions = Object.entries(EMPIRE_ACTIONS).filter(([, a]) => a.when(k));
      body.append(h(`div.kingdom.${k.status}`,
        h('div.row', { style: { gap: '10px' } },
          h('div.kingdom-crest', pers.icon),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div.kingdom-name', k.name),
            h('div.faint', `${k.ruler} · ${pers.label}`)),
          h('span.chip', { style: { color: st.color, borderColor: st.color } }, st.label)),
        h('div.kingdom-stats',
          h('div', h('span.faint', 'Strength'), h('b', { style: { color: k.strength > power ? 'var(--bad)' : 'var(--good)' } }, k.strength)),
          h('div', h('span.faint', 'Wealth'), h('b', k.wealth)),
          h('div', h('span.faint', 'Relations'), h('b', { style: { color: k.attitude >= 0 ? 'var(--good)' : 'var(--bad)' } }, Math.round(k.attitude)))),
        k.status === 'war' ? h('div.col', { style: { gap: '4px' } },
          h('div.row', h('span.faint', 'War'), h('div.spacer'), h('span.faint', `${Math.round(odds * 100)}% odds each day`)),
          h('div.warbar', h('i', { style: { left: `${(k.warScore + 100) / 2}%` } }))) : null,
        (k.status === 'vassal' || k.status === 'province') ? h('div.row', h('span.faint', 'Unrest'), bar((k.unrest || 0) / 100, (k.unrest || 0) > 60 ? '#ff5a4a' : '#ffcf5a')) : null,
        h('div.kingdom-actions', actions.map(([id, a]) => h(`button.btn.sm${id === 'war' ? '.danger' : ''}`, {
          title: `${a.desc}${Object.keys(a.cost).length ? ` · costs ${Object.entries(a.cost).map(([r, n]) => `${n} ${r}`).join(', ')}` : ''}`,
          disabled: !g.canAfford(a.cost),
          onclick: () => { const r = empireAction(g, k.id, id); if (r.error) this.hint(r.error, 1600); else this.toast({ text: r.text, kind: 'event' }); this.refreshPanel(); },
        }, `${a.icon} ${a.label}`)))));
    }
    if (e.history.length) {
      body.append(h('h3', 'Chronicle of the Empire'));
      for (const x of e.history.slice(0, 12)) body.append(h(`div.log-entry.${x.kind}`, h('span.faint', `Day ${x.day} · `), x.text));
    }
    return [this.head('items/crown_leader', 'Empire', 'Neighbouring kingdoms: trade, ally, spy or conquer'), body];
  }

  deedsPanel() {
    const g = this.game;
    this.deedsTab ??= 'laws';
    const tabs = h('div.tabs', [['laws', 'Laws'], ['powers', 'Powers']].map(([id, label]) =>
      h(`button${this.deedsTab === id ? '.on' : ''}`, { onclick: () => { this.deedsTab = id; this.refreshPanel(); } }, label)));
    if (this.deedsTab === 'laws') return [this.head('items/scroll', 'Rule the Realm', 'Your laws decide what your civilization becomes'), tabs, this.autoPickToggle(), this.lawsBody()];
    const body = h('div.side-body');
    body.append(h('div.faint', 'Your powers as guide. Good deeds raise karma (luck, happiness, wanderers). Evil deeds pay now — and invite curses, ghosts and rebellion.'));
    for (const d of DEEDS.filter(x => x.id !== 'smite')) {   // Divine Smite is switched off
      const evil = (d.karma || 0) < 0;
      const lockedBy = d.requires && !g.hasBuilding(d.requires) ? `Needs ${BUILDINGS[d.requires].name}` : null;
      const btn = h(`button.btn.sm${evil ? '.evil' : '.primary'}`, {
        disabled: !!lockedBy || !g.canAfford(d.cost),
        onclick: () => { const r = runDeed(g, d.id); if (r.error) this.hint(r.error, 1800); else this.float(r.text); },
      }, lockedBy || 'Invoke');
      body.append(h(`div.deed${evil ? '.evil' : (d.karma || 0) > 0 ? '.holy' : ''}`,
        icon(d.icon, 44),
        h('div', h('div', { style: { fontWeight: 700 } }, d.name), h('div.faint', d.desc),
          h('div.row', { style: { marginTop: '4px', flexWrap: 'wrap', gap: '4px' } }, costChips(d.cost, g.state.resources),
            d.karma ? h(`span.chip.${d.karma > 0 ? 'good' : 'evil'}`, `${d.karma > 0 ? '+' : ''}${d.karma} karma`) : null)),
        btn));
    }
    const mods = g.state.modifiers;
    if (mods.length) body.append(h('h3', 'Active blessings & curses'), ...mods.map(m => h('div.chip', `${m.id} · ${Math.ceil((m.until - g.state.time) / 90 * 24)}h left`)));
    return [this.head('items/scroll', 'Rule the Realm', `Fate luck ${g.fateBonus >= 0 ? '+' : ''}${Math.round(g.fateBonus * 100)}%`), tabs, body];
  }

  lawsBody() {
    const g = this.game;
    const body = h('div.side-body');
    const laws = { ...DEFAULT_LAWS, ...(g.state.laws || {}) };
    body.append(h('div.faint', `Changing a law costs ${LAW_COST.influence} influence. Each category can change once per day.`));
    for (const cat of LAW_CATEGORIES) {
      const card = h('div.law-cat', h('div.row', icon(cat.icon, 26), h('h3', cat.name)));
      for (const opt of cat.options) {
        const active = laws[cat.id] === opt.id;
        const can = active ? true : g.canEnact(cat.id, opt.id);
        const chips = describeEffects(opt.effects).map(([t, good]) => h(`span.chip.${good ? 'good' : 'bad'}`, t));
        card.append(h(`div.law${active ? '.active' : ''}${!active && can !== true ? '.locked' : ''}`,
          h('div', h('div.row', h('b', opt.name), active ? h('span.tag', { style: { color: 'var(--gold)' } }, 'in force') : null),
            h('div.faint', opt.desc),
            chips.length ? h('div.row', { style: { flexWrap: 'wrap', gap: '4px', marginTop: '4px' } }, chips) : null),
          active ? null : h('button.btn.sm.primary', {
            disabled: can !== true, title: can === true ? '' : can,
            onclick: () => { const r = g.enactLaw(cat.id, opt.id); if (r.error) this.hint(r.error, 1800); },
          }, can === true ? 'Enact' : '🔒')));
      }
      body.append(card);
    }
    return body;
  }

  logPanel() {
    const g = this.game;
    const s = g.state;
    const body = h('div.side-body');
    body.append(h('div.row', { style: { flexWrap: 'wrap' } },
      h('span.chip', icon('items/baby', 16), `${s.stats.births || 0} births`),
      h('span.chip', icon('buildings/grave', 16), `${s.stats.deaths || 0} deaths`),
      h('span.chip', icon('nature/tree_oak', 16), `${s.stats.treesCut || 0} trees cut`),
      h('span.chip', icon('items/war', 16), `${s.stats.raidsWon || 0}W / ${s.stats.raidsLost || 0}L raids`),
      h('span.chip', icon('items/population', 16), `peak ${s.stats.maxPop || 0}`)));
    body.append(this.statsGraphs());
    body.append(h('h3', 'Story'));
    body.append(h('div.log', [...s.log].reverse().map(e =>
      h(`div.log-entry.${e.kind}${e.pos ? '.has-pos' : ''}`, { onclick: () => this.jumpTo(e.pos), title: e.pos ? 'Show me where' : '' }, h('span.d', `Day ${e.day}`), h('span', e.text)))));
    return [this.head('items/scroll', 'Chronicle', s.owner.villageName), body];
  }

  /** Small line graphs of the village over the last days. */
  statsGraphs() {
    const hist = this.game.state.history || [];
    if (hist.length < 2) return h('div.faint', 'Graphs of your village appear after a couple of days.');
    const graph = (key, label, color) => {
      const vals = hist.map(d => d[key] || 0);
      const max = Math.max(1, ...vals), min = Math.min(...vals, 0);
      const W = 120, H = 34;
      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * (H - 2) - 1}`).join(' ');
      const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
      const last = vals[vals.length - 1], first = vals[0];
      return h('div.graph', h('div.graph-head', h('span', label), h('b', fmt(last)), h(`span.${last >= first ? 'up' : 'down'}`, `${last >= first ? '+' : ''}${fmt(last - first)}`)), h('div.graph-line', { html: svg }));
    };
    return h('div.col', { style: { gap: '6px' } },
      h('h3', `Last ${hist.length} days`),
      h('div.graphs', graph('pop', 'People', '#7fc8ff'), graph('food', 'Food', '#7ee06a'), graph('gold', 'Gold', '#ffcf5a'), graph('happy', 'Happiness', '#ff9fd4'), graph('wood', 'Wood', '#c08a4a'), graph('army', 'Warriors', '#ff6b5b')));
  }

  // ---- multiplayer
  worldPanel() {
    const mp = this.mp;
    this.worldTab ??= 'players';
    const pending = mp ? mp.inbox.filter(o => o.status === 'pending' || o.status === 'seen').length : 0;
    this.friendsUnsub?.();
    this.friendsUnsub = null;
    if (!mp) this.worldTab = 'friends';   // solo: friends & profiles still work
    const tabList = mp ? [['players', 'Villages'], ['chat', 'Chat'], ['offers', `Offers${pending ? ` (${pending})` : ''}`], ['friends', 'Friends']] : [['friends', 'Friends']];
    const tabs = h('div.tabs', tabList.map(([id, label]) =>
      h(`button${this.worldTab === id ? '.on' : ''}`, { onclick: () => { this.worldTab = id; this.refreshPanel(); } }, label)));
    const body = h('div.side-body');
    const w = this.world || {};
    const isPrivate = w.wid && w.wid !== 'realm' && w.wid !== 'solo';
    body.append(h('div.law-cat',
      h('div.row', icon(w.wid === 'solo' ? 'buildings/campfire' : 'buildings/fortress', 28),
        h('div', h('b', w.name || 'World'), h('div.faint', w.wid === 'solo' ? 'Solo world — only you live here' : `World with friends${w.owner === this.user.uid ? ' · you host it' : ''}`))),
      isPrivate && w.code ? h('div.row', { style: { flexWrap: 'wrap' } }, h('span.faint', 'Invite code'), h('span.chip', { style: { fontFamily: 'var(--num)', letterSpacing: '3px', userSelect: 'text' } }, w.code), h('span.faint', 'or invite friends in the Friends tab')) : null,
      h('button.btn.sm', { onclick: () => this.onSwitchWorld?.() }, '🌍 Switch world')));
    if (this.worldTab === 'friends') {
      const holder = h('div.col');
      body.append(holder);
      this.friendsUnsub = friendsPanel(holder, { user: this.user, username: this.username, world: isPrivate ? w : null });
      return [this.head('items/alliance', 'World', 'Friends & invites'), tabs, body];
    }

    if (this.worldTab === 'players') {
      const online = mp.players.filter(p => p.online).length;
      const armies = mp.armies();
      const missions = mp.missions();
      const homeSpies = (this.game.state.caravans || []).filter(c => this.game.state.villagers.some(v => v.away?.missionId === c.id));
      if (missions.length || homeSpies.length) {
        body.append(h('h3', 'Your agents'));
        for (const m of missions) {
          const total = Math.max(1, m.arrivesAt - (m.launchedAt || m.arrivesAt));
          const left = Math.max(0, m.arrivesAt - Date.now());
          body.append(h('div.offer', h('div.row', icon(m.kind === 'missile' ? 'units/missile' : 'units/spy', 24),
            h('b', m.kind === 'missile' ? `☢ Strike → ${m.toVillage}` : `${m.agent} → ${m.toVillage} (${m.mission})`), h('div.spacer'),
            left || m.mission !== 'infiltrate' ? h('span.faint', left ? fmtClock(left / 1000) : 'Arriving…') : h('button.btn.sm.primary', { onclick: () => this.infiltrate(m) }, 'Take control')),
            bar(1 - left / total, m.kind === 'missile' ? '#ff6b5b' : '#9f7aea')));
        }
        for (const c of homeSpies) {
          body.append(h('div.offer', h('div.row', icon('units/spy', 24), h('b', c.text), h('div.spacer'), h('span.faint', `home in ${fmtClock(Math.max(0, (c.at - Date.now()) / 1000))}`))));
        }
      }
      if (armies.length) {
        body.append(h('h3', 'Your armies'));
        for (const a of armies) {
          const secs = Math.max(0, Math.round((a.arrivesAt - Date.now()) / 1000));
          const homeward = this.game.state.caravans?.find(c => c.id === a.id);
          const status = homeward ? `Marching home · ${fmtClock(Math.max(0, (homeward.at - Date.now()) / 1000))}` : a.vanished ? 'Returning home' : a.status === 'marching' ? (secs ? `Marching · arrives in ${fmtClock(secs)}` : 'Arriving…')
            : a.status === 'battle' ? 'Battle raging!' : a.status === 'bribed' ? 'Tribute received' : 'Returning with news…';
          body.append(h('div.offer.raid', h('div.row', icon('items/war', 24), h('b', `${a.warriors} warriors → ${a.toVillage}`), h('div.spacer'), h('span.faint', status))));
        }
      }
      body.append(h('div.faint', `${online} online · ${mp.players.length} villages in the world`));
      for (const p of mp.players) {
        const me = p.uid === this.user.uid;
        const ally = mp.allies.has(p.uid);
        body.append(h(`div.player${p.online ? '.online' : ''}`,
          h('span', { style: { cursor: 'pointer' }, title: 'View profile', onclick: () => this.showProfile(p) }, avatar(p.name, 40)),
          h('div',
            h('div.pname', p.villageName || 'Unnamed', me ? h('span.tag', { style: { marginLeft: '6px' } }, 'you') : null, ally ? h('span.tag', { style: { marginLeft: '6px', color: 'var(--info)' } }, 'ally') : null),
            h('div.meta', h('span', h('span.dot' + (p.online ? '.on' : '')), ' ', p.name), me ? null : h('span', `🗺 ${fmtMinutes(travelMs(this.user.uid, p.uid))}`), h('span', `👥 ${p.pop}`), h('span', `☯ ${p.karma}`), h('span', ERAS[p.era || 0]?.name),
              !p.online && p.lastSeen ? h('span', timeAgo(p.lastSeen)) : null)),
          me ? null : h('div.col', { style: { gap: '4px' } },
            h('button.btn.sm.primary', { onclick: () => this.tradeModal(p) }, 'Trade'),
            h('button.btn.sm', { onclick: () => this.offerModal(p) }, '🤝 Deal'),
            ally ? h('button.btn.sm.ghost', { onclick: () => mp.breakAlliance(p.uid) }, 'Break') : h('button.btn.sm.danger', { onclick: () => this.raidModal(p) }, '⚔ Raid'))));
      }
    } else if (this.worldTab === 'chat') {
      const list = h('div.chat');
      const muted = mutedPlayers();
      let hidden = 0;
      for (const m of mp.chat) {
        if (muted.has(m.uid)) { hidden++; continue; }
        const mine = m.uid === this.user.uid;
        list.append(h(`div.msg${mine ? '.me' : ''}`,
          h('span', { style: { cursor: 'pointer' }, onclick: () => this.showProfile({ uid: m.uid, name: m.name, villageName: m.village }) }, avatar(m.name, 28)),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div.who', m.name, ' ', h('span', `· ${m.village || ''}`)),
            h('div', cleanText(m.text))),
          mine ? null : h('div.msg-actions',
            h('button.btn.icon.ghost', { title: `Mute ${m.name}`, onclick: () => { setMuted(m.uid, true); this.hint(`${m.name} is muted`, 1500); this.refreshPanel(); } }, pxIcon('mute')),
            h('button.btn.icon.ghost', {
              title: 'Report this message',
              onclick: async () => {
                if (!(await confirmModal(`Report ${m.name}?`, `“${cleanText(m.text)}” will be sent to the admins to review.`, { okLabel: 'Report', okClass: 'danger' }))) return;
                try { await reportMessage(m); this.hint('Thanks — the admins will review it', 1800); } catch (e) { this.hint(e.message, 2000); }
              },
            }, pxIcon('flag')))));
      }
      if (hidden || muted.size) {
        list.append(h('div.faint', { style: { textAlign: 'center', fontSize: '12px' } }, `${hidden} message${hidden === 1 ? '' : 's'} from muted players hidden · `,
          h('button.link', { onclick: () => { for (const id of mutedPlayers()) setMuted(id, false); this.refreshPanel(); } }, 'Unmute everyone')));
      }
      const input = h('input.input', { placeholder: 'Say something to the world…', maxLength: 200 });
      const send = async () => {
        try { await mp.sendChat(input.value); input.value = ''; } catch (e) { this.hint(e.message, 1500); }
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      body.append(list, h('div.chat-input', input, h('button.btn.primary', { onclick: send }, 'Send')));
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; if (this.chatFocus) input.focus(); });
      input.addEventListener('focus', () => { this.chatFocus = true; });
      input.addEventListener('blur', () => { this.chatFocus = false; });
    } else {
      if (!mp.inbox.length) body.append(h('div.muted', 'No offers yet. Visit other villages to trade, gift or form alliances.'));
      for (const o of mp.inbox) {
        if (o.type === 'itemtrade') { body.append(this.tradeCard(o)); continue; }
        const title = { trade: 'Trade offer', gift: 'Gift', alliance: 'Alliance proposal' }[o.type];
        body.append(h('div.offer',
          h('div.row', icon(o.type === 'alliance' ? 'items/alliance' : o.type === 'gift' ? 'items/relic' : 'items/trade', 24), h('b', `${title} from ${o.fromVillage}`), h('div.spacer'), h('span.faint', timeAgo(o.ts))),
          Object.keys(o.give || {}).length ? h('div.row', h('span.faint', 'They give:'), costChips(o.give)) : null,
          Object.keys(o.want || {}).length ? h('div.row', h('span.faint', 'They want:'), costChips(o.want, this.game.state.resources)) : null,
          h('div.row', h('div.spacer'),
            h('button.btn.sm.ghost', { onclick: () => mp.respond(o, false).catch(e => this.hint(e.message, 2000)) }, 'Decline'),
            h('button.btn.sm.good', { onclick: () => mp.respond(o, true).catch(e => this.hint(e.message, 2000)) }, 'Accept'))));
      }
    }
    return [this.head('items/alliance', 'World', 'The shared realm'), tabs, body];
  }

  /** What a trade bundle holds, as chips: resources and materials, gear and tools. */
  bundleView(b = {}) {
    const res = b.res || {}, gear = b.gear || [], tools = b.tools || {};
    const parts = [];
    if (Object.keys(res).length) parts.push(costChips(res, null));
    for (const it of gear) parts.push(h('span.chip.trade-gear', { style: { borderColor: RARITY[it.rarity]?.color }, title: it.name }, icon(gearIconKey(it) || 'items/relic', 18), it.name, Object.keys(it.ench || {}).length ? h('span.ench-mark', ' ✦') : null));
    for (const [k, n] of Object.entries(tools)) if (TOOLS[k]) parts.push(h('span.chip', { title: TOOLS[k].name }, icon(hasArt(TOOLS[k].icon) ? TOOLS[k].icon : TOOLS[k].fallbackIcon, 18), `${TOOLS[k].name}${n > 1 ? ` x${n}` : ''}`));
    return parts.length ? h('div.trade-bundle', ...parts) : h('span.faint', 'nothing');
  }

  /** An incoming trade, with Accept and Decline. */
  tradeCard(o, onDone = null) {
    const mp = this.mp;
    const act = accept => mp.respond(o, accept).then(() => { this.hint(accept ? 'Trade done!' : 'Trade declined', 1500); play(accept ? 'reveal' : 'click'); onDone?.(); this.refreshPanel?.(); }).catch(e => this.hint(e.message, 2500));
    return h('div.offer.trade-offer',
      h('div.row', icon('items/trade', 24), h('b', `Trade from ${o.fromName || o.fromVillage || 'a player'}`), h('div.spacer'), h('span.faint', timeAgo(o.ts))),
      h('div.row', h('span.faint', 'You get:'), this.bundleView(o.give)),
      h('div.row', h('span.faint', 'They want:'), this.bundleView(o.want)),
      h('div.row', h('div.spacer'),
        h('button.btn.sm.ghost', { onclick: () => act(false) }, 'Decline'),
        h('button.btn.sm.good', { onclick: () => act(true) }, 'Accept')));
  }

  /** A trade just arrived: show it at once (once per trade). */
  showIncomingTrades() {
    const mp = this.mp;
    this._seenTrades ||= new Set();
    for (const o of mp?.inbox || []) {
      if (o.type !== 'itemtrade' || this._seenTrades.has(o.id)) continue;
      this._seenTrades.add(o.id);
      play('notify');
      const m = modal([h('h2', 'Trade offer'), this.tradeCard(o, () => m.close())], { closeX: true, cls: 'trade-popup' });
    }
  }

  /**
   * Trade window (like Roblox trading): pick what you give from your bag, tools and materials, say what you want,
   * and send it. What you give waits in escrow; if they decline it comes back.
   */
  tradeModal(p) {
    const mp = this.mp;
    if (!mp) { this.hint('Trading works in multiplayer worlds', 2000); return; }
    if (p.uid === this.user?.uid) { this.hint("That's you!", 1500); return; }
    const g = this.game, r = rpgOf(g);
    const give = { res: {}, gear: new Set(), tools: {} }, want = { res: {}, tools: {} };
    const keys = RESOURCES.filter(k => !['weapons', 'bombs', 'science', 'influence'].includes(k) && !MATERIALS[k]?.off);
    const resIcon = k => (MATERIALS[k] ? matIcon(k) : RES_ICON[k]);
    const err = h('div.error-text');
    const m = modal([], { closeX: true, cls: 'trade-modal' });
    const bump = (obj, k, n, max) => { obj[k] = Math.max(0, Math.min(max, (obj[k] || 0) + n)); if (!obj[k]) delete obj[k]; play('click'); render(); };
    const render = () => {
      const res = g.state.resources, owned = toolsOf(g);
      const toolKeys = Object.keys(owned).filter(k => TOOLS[k]);
      const giveCells = [
        ...(r.bag || []).map(it => h(`button.trade-cell${give.gear.has(it.id) ? '.on' : ''}`, { title: `${it.name} (tap to add or take out)`, style: { borderColor: RARITY[it.rarity]?.color }, onclick: () => { give.gear.has(it.id) ? give.gear.delete(it.id) : give.gear.add(it.id); play('click'); render(); } }, icon(gearIconKey(it) || 'items/relic', 28))),
        ...toolKeys.map(k => h(`button.trade-cell${give.tools[k] ? '.on' : ''}`, { title: `${TOOLS[k].name}: tap +1, right-click -1`, onclick: () => bump(give.tools, k, 1, owned[k]), oncontextmenu: e => { e.preventDefault(); bump(give.tools, k, -1, owned[k]); } }, icon(hasArt(TOOLS[k].icon) ? TOOLS[k].icon : TOOLS[k].fallbackIcon, 28), h('span.trade-n', String(owned[k] - (give.tools[k] || 0))))),
        ...keys.filter(k => (res[k] || 0) >= 1).map(k => h(`button.trade-cell${give.res[k] ? '.on' : ''}`, { title: `${k}: tap +1, right-click +10 (shift-click -1)`, onclick: e => bump(give.res, k, e.shiftKey ? -1 : 1, Math.floor(res[k])), oncontextmenu: e => { e.preventDefault(); bump(give.res, k, 10, Math.floor(res[k])); } }, icon(resIcon(k), 28), h('span.trade-n', fmt(Math.floor(res[k]) - (give.res[k] || 0))))),
      ];
      const wantCells = keys.map(k => h(`button.trade-cell${want.res[k] ? '.on' : ''}`, { title: `${k}: tap +1, right-click +10 (shift-click -1)`, onclick: e => bump(want.res, k, e.shiftKey ? -1 : 1, 99999), oncontextmenu: e => { e.preventDefault(); bump(want.res, k, 10, 99999); } }, icon(resIcon(k), 28), want.res[k] ? h('span.trade-n', String(want.res[k])) : null));
      const toolPick = h('select.input.trade-select', h('option', { value: '' }, 'Want a tool...'), ...Object.entries(TOOLS).sort((a, b) => (b[1].power || 0) - (a[1].power || 0)).map(([k, t]) => h('option', { value: k }, t.name)));
      toolPick.onchange = () => { if (toolPick.value) bump(want.tools, toolPick.value, 1, 99); };
      const giveBundle = { res: give.res, gear: (r.bag || []).filter(it => give.gear.has(it.id)), tools: give.tools };
      m.el.replaceChildren(m.closeBtn,
        h('h2', `Trade with ${p.villageName || p.name || 'player'}`),
        h('div.faint', 'What you give waits safely until they answer. If they decline, you get it all back.'),
        h('div.trade-cols',
          h('div.trade-side', h('h3', 'You give'), this.bundleView(giveBundle), h('div.trade-grid', ...giveCells)),
          h('div.trade-side', h('h3', 'You want'), this.bundleView(want), h('div.trade-grid', ...wantCells), toolPick)),
        err,
        h('div.row', h('button.btn.sm.ghost', { onclick: () => { give.res = {}; give.gear.clear(); give.tools = {}; want.res = {}; want.tools = {}; render(); } }, 'Clear'), h('div.spacer'),
          h('button.btn.primary', { onclick: async () => {
            try { await mp.sendTrade(p, giveBundle, want); m.close(); this.hint('Trade sent!', 1800); play('reveal'); }
            catch (e) { err.textContent = e.message; }
          } }, 'Send trade')));
    };
    render();
    return m;
  }

  offerModal(p) {
    const mp = this.mp;
    let type = 'trade';
    const pickers = { give: {}, want: {} };
    const resPicker = side => h('div.res-picker', ['food', 'wood', 'stone', 'coal', 'iron', 'gold', 'gems', 'influence'].map(k => {
      const input = h('input', { type: 'number', min: 0, value: 0 });
      pickers[side][k] = input;
      return h('label', icon(RES_ICON[k], 22), k, input);
    }));
    const wantBox = h('div.col', h('h3', 'You want'), resPicker('want'));
    const giveBox = h('div.col', h('h3', 'You give'), resPicker('give'));
    const err = h('div.error-text');
    const typeBtns = h('div.row', ['trade', 'gift', 'alliance'].map(t => h(`button.btn.sm${t === type ? '.primary' : ''}`, {
      onclick: e => {
        type = t;
        for (const b of typeBtns.children) b.className = 'btn sm';
        e.currentTarget.className = 'btn sm primary';
        wantBox.classList.toggle('hidden', t !== 'trade');
        giveBox.classList.toggle('hidden', t === 'alliance');
      },
    }, { trade: '🤝 Trade', gift: '🎁 Gift', alliance: '🛡 Alliance' }[t])));
    const read = side => Object.fromEntries(Object.entries(pickers[side]).map(([k, i]) => [k, Number(i.value) || 0]));
    const m = modal([
      h('h2', `Deal with ${p.villageName}`),
      h('div.faint', `Your caravan takes ${fmtMinutes(travelMs(this.user.uid, p.uid, 'caravan'))} to reach them. Goods are held in escrow until they accept — declined offers are refunded.`),
      typeBtns, giveBox, wantBox, err,
      h('div.row', h('div.spacer'), 
        h('button.btn.primary', {
          onclick: async () => {
            try {
              await mp.sendOffer(p, type, type === 'alliance' ? {} : read('give'), type === 'trade' ? read('want') : {});
              m.close();
              this.hint('Offer sent!', 1500);
            } catch (e) { err.textContent = e.message; }
          },
        }, 'Send offer')),
    ], { closeX: true });
  }

  raidModal(p) {
    const mp = this.mp;
    const check = mp.raidCheck(p);
    const warriors = mp.availableWarriors().length;
    const err = h('div.error-text', check === true ? '' : check);
    // how many to send, and by land or by sea
    const lift = seaLift(this.game);
    const canSail = this.game.hasBuilding('shipyard') && lift.ships.length > 0;
    const plan = { count: warriors, bySea: false };
    const landTime = travelMs(this.user.uid, p.uid);
    const countLabel = h('b.invade-count', String(warriors));
    const summary = h('div.muted');
    const routeBtns = h('div.invade-routes');
    const refreshPlan = () => {
      countLabel.textContent = `${plan.count} of ${warriors}`;
      const over = plan.bySea && plan.count > lift.capacity;
      routeBtns.replaceChildren(
        h(`button.invade-route${plan.bySea ? '' : '.on'}`, { onclick: () => { plan.bySea = false; refreshPlan(); } }, icon('items/war', 28), h('b', 'By land'), h('span', fmtMinutes(landTime))),
        h(`button.invade-route${plan.bySea ? '.on' : ''}`, { disabled: !canSail, title: canSail ? '' : 'Build a Shipyard and boats first', onclick: () => { plan.bySea = true; refreshPlan(); } },
          icon('boats/galleon', 28), h('b', 'By sea'), h('span', canSail ? `${fmtMinutes(landTime * 0.6)} · ${lift.ships.length} ship${lift.ships.length === 1 ? '' : 's'} carry ${lift.capacity}` : 'needs boats')));
      summary.textContent = plan.bySea
        ? `Your fleet carries ${plan.count} warrior${plan.count === 1 ? '' : 's'} across the sea and lands by surprise (+15% strength, the ships' guns join in). ${over ? `Too many: your boats carry ${lift.capacity}.` : ''}`
        : `${plan.count} warrior${plan.count === 1 ? '' : 's'} march for ${fmtMinutes(landTime)} and just as long home. Their scouts may see you coming. Victory plunders 20% of their food, wood, stone and gold.`;
    };
    const slider = h('input.invade-slider', { type: 'range', min: 1, max: Math.max(1, warriors), value: warriors, disabled: warriors < 1, oninput: e => { plan.count = Number(e.target.value); refreshPlan(); } });
    refreshPlan();
    const m = modal([
      h('div', { style: { textAlign: 'center' } }, icon('items/war', 72)),
      h('h2', { style: { textAlign: 'center' } }, `Invade ${p.villageName}?`),
      h('div.invade-row', h('span', 'Soldiers to send'), countLabel),
      slider,
      routeBtns,
      summary,
      h('div.row', { style: { flexWrap: 'wrap' } }, h('span.chip.evil', '−8 karma'), h('span.chip', 'The best fighters go first'), h('span.chip.bad', 'Some may not return')),
      err,
      h('div.row', h('div.spacer'), h('button.btn.ghost', { onclick: () => m.close() }, 'Stand down'),
        h('button.btn.danger', {
          disabled: check !== true,
          onclick: async e => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
              const r = await mp.launchAttack(p.uid, plan);
              m.close();
              this.announce(plan.bySea ? `Your fleet sails to invade ${r.target.villageName}!` : `Your army marches on ${r.target.villageName}!`);
            } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
          },
        }, 'Invade!')),
    ]);
  }

  ranksPanel() {
    this.rankTab ??= 'pop';
    const tabs = h('div.tabs', [['pop', 'Population'], ['wealth', 'Wealth'], ['saints', 'Saints'], ['tyrants', 'Tyrants']].map(([id, label]) =>
      h(`button${this.rankTab === id ? '.on' : ''}`, { onclick: () => { this.rankTab = id; this.rankData = null; this.refreshPanel(); } }, label)));
    const body = h('div.side-body');
    const [field, dir] = { pop: ['pop', 'desc'], wealth: ['wealth', 'desc'], saints: ['karma', 'desc'], tyrants: ['karma', 'asc'] }[this.rankTab];
    if (!this.rankData || this.rankData.tab !== this.rankTab) {
      body.append(h('div.muted', 'Consulting the chronicles…'));
      const tab = this.rankTab;
      leaderboard(field, dir).then(rows => { if (this.rankTab === tab) { this.rankData = { tab, rows }; this.refreshPanel(); } })
        .catch(e => { body.replaceChildren(h('div.error-text', e.message)); });
    } else {
      const list = h('div.col', { style: { gap: '4px' } });
      this.rankData.rows.forEach((p, i) => list.append(h('div.lb-row',
        h('span.rank', i + 1),
        avatar(p.name, 36),
        h('div', h('div', { style: { fontWeight: 700 } }, p.villageName), h('div.faint', `${p.name} · ${ERAS[p.era || 0]?.name}`)),
        h('span.score', field === 'karma' ? p.karma : fmt(p[field] || 0)))));
      body.append(list);
    }
    return [this.head('items/crown_leader', 'Leaderboards'), tabs, body];
  }

  settingsPanel() {
    const g = this.game;
    const body = h('div.side-body');
    const saveBtn = h('button.btn.primary', {
      onclick: async () => {
        saveBtn.disabled = true;
        try { await this.onSave(); this.hint('Village saved to the cloud ☁', 1500); } catch (e) { this.hint(`Save failed: ${e.message}`, 3000); }
        saveBtn.disabled = false;
        this.refreshPanel();
      },
    }, '☁ Save now');
    const item = (ic, label, onclick) => h('button.set-item', { onclick }, h('span.set-icon', ic), h('span', label), h('span.set-arrow', '›'));
    const danger = h('details.set-danger',
      h('summary', 'Danger zone'),
      h('div.faint', 'Abandoning deletes this village forever and three new humans start over.'),
      h('button.btn.danger.sm', { onclick: async () => { if (await confirmModal('Abandon village?', 'Your village will be lost forever and three new humans will start over.', { okLabel: 'Abandon', okClass: 'danger' })) this.onRestart(); } }, 'Abandon village'));
    const install = installButton('button.set-item');
    body.append(
      h('div.set-card',
        h('div.user-pill', avatar(g.state.owner.name, 38),
          h('div', h('div', { style: { fontWeight: 700 } }, g.state.owner.name), h('div.faint', `${g.state.owner.villageName} · founded ${new Date(g.state.createdAt).toLocaleDateString()}`))),
        h('div.row', saveBtn, h('span.faint', this.lastSavedAt ? `Last saved ${timeAgo(this.lastSavedAt)}` : 'Autosaves every 30s'))),
      h('div.set-list',
        item('👤', 'My profile', () => this.showProfile({ uid: this.user.uid, name: this.username })),
        item('🌍', 'Switch world', () => this.onSwitchWorld?.()),
        this.tutorial ? item('🎓', 'Restart tutorial', () => { this.tutorial.restart(); this.closePanel(); }) : null,
        install,
        item('✥', 'Move controls (layout)', () => { this.closePanel(); setTimeout(() => openLayoutEditor(), 250); }),
        item('🚪', 'Sign out', this.onSignOut)),
      h('h3', 'Gameplay'),
      h('label.set-toggle', h('input', { type: 'checkbox', checked: quickCraft(), onchange: e => setQuickCraft(e.target.checked) }), h('span', 'Quick craft: skip the minigames for tools and potions')),
      h('h3', 'Sound'),
      this.soundSliders(),
      h('h3', 'Controls'),
      this.controlsSettings(),
      h('h3', 'Version'),
      this.versionRow(),
      danger);
    // the install entry gets the same look as the other rows
    install.replaceChildren(h('span.set-icon', '📲'), h('span', 'Install app'), h('span.set-arrow', '›'));
    return [this.head('items/save', 'Save & Settings'), body];
  }

  /** Settings → Controls: click a key to change it (keys that clash swap), or reset them all. */
  controlsSettings() {
    const box = h('div.controls-set');
    const render = () => {
      box.replaceChildren(
        h('div.faint.controls-note', 'Click a key, then press the new one. Arrow keys always move too. Saved on this device.'),
        ...CONTROL_GROUPS.map(group => h('div.controls-group',
          h('div.controls-group-title', group),
          ...ACTIONS.filter(a => a.group === group && (!a.feature || on(a.feature))).map(a => h('div.key-row.control-row',
            h('span', a.label),
            h('button.kbd-btn' + (keyOf(a.id) !== a.def ? '.changed' : ''), { onclick: e => capture(a, e.currentTarget) }, keyLabel(keyOf(a.id))))))),
        h('div.key-row', h('kbd', 'Esc'), h('span.faint', 'Cancel / close')),
        h('div.key-row', h('kbd', 'Ctrl+Z'), h('span.faint', 'Undo last build or demolish')),
        h('div.key-row', h('kbd', 'Drag / Scroll'), h('span.faint', 'Look around / zoom')),
        h('div.row', h('button.btn.sm', { onclick: () => { resetBinds(); render(); this.hint('Controls reset to the defaults', 2000); } }, 'Reset to defaults')));
    };
    const capture = (action, btn) => {
      if (this._rebinding) return;
      btn.textContent = 'Press a key…';
      btn.classList.add('waiting');
      const onKey = e => {
        e.preventDefault(); e.stopImmediatePropagation();
        const k = e.key.toLowerCase();
        window.removeEventListener('keydown', onKey, true);
        setTimeout(() => { this._rebinding = false; }, 0);
        if (k === 'escape') { render(); return; }
        if (RESERVED.has(k)) { this.hint(`${keyLabel(k)} is already used everywhere; pick another key`, 2500); render(); return; }
        const swapped = setBind(action.id, k);
        if (swapped) this.hint(`${keyLabel(k)} was used for ${ACTIONS.find(a => a.id === swapped).label}: they swapped keys`, 3000);
        render();
      };
      this._rebinding = true;
      window.addEventListener('keydown', onKey, true);
    };
    render();
    return box;
  }

  soundSliders() {
    const cur = soundSettings();
    const slider = (kind, label) => h('label.slider-row', h('span', label),
      h('input', { type: 'range', min: 0, max: 100, value: Math.round(cur[kind] * 100), oninput: e => setVolume(kind, e.target.value / 100), onchange: () => play('coin') }));
    return h('div.col', { style: { gap: '4px' } }, slider('master', 'Master'), slider('sfx', 'Effects'), slider('music', 'Music'));
  }

  /** Build number + a button that asks the live site whether a newer version is out. */
  versionRow() {
    const status = h('span.faint', '');
    const btn = h('button.btn.sm', {
      onclick: async () => {
        btn.disabled = true; status.textContent = 'Checking…';
        try {
          const r = await checkLatest();
          status.textContent = r.isLatest ? '✓ Newest version' : `New version ${r.live.version} is out — reload to update`;
          status.style.color = r.isLatest ? 'var(--good)' : 'var(--gold)';
          if (!r.isLatest) { btn.textContent = 'Reload now'; btn.onclick = () => location.reload(); }
        } catch (e) { status.textContent = `Could not check (${e.message})`; }
        btn.disabled = false;
      },
    }, 'Check for updates');
    return h('div.col', { style: { gap: '6px' } },
      h('div.row', { style: { flexWrap: 'wrap' } }, h('span.chip', `v${BUILD.version}`), h('span.chip', `#${BUILD.commit}`), btn),
      status,
      h('div.faint', `Latest: ${LATEST_CHANGES.title} — ${LATEST_CHANGES.changes.join(' · ')}`));
  }

  updateBadges() {
    const btn = this.els.dock.world;
    if (!btn || !this.mp) return;
    btn.querySelector('.badge')?.remove();
    const n = this.mp.inbox.filter(o => o.status === 'pending' || o.status === 'seen').length;
    if (n) btn.append(h('span.badge', n));
  }

  // ------------------------------------------------------------ inspector
  updateInspector(force = false) {
    const sel = this.game.selected;
    if (!sel) { this.inspector?.remove(); this.inspector = null; return; }
    const stale = (sel.kind === 'villager' && !this.game.state.villagers.includes(sel.ref))
      || (sel.kind === 'creature' && !this.game.state.creatures.includes(sel.ref))
      || (sel.kind === 'building' && !this.game.state.buildings.includes(sel.ref))
      || (sel.kind === 'object' && !this.game.state.objects.includes(sel.ref));
    if (stale) { this.game.selected = null; this.inspector?.remove(); this.inspector = null; return; }
    if (!this.inspector) {
      this.inspector = h('div.card.inspector');
      this.root.append(this.inspector);
    }
    // don't rebuild under the mouse: a rebuild between press and release swallows clicks
    if (!force && (this.inspector.matches(':hover') || (this.inspector.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'))) return;
    const content = this[`inspect_${sel.kind}`](sel.ref);
    this.inspector.replaceChildren(h('button.btn.icon.ghost.close', { onclick: () => this.select(null) }, '✕'), ...content.filter(x => x != null && x !== false));
  }

  /** Pick an item out of a villager's pack and hand it to someone else on the map. */
  /**
   * Drag an item on a keychain: from a villager's pack (from = villager) or off the ground (ground = item).
   * Drop it on a villager to give it, on open ground to lay it there.
   */
  dragItem(e, from, key, count, ground = null) {
    const g = this.game;
    const label = ITEMS[key]?.label || key;
    const overMap = (sx, sy) => !document.elementFromPoint(sx, sy)?.closest('#ui > *:not(.drag-keychain)');
    startItemDrag(e, {
      iconKey: ITEMS[key]?.icon || 'items/relic',
      count,
      findTarget: (sx, sy) => {
        if (!overMap(sx, sy)) return null;   // over a panel, not the map
        const w = this.renderer.screenToWorld(sx, sy);
        let best = null, bd = TILE * 0.9;
        for (const v of g.state.villagers) {
          if (v === from || v.away) continue;
          const d = Math.hypot(v.x - w.x, v.y - TILE * 0.4 - w.y);
          if (d < bd) { bd = d; best = v; }
        }
        return best;
      },
      // no villager under the cursor: over the map it can be put down
      groundAt: (sx, sy) => {
        if (!overMap(sx, sy)) return null;
        const w = this.renderer.screenToWorld(sx, sy);
        return g.world.walkable(w.x, w.y) ? w : null;
      },
      onDrop: to => {
        if (ground) {
          if (!pickUp(g, to, ground)) return;
          g.log(`${to.name} picked up ${ground.count > 1 ? `${ground.count} ` : 'a '}${label}.`, 'info');
        } else {
          if (!takeItem(from, key)) return;
          addItem(to, key, 1);
          g.float(to.x, to.y - TILE, `+1 ${label}`, '#ffd76a');
          g.log(`${from.name} gave ${to.name} a ${label}.`, 'info');
        }
        this.updateInspector(true);
      },
      onGround: w => {
        if (ground) moveItem(g, ground, w.x, w.y);
        else if (dropFromPack(g, from, key, 1, w.x, w.y)) g.log(`${from.name} dropped a ${label}.`, 'info');
        this.updateInspector(true);
      },
    });
  }

  /** Pointer down on the map: grab a ground item if there is one under the cursor. */
  grabGroundItem(e) {
    if (this.visiting || this.buildType || this.demolishMode) return false;
    const w = this.renderer.screenToWorld(e.clientX, e.clientY);
    const it = itemAt(this.game, w.x, w.y);
    if (!it) return false;
    this.dragItem(e, null, it.item, it.count, it);
    return true;
  }

  inspect_villager(v) {
    const g = this.game;
    const role = displayRole(v);
    const partner = g.state.villagers.find(x => x.id === v.partner);
    const task = v._task ? TASK_TEXT[v._task.type] || v._task.type : 'Thinking';
    const statRow = (label, val, color) => h('div.stat', h('span', label), bar(val / 100, color), h('span', Math.round(val)));
    const ruler = rulerOf(g);
    const isHeir = g.state.ruler?.heirId === v.id;
    const inv = inventory(v);
    const eq = equipment(g, v);
    const parents = (v.parents || []).map(id => g.state.villagers.find(x => x.id === id)?.name).filter(Boolean);
    const act = key => h('button.btn.sm', {
      title: `${ENCOURAGE[key].desc} (${Object.entries(ENCOURAGE[key].cost).map(([k, n]) => `${n} ${k}`).join(', ')})`,
      onclick: () => { const r = encourage(g, v, key); if (r.error) this.hint(r.error, 2200); this.updateInspector(true); },
    }, icon(ENCOURAGE[key].icon, 16), ENCOURAGE[key].label);
    const slot = (label, item) => h('div.inv-slot', { title: item ? `${item.quality ? item.quality + ' ' : ''}${item.label}${item.desc ? ' — ' + item.desc : ''}` : `No ${label}` },
      item ? icon(item.icon, 28) : h('span.faint', '—'), h('span', label));

    const badges = [
      v.ruling ? h('span.chip.good', `👑 ${rulerTitle(g, v)} · ${RULER_TYPES[g.state.ruler.type]?.label}`) : null,
      isHeir ? h('span.chip', '⭐ Heir') : null,
      v.office ? h('span.chip.good', OFFICES[v.office].name) : null,
      v.traits.includes('knighted') ? h('span.chip.good', '⚔ Knight') : isTrained(v) ? h('span.chip', 'Trained soldier') : null,
      v.gifted ? h('span.chip.good', { title: 'Born stronger than others. Learns their talents three times as fast, but may grow proud.' }, '★ Gifted') : null,
      v.age >= ADULT_AGE ? h(`span.chip${isVersatile(v) ? '.good' : ''}`, { title: isVersatile(v) ? 'Can work in any job' : 'Works in this trade (or gathers food). Only a Jack of all trades can switch.' }, `🧰 ${professionLabel(v)}`) : null,
    ].filter(Boolean);

    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(villagerSprite({ ...v, role }), 72)),
        h('div.col', { style: { gap: '2px' } },
          h('div.title', v.traits.includes('knighted') ? `Sir ${fullName(v)}` : fullName(v)),
          h('div.faint', `${v.sex === 'f' ? '♀' : '♂'} Age ${Math.floor(v.age)} · Gen ${v.gen || 1}${g.state.ruler?.dynasty && (v.ruling || v.parents?.includes(g.state.ruler.id)) ? ` · House ${g.state.ruler.dynasty}` : ''}`),
          h('div', { style: { fontSize: '13px' } }, v.sick ? '🤒 ' : '', task),
          partner ? h('div.faint', `♥ ${partner.name}`) : null,
          parents.length ? h('div.faint', `Child of ${parents.join(' & ')}`) : null,
          (() => { const home = homeOf(g, v); return h('div.faint', home ? `Home: ${BUILDINGS[home.type].name}${home.family ? ` of the ${home.family} family` : ''}` : 'No home of their own yet'); })())),
      badges.length ? h('div.traits', badges) : null,
      // natural talents: what they were born good at (they learn these fast)
      v.talents?.length ? h('div.talents', h('span.faint', 'Natural talents'),
        ...v.talents.map((t, i) => h(`span.chip${i === 0 ? '.good' : ''}`, { title: i === 0 ? 'Main talent: decides their trade' : 'Second talent' }, `${i === 0 ? '★ ' : ''}${talentLabel(t)}`))) : null,
      v.gifted && !v.ruling ? h('div.stat', { title: 'Gifted people grow proud unless they are respected (an office, a knighthood, Discipline). At full pride they rebel.' },
        h('span', icon('magic/proud', 14), (v.ego || 0) >= EGO_PROUD ? ' Pride!' : ' Pride'), bar((v.ego || 0) / 100, (v.ego || 0) >= EGO_PROUD ? '#ff7a4a' : '#c9a0ff'), h('span', Math.round(v.ego || 0))) : null,
      h('div.row', { style: { flexWrap: 'wrap', gap: '4px' } },
        h('button.btn.sm', { onclick: () => this.talkModal(v) }, icon('magic/talk_dots', 16), 'Talk')),
      v.job === 'mage' ? this.spellCard(v) : null,
      h('div.traits', v.traits.filter(t => !BADGE_TRAITS.includes(t)).length
        ? v.traits.filter(t => !BADGE_TRAITS.includes(t)).map(t => h(`span.chip.${TRAITS[t]?.good ? 'good' : 'bad'}`, { title: TRAITS[t]?.desc }, `${TRAITS[t]?.earned ? '★ ' : ''}${TRAITS[t]?.label || t}`))
        : h('span.faint', 'No notable traits yet')),
      statRow('Health', v.hp, v.hp > 40 ? '#6fdc5a' : '#ff5a4a'),
      statRow('Hunger', v.hunger, '#ffb44a'),
      statRow('Happy', v.happy, '#ffd76a'),
      h('h3', 'Body'),
      ...Object.entries(BODY).map(([k, label]) => h('div.stat', { title: BODY_TIP[k] }, h('span', label), bar(Math.min(1, bodyStat(v, k) / 10), BODY_COLOR[k]), h('span', bodyStat(v, k) >= 100 ? String(Math.round(bodyStat(v, k))) : bodyStat(v, k).toFixed(1)))),

      h('h3', 'Inventory'),
      h('div.inv', slot('Tool', eq.tool), slot('Weapon', eq.weapon), slot('Armor', eq.armor),
        h('div.inv-slot', { title: 'Wages earned from work' }, h('b', { style: { color: 'var(--gold)', fontSize: '16px' } }, inv.coins), h('span', 'Coins'))),
      // the pack shows what is not already in a slot above
      h('div.traits', packExtras(inv.pack, eq).length
        ? packExtras(inv.pack, eq).map(([k, n]) => h('span.chip.pack-item', {
          title: `${ITEMS[k]?.desc || ''}${ITEMS[k]?.desc ? ' · ' : ''}Drag onto another villager to give it`,
          onpointerdown: e => this.dragItem(e, v, k, n),
        }, icon(ITEMS[k]?.icon || 'items/relic', 16), `${ITEMS[k]?.label || k} ×${n}`))
        : h('span.faint', 'Pack is empty')),
      v.kills ? h('div.faint', `⚔ ${v.kills} foes defeated`) : null,

      h('h3', 'Skills'),
      h('div.skills', Object.entries(v.skills).map(([k, val]) => h('div.skill', h('span', `${k} ${Math.floor(val)}`), bar(val / 10)))),

      v.age < ADULT_AGE
        ? h('div.faint', `A child. They will grow up to work with their talent${v.talents?.[0] ? ` for ${talentLabel(v.talents[0]).toLowerCase()}` : ''}.`)
        : v.office || v.ruling
          ? (v.office ? h('div.law.active', h('div', h('b', `👑 ${OFFICES[v.office].name}`), h('div.faint', OFFICES[v.office].desc)),
            h('button.btn.sm', { onclick: () => dismiss(g, v.office) }, 'Dismiss')) : null)
          : h('div.field', h('label', `Job ${v.manual ? '· your order' : officialOf(g, 'steward') ? '· managed by Steward' : ''}`),
            h('select.input', {
              onchange: e => {
                const ok = assignJob(g, v, e.target.value);
                if (!ok && g.lastJobError) { this.hint(g.lastJobError, 2600); g.lastJobError = null; }
                if (e.target.value === 'warrior' && v.job === 'recruit') this.hint(`${v.name} is not trained yet — sent to drill as a recruit.`, 2600);
                this.updateInspector(true);
              },
            }, Object.entries(JOBS).filter(([id]) => id === v.job || canDoJob(v, id)).map(([id, d]) => h('option', { value: id, selected: v.job === id }, d.label + (id === 'warrior' && !isTrained(v) ? ' (needs training)' : ''))))),
      v.job === 'warrior' ? h('div', v.armed ? h('span.chip.good', icon('items/sword', 16), 'Armed') : h('span.chip.bad', 'Unarmed — needs a weapon')) : null,

      (v.suspicion || v.exposed || v.jailed) ? h('div.law-cat', { style: { borderColor: v.exposed ? 'var(--bad)' : 'var(--line)' } },
        h('div.row', icon(v.exposed ? 'units/traitor' : 'effects/emote_question', 26),
          h('div', h('b', v.jailed ? 'Imprisoned' : v.exposed ? 'Exposed traitor!' : 'Under suspicion'),
            h('div.faint', v.jailed ? 'Locked away where they can do no harm.' : v.exposed ? 'Caught working against the realm.' : `Suspicion ${v.suspicion}% — whispers say they cannot be trusted.`))),
        h('div.row', { style: { flexWrap: 'wrap', gap: '4px' } },
          !v.exposed && !v.jailed ? h('button.btn.sm', { onclick: () => { const r = accuse(g, v); this.hint(r.text, 2500); this.updateInspector(true); } }, '⚖ Accuse') : null,
          (v.exposed || v.jailed) ? h('button.btn.sm', { onclick: () => { const r = punishTraitor(g, v, 'imprison'); if (r.error) this.hint(r.error, 2200); this.updateInspector(true); } }, '⛓ Imprison') : null,
          (v.exposed || v.jailed) ? h('button.btn.sm.ghost', { onclick: () => { punishTraitor(g, v, 'exile'); this.select(null); } }, 'Exile') : null,
          (v.exposed || v.jailed) ? h('button.btn.sm.danger', { onclick: async () => { if (await confirmModal(`Execute ${v.name}?`, 'Justice or cruelty? Executing an innocent costs a lot of karma.', { okLabel: 'Execute', okClass: 'danger' })) punishTraitor(g, v, 'execute'); } }, 'Execute') : null,
          h('button.btn.sm.good', { onclick: () => { punishTraitor(g, v, 'pardon'); this.updateInspector(true); } }, 'Pardon'))) : null,
      !v.suspicion && !v.exposed && !v.jailed && v.age >= ADULT_AGE && !v.ruling ? h('div.row', h('span.faint', 'Think they are a traitor?'), h('button.btn.sm.ghost', {
        onclick: async () => { if (await confirmModal(`Accuse ${v.name} of treason?`, 'If they are innocent, they and the people will resent it.', { okLabel: 'Accuse', okClass: 'danger' })) { const r = accuse(g, v); this.hint(r.text, 2500); this.updateInspector(true); } },
      }, '⚖ Accuse')) : null,

      h('h3', 'Shape this person'),
      h('div.row', { style: { flexWrap: 'wrap', gap: '4px' } }, act('praise'), act('mentor'), act('discipline'), v.job === 'warrior' || isTrained(v) ? act('knight') : null,
        !v.ruling ? h('button.btn.sm', { onclick: () => { setHeir(g, isHeir ? null : v); this.updateInspector(true); } }, isHeir ? '✖ Unname heir' : '⭐ Name heir') : null),
      h('div.row', { style: { flexWrap: 'wrap' } },
        h('button.btn.sm', { onclick: () => { this.follow = this.follow === v ? null : v; } }, this.follow === v ? '📍 Following' : '📍 Follow'),
        h('div.spacer'),
        !v.ruling ? h('button.btn.sm.ghost', { onclick: async () => { if (await confirmModal(`Exile ${v.name}?`, 'They will leave forever. −3 karma.', { okLabel: 'Exile', okClass: 'danger' })) exileVillager(g, v); } }, 'Exile') : null,
        h('button.btn.sm.evil', { onclick: async () => {
          if (await confirmModal(`Sacrifice ${v.name}?`, `The gods grant +40 influence and great luck for 2 days. −15 karma.${v.ruling ? ' Sacrificing your own ruler will throw the realm into chaos.' : ''}`, { okLabel: 'Sacrifice', okClass: 'evil' })) this.float(sacrificeVillager(g, v));
        } }, '🩸 Sacrifice')),
    ];
  }

  /** Who lives in a house: the family it is reserved for, and every resident. */
  homeCard(b) {
    const g = this.game;
    const people = residents(g, b);
    const cap = BUILDINGS[b.type].housing;
    const title = b.family ? `Home of the ${b.family} family` : b.families?.length ? `Flats: the ${b.families.slice(0, 4).join(', ')}${b.families.length > 4 ? '...' : ''} families` : 'Empty: free for the next family';
    return h('div.home-card',
      h('div.row', h('b', title), h('div.spacer'), h('span.chip', `Beds ${people.length}/${cap}`)),
      people.length
        ? h('div.traits', people.map(v => h('span.chip', { style: { cursor: 'pointer' }, onclick: () => this.select({ kind: 'villager', ref: v }) }, ``)))
        : h('div.faint', 'Families without a home move in on their own.'));
  }

  /** Auto-pick on/off: when a law or office unlocks, the best choice is made for you. */
  autoPickToggle() {
    const g = this.game;
    const on = autoPickOn(g);
    return h('div.law.active', { style: { alignItems: 'center' } },
      h('div', { style: { flex: 1 } }, h('b', 'Auto-pick'), h('div.faint', 'When a law or court office unlocks, the best choice is made for you. Laws you set yourself are never changed.')),
      h('label.toggle', h('input', { type: 'checkbox', checked: on, onchange: ev => { g.state.autoPick = ev.target.checked; if (ev.target.checked) runAutoPick(g); this.refreshPanel(); } }), h('span', on ? 'On' : 'Off')));
  }

  /** Missile Silo / Orbital Cannon: aim a strike at your own land. Strikes abroad are aimed from a realm's profile. */
  strikeCard(orbital) {
    const g = this.game;
    return h('div.strike-card',
      h('b', orbital ? 'Orbital strike' : 'Missile strike'),
      h('div.faint', `Fire at a spot you choose on our own land: clear monsters, raiders, forest and rocks, or flatten what you no longer want (${strikeRadius(orbital)} tile blast). Strike another realm from their profile: Covert operations.`),
      costChips(MISSILE_COST, g.state.resources),
      h('div.row', { style: { flexWrap: 'wrap', gap: '6px' } },
        h('button.btn.danger', { onclick: () => this.aimOwnStrike(orbital) }, 'Aim at our land'),
        this.mp ? h('button.btn.danger', { onclick: () => this.pickStrikeTarget(orbital) }, 'Aim at another realm') : null));
  }

  /** Multiplayer: choose whose land to strike, then aim on their map. */
  pickStrikeTarget(orbital) {
    const me = this.user?.uid;
    const realms = (this.mp?.players || []).filter(p => p.uid !== me && p.villageName)
      .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || String(a.villageName).localeCompare(b.villageName));
    const m = modal([
      h('h2', orbital ? 'Orbital strike: choose a realm' : 'Missile: choose a realm'),
      realms.length
        ? h('div.col', { style: { gap: '6px', maxHeight: '50vh', overflowY: 'auto' } }, realms.map(p => h('button.choice', {
          onclick: () => { m.close(); this.aimStrike(p, orbital); },
        }, h('span.label', p.villageName), h('span.faint', `${p.name || ''}${p.online ? ' · online' : ''}${p.missileShield ? ' · has a Shield Generator' : ''}`))))
        : h('div.muted', 'No other realms in this world yet.'),

    ], { closeX: true });
  }

  aimOwnStrike(orbital) {
    const g = this.game;
    openAimMap(g, {
      title: orbital ? 'Aim the Orbital Cannon' : 'Aim a missile at our land',
      orbital, fireLabel: 'Fire', note: 'Careful: it hits your own buildings and people too. −3 karma.',
      costChips: costChips(MISSILE_COST, g.state.resources),
      onFire: aim => {
        const r = strikeOwnLand(g, orbital, aim);
        if (r.error) throw new Error(r.error);
        this.select(null);
        Object.assign(this.renderer.camera, { x: (aim.tx + 0.5) * TILE, y: (aim.ty + 0.5) * TILE });
      },
    });
  }

  /** Aim a missile at another player's land: their island and buildings, as they last saved them. */
  async aimStrike(p, orbital) {
    const g = this.game;
    let target;
    try {
      const profile = await getProfile(p.uid);
      target = makeVisitGame({ ...profile, uid: p.uid });
    } catch (e) { this.hint(e.message || 'Could not map that realm', 4000); return; }
    openAimMap(target, {
      title: `${orbital ? 'Orbital strike' : 'Missile'}: ${p.villageName}`,
      orbital, fireLabel: 'Launch',
      note: `Their land as they last saved it. −${orbital ? 35 : 25} karma. A Shield Generator stops it.`,
      costChips: costChips(MISSILE_COST, g.state.resources),
      onFire: async aim => {
        await this.mp.launchMission(p.uid, orbital ? 'orbital' : 'missile', aim);
        this.announce('☢ Launched!');
      },
    });
  }

  /** Shipyard: build boats, repair them, and set sail. */
  shipyardCard() {
    const g = this.game;
    const fleet = fleetOf(g);
    const eraName = e => ERAS[e]?.name || '';
    return h('div.ability',
      h('div.ability-head', icon('boats/ship_wheel', 30), h('div', h('div.ability-name', 'Your fleet'), h('div.faint', 'Steer with W A S D (or the arrows), Space fires bombs, Esc returns to port'))),
      fleet.length ? h('div.fleet', fleet.map(b => {
        const def = BOATS[b.type];
        return h('div.fleet-row', icon(`boats/${b.type}`, 34),
          h('div.fleet-info', h('b', b.name), h('div.stat', h('span', 'Hull'), bar(b.hull / def.hull, '#6fdc5a'), h('span', `${Math.ceil(b.hull)}/${def.hull}`))),
          b.hull < def.hull ? h('button.btn.sm', { onclick: () => { const r = repairBoat(g, b.id); if (r.error) this.hint(r.error, 1800); this.updateInspector(true); } }, 'Repair') : null,
          b.awayUntil > Date.now() ? h('span.chip', 'Away on an invasion') : h('button.btn.sm.primary', { onclick: () => { const r = setSail(g, b.id); if (r.error) { this.hint(r.error, 2000); return; } play('ability'); this.select(null); this.closePanel(); this.renderer.camera.zoom = Math.max(this.renderer.camera.zoom, 1.8); this.hint('Set sail! Steer with W A S D, Space fires bombs, Esc returns to port.', 5000); } }, 'Set sail'));
      })) : h('div.faint', 'No boats yet. Build one below.'),
      h('div.boat-list', Object.entries(BOATS).map(([type, def]) => {
        const locked = def.era > g.state.era;
        return h(`div.boat-card${locked ? '.locked' : ''}`, { title: def.desc },
          icon(`boats/${type}`, 40),
          h('div.boat-info', h('b', def.name), h('span.faint', locked ? `${eraName(def.era)} era` : `Hull ${def.hull} · ${def.guns} gun${def.guns === 1 ? '' : 's'} · speed ${def.speed}`), locked ? null : costChips(def.cost, g.state.resources)),
          locked ? null : h('button.btn.sm', { onclick: () => { const r = buildBoat(g, type); if (r.error) this.hint(r.error, 1800); else play('build'); this.updateInspector(true); } }, 'Build'));
      })));
  }

  /** While sailing: the ship's status and controls. */
  updateSailBar() {
    const g = this.game, s = g.sail, bar2 = this.els.sailBar;
    this.root.classList.toggle('at-sea', !!s);   // the map corner and village buttons step aside for the helm
    if (!s?.arena && this._seaView) { this._seaView = false; this.onSeaView?.(null); }
    if (!s) { if (!bar2.hidden) { bar2.hidden = true; bar2.replaceChildren(); this._sailKey = null; this.els.helm?.remove(); this.els.helm = null; Object.assign(this.sailInput, { throttle: 0, turn: 0, fire: false, wheel: 0 }); } return; }
    const boat = fleetOf(g).find(b => b.id === s.boatId);
    const def = BOATS[s.type];
    const key = [Math.ceil(boat?.hull || 0), Math.floor(g.state.resources.bombs || 0), s.pirates.length, s.gold, s.atEdge, !!s.arena, s.others?.size || 0].join('|');
    if (key === this._sailKey) return;
    const first = !this._sailKey;
    this._sailKey = key;
    bar2.hidden = false;
    const status = h('div.sail-status',
      icon(`boats/${s.type}`, 34),
      h('div', h('b', boat?.name || def.name), h('div.stat', h('span', 'Hull'), bar((boat?.hull || 0) / def.hull, '#6fdc5a'), h('span', Math.ceil(boat?.hull || 0)))),
      h('span.chip', icon('boats/sea_bomb', 16), `${Math.floor(g.state.resources.bombs || 0)} bombs`),
      s.arena ? h('span.chip', { style: { borderColor: '#5aa9d6', color: '#9fd4ff' } }, `Open Sea · ${s.others.size} other ship${s.others.size === 1 ? '' : 's'}`) : null,
      s.pirates.length ? h('span.chip.bad', `${s.pirates.length} pirate${s.pirates.length === 1 ? '' : 's'}`) : null,
      s.gold ? h('span.chip.good', `+${s.gold} gold`) : null);
    const actions = h('div.sail-actions',
      s.atEdge && !s.arena ? h('button.btn.sm.primary', { onclick: () => this.enterSea() }, 'Enter the Open Sea') : null,
      s.atEdge && !s.arena ? h('button.btn.sm', { onclick: () => this.openMap() }, 'World Map') : null,
      h('button.btn.sm.ghost', { onclick: () => returnToPort(g) }, 'Return to port'));
    bar2.replaceChildren(status, actions);
    // the helm is built once, so a held wheel or cannon is never interrupted by a status update
    if (!this.els.helm) { this.els.helm = this.buildHelm(); this.root.append(this.els.helm); }
  }

  /** The ship's controls on screen: a wheel to steer, an engine telegraph for speed, a compass, and the cannon. */
  buildHelm() {
    const t = this.sailInput;
    const g = this.game;
    // --- the wheel: drag sideways (or hold a side) to steer; it springs back when you let go
    const wheelImg = icon('boats/ship_wheel', 120);
    const wheel = h('div.helm-wheel', { title: 'Drag to steer (A / D)' }, wheelImg, h('span.helm-key', 'A  ·  D'));
    let drag = null;
    wheel.addEventListener('pointerdown', e => {
      e.preventDefault();
      wheel.setPointerCapture?.(e.pointerId);
      const r = wheel.getBoundingClientRect();
      drag = { x: e.clientX, cx: r.left + r.width / 2 };
      t.turn = Math.max(-1, Math.min(1, (e.clientX - drag.cx) / (r.width * 0.35)));
    });
    wheel.addEventListener('pointermove', e => { if (drag) t.turn = Math.max(-1, Math.min(1, (e.clientX - drag.cx) / (wheel.offsetWidth * 0.35))); });
    const release = () => { drag = null; t.turn = 0; };
    wheel.addEventListener('pointerup', release);
    wheel.addEventListener('pointercancel', release);

    // --- the engine telegraph: a brass lever with fixed speeds that stays where you set it
    const notches = h('div.telegraph-notches', TELEGRAPH.map(([label, value]) => h('button.telegraph-notch', { 'data-v': value, onpointerdown: e => { e.preventDefault(); t.throttle = value; } }, label)));
    const knob = h('div.telegraph-knob');
    const lever = h('div.telegraph', { title: 'Engine: W / S' }, h('div.telegraph-track', knob), notches, h('span.helm-key', 'W  ·  S'));
    lever.addEventListener('pointermove', e => {
      if (!(e.buttons & 1) || e.target.closest('.telegraph-notch')) return;
      const r = lever.querySelector('.telegraph-track').getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      t.throttle = TELEGRAPH[Math.round(f * (TELEGRAPH.length - 1))][1];
    });

    // --- compass and speed
    const needle = h('div.compass-needle');
    const speed = h('div.compass-speed', '0 kn');
    const compass = h('div.helm-compass', h('span.cn.n', 'N'), h('span.cn.e', 'E'), h('span.cn.s', 'S'), h('span.cn.w', 'W'), needle, speed);

    // --- the cannon: hold to keep firing; the ring fills as the guns reload
    const cannon = h('button.helm-cannon', { title: 'Fire (Space)' }, icon('boats/sea_bomb', 44), h('span.cannon-label', 'FIRE'), h('span.cannon-bombs'), h('span.helm-key', 'Space'));
    cannon.addEventListener('pointerdown', e => { e.preventDefault(); cannon.setPointerCapture?.(e.pointerId); t.fire = true; fire(g); cannon.classList.add('boom'); setTimeout(() => cannon.classList.remove('boom'), 180); });
    const stop = () => { t.fire = false; };
    cannon.addEventListener('pointerup', stop);
    cannon.addEventListener('pointercancel', stop);

    const helm = h('div.helm', h('div.helm-left', wheel, lever, compass), cannon);
    Object.assign(this.els, { helmWheel: wheelImg, helmKnob: knob, helmNotches: notches, helmNeedle: needle, helmSpeed: speed, helmCannon: cannon });
    return helm;
  }

  /** Out past your waters: the shared ocean where other players' ships sail. */
  enterSea() {
    const g = this.game;
    const me = realmPos(this.user.uid);
    const seaGame = enterOpenSea(g, Math.atan2(me.y - 50, me.x - 50));   // arrive on your island's side of the ocean
    if (!seaGame) return;
    this._seaView = true;
    this.onSeaView?.(seaGame);
    this.mp?.enterSea();
    play('ability');
    this.hint(this.mp ? 'The Open Sea: other players\' ships sail here. Sink them for gold, or sail to the edge to go home.' : 'The Open Sea (offline: only pirates out here).', 6000);
    this._sailKey = null;
  }

  /** W / S move the telegraph one notch. */
  setTelegraph(dir) {
    const values = TELEGRAPH.map(n => n[1]);   // top (FULL) to bottom (BACK)
    let i = values.indexOf(this.sailInput.throttle);
    if (i < 0) i = values.indexOf(0);
    i = Math.max(0, Math.min(values.length - 1, i - dir));
    this.sailInput.throttle = values[i];
  }

  /** Every frame at sea: turn the wheel, move the lever, swing the compass, refill the cannon ring. */
  updateHelm(dt, turn) {
    const s = this.game.sail, t = this.sailInput, e = this.els;
    if (!s || !e.helm) return;
    t.wheel += ((turn || 0) * 140 - t.wheel) * Math.min(1, dt * 8);
    e.helmWheel.style.transform = `rotate(${t.wheel.toFixed(1)}deg)`;
    const idx = Math.max(0, TELEGRAPH.findIndex(n => n[1] === t.throttle));
    e.helmKnob.style.top = `${(idx / (TELEGRAPH.length - 1)) * 100}%`;
    for (const n of e.helmNotches.children) n.classList.toggle('on', Number(n.dataset.v) === t.throttle);
    e.helmNeedle.style.transform = `translate(-50%, -100%) rotate(${(s.angle * 180 / Math.PI + 90).toFixed(1)}deg)`;
    const kn = `${Math.round(Math.abs(s.speed) / TILE * 4)} kn`;
    if (e.helmSpeed.textContent !== kn) e.helmSpeed.textContent = kn;
    e.helmCannon.style.setProperty('--reload', (1 - Math.min(1, s.reload / RELOAD)).toFixed(3));
    const bombs = `${Math.floor(this.game.state.resources.bombs || 0)}`;
    const label = e.helmCannon.querySelector('.cannon-bombs');
    if (label.textContent !== bombs) label.textContent = bombs;
  }

  /** Mana and spells for a wizard. */
  spellCard(v) {
    const g = this.game;
    return h('div.ability',
      h('div.ability-head', icon('magic/spellbook', 30), h('div', h('div.ability-name', 'Magic'), h('div.faint', `Magic skill ${Math.floor(v.skills.magic || 0)} · wizards cast on their own when monsters come or someone is hurt`))),
      h('div.stat', h('span', 'Mana'), bar((v.mana || 0) / 100, '#8fb4ff'), h('span', Math.floor(v.mana || 0))),
      h('div.spells', Object.entries(SPELLS).map(([id, sp]) => {
        const ok = canCast(g, v, id);
        return h('button.btn.sm.spell', {
          disabled: ok !== true,
          title: `${sp.desc} (${sp.mana} mana${sp.minSkill ? `, magic ${sp.minSkill}+` : ''})${ok === true ? '' : ` · ${ok}`}`,
          onclick: () => { const r = castSpell(g, v, id); if (r.error) this.hint(r.error, 1800); else play('ability'); this.updateInspector(true); },
        }, icon(sp.icon, 16), sp.label, h('span.spell-cost', sp.mana));
      })));
  }

  /** A short conversation with a villager. */
  talkModal(v) {
    const g = this.game;
    const lines = h('div.talk-lines');
    const add = (who, text) => { lines.append(h(`div.talk-line.${who}`, text)); lines.scrollTop = lines.scrollHeight; };
    const first = talkTo(g, v, 'how');
    add('them', first);
    const m = modal([
      h('div.row', { style: { gap: '12px' } }, h('div.portrait', icon(villagerSprite({ ...v, role: displayRole(v) }), 56)),
        h('div', h('h2', { style: { margin: 0 } }, fullName(v)), h('div.faint', `${professionLabel(v)} · age ${Math.floor(v.age)}`))),
      lines,
      h('div.talk-topics', TOPICS.map(([id, label]) => h('button.btn.sm', { onclick: () => { add('you', label); add('them', talkTo(g, v, id)); } }, label))),

    ], { closeX: true });
  }

  /** The building's special action: button, cost and recharge timer. */
  abilityCard(b) {
    const g = this.game;
    const a = abilityOf(b.type);
    if (!a) return null;
    const left = abilityCooldown(g, b);
    const ok = canUseAbility(g, b);
    // real time left (a game day is only 90 seconds, so game hours looked like real days)
    const label = left > 0 ? `Ready in ${fmtWait(left / Math.max(0.1, g.speed || 1))}` : ok === true ? `${a.icon} ${a.name}` : ok;
    return h('div.ability',
      h('div.ability-head', h('span.ability-icon', a.icon), h('div', h('div.ability-name', a.name), h('div.faint', `Recharges every ${a.cooldown} game day${a.cooldown > 1 ? 's' : ''} (${fmtWait(a.cooldown * DAY_LENGTH)})`))),
      h('div.ability-desc', a.desc),
      h('div.row', { style: { flexWrap: 'wrap' } },
        a.cost ? costChips(a.cost, g.state.resources) : null,
        h('div.spacer'),
        h('button.btn.sm.primary', {
          disabled: ok !== true,
          onclick: () => {
            const r = useAbility(g, b);
            if (r.error) { this.hint(r.error, 1800); return; }
            this.toast({ text: `${a.icon} ${a.name}: ${r.text}`, kind: 'event' });
            this.updateInspector(true);
          },
        }, label)));
  }

  inspect_building(b) {
    const g = this.game;
    const def = BUILDINGS[b.type];
    const recipe = def.recipe;
    // everyone working here, including those walking back between catches or harvests
    const workers = g.state.villagers.filter(v => v._task?.building === b || (v._workAt?.id === b.id && g.state.time - v._workAt.t < 20)).length;
    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(buildingSprite(b.type), 72)),
        h('div.col', { style: { gap: '2px' } },
          h('div.title', def.name),
          b.built ? (b.blightUntil > g.state.time ? h('span.chip.bad', 'Blighted') : h('span.chip.good', 'Built')) : h('span.chip', `Building ${Math.floor(b.progress * 100)}%`))),
      !b.built ? bar(b.progress, '#ffd76a') : null,
      h('div.muted', def.desc),
      def.slots ? h('span.chip', `👷 ${workers}/${def.slots} working now`) : null,
      def.housing && b.type !== 'campfire' && b.built ? this.homeCard(b) : null,
      this.abilityCard(b),
      b.type === 'shipyard' && b.built && on('sailing') ? this.shipyardCard() : null,
      def.missile && b.built && on('missiles') ? this.strikeCard(!!def.orbital) : null,
      h('ul.effects', describeBuilding(b.type).filter(e => !e.text.startsWith('Ability')).map(e => h(`li${e.good ? '' : '.warn'}`, h('span', e.icon), e.text))),
      h('div.row', h('div.spacer'),
        (() => {
          const same = g.state.buildings.filter(x => x.type === b.type);
          return same.length > 1 ? h('button.btn.sm.ghost', { title: `Demolish every ${def.name}`, onclick: () => this.demolishMany(same) }, `🗑 All ${same.length}`) : null;
        })(),
        h('button.btn.sm.danger', { onclick: async () => {
          if (await confirmModal(`Demolish ${def.name}?`, `You get back ${b.built ? '40%' : '80%'} of its cost.`, { okLabel: 'Demolish', okClass: 'danger' })) { g.demolish(b); this.select(null); }
        } }, 'Demolish')),
    ];
  }

  inspect_creature(c) {
    const g = this.game;
    const def = CREATURES[c.t];
    const name = c.t.replace('_', ' ');
    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(def.sprite, 72)),
        h('div.col', { style: { gap: '4px' } },
          h('div.title', name[0].toUpperCase() + name.slice(1)),
          def.hostile ? h('span.chip.bad', 'Hostile') : h('span.chip.good', def.tame ? 'Tame' : 'Wild'))),
      h('div.stat', h('span', 'Health'), bar((c.hp ?? maxHp(c)) / maxHp(c), '#ff5a4a'), h('span', Math.ceil(c.hp ?? maxHp(c)))),
      def.hostile ? h('div.faint', `Deals ${def.damage} damage.`) : h('div.faint', def.food ? 'Hunters can bring it down for food.' : 'Harmless.'),
      // no Divine Smite or Throw bomb buttons any more
    ];
  }

  inspect_object(o) {
    const def = OBJECTS[o.t];
    const name = o.t.replace(/_/g, ' ');
    const gives = ['wood', 'food', 'stone', 'coal', 'iron', 'gold', 'gems', 'influence'].filter(k => def[k]).map(k => `${def[k][0]}-${def[k][1]} ${k}`);
    const workText = { chop: 'Woodcutters chop this.', gather: 'Gatherers collect this.', mine: 'Miners dig this.', explore: 'Explorers can search these ruins.' }[def.work];
    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(def.sprite, 72)),
        h('div.col', { style: { gap: '2px' } },
          h('div.title', o.t === 'grave' ? 'Grave' : name[0].toUpperCase() + name.slice(1)),
          o.t === 'grave' ? h('div.muted', `Here lies ${o.name || 'a villager'}.`) : null,
          workText ? h('div.faint', workText) : null)),
      gives.length ? h('div.row', { style: { flexWrap: 'wrap' } }, gives.map(x => h('span.chip', x))) : null,
      def.charges ? h('div.faint', `Uses left: ${o.charges}/${def.charges}`) : null,
      def.growsInto ? h('div.faint', `Growing into ${def.growsInto.replace(/_/g, ' ')}…`) : null,
    ];
  }

  // ------------------------------------------------------------ feedback
  // ---- notifications: important happenings, click to jump there
  notifications() {
    return this.game.state.log.filter(e => ['event', 'bad', 'death', 'birth', 'good'].includes(e.kind)).slice(-60).reverse();
  }

  updateBell() {
    const seen = this.game.state.notifSeen || 0;
    const unread = this.game.state.log.filter(e => e.t > seen && ['event', 'bad', 'death'].includes(e.kind)).length;
    if (this._unread === unread) return;
    this._unread = unread;
    this.els.bellCount.textContent = unread > 99 ? '99+' : String(unread);
    this.els.bellCount.hidden = !unread;
  }

  jumpTo(pos) {
    if (!pos) return;
    this.follow = null;
    this.input.panTo(pos.x, pos.y);
  }

  toggleNotifications() {
    if (this.notifEl) { this.notifEl.remove(); this.notifEl = null; return; }
    const g = this.game;
    g.state.notifSeen = Date.now();
    this._unread = null;
    this.updateBell();
    const list = this.notifications();
    const filters = [['all', 'All'], ['bad', 'Danger'], ['death', 'Deaths'], ['birth', 'Births'], ['good', 'Built']];
    this.notifFilter ??= 'all';
    const body = h('div.notif-list');
    const render = () => {
      const shown = list.filter(e => this.notifFilter === 'all' || e.kind === this.notifFilter);
      body.replaceChildren(...(shown.length ? shown.map(e => h(`button.notif.${e.kind}${e.pos ? '.has-pos' : ''}`, {
        onclick: () => { if (e.pos) { this.jumpTo(e.pos); this.toggleNotifications(); } },
        title: e.pos ? 'Show me where' : '',
      }, h('span.notif-dot'), h('span.notif-text', e.text), h('span.notif-day', `Day ${e.day}`), e.pos ? pxIcon('pin') : null))
        : [h('div.faint', { style: { padding: '12px' } }, 'Nothing here yet.')]));
    };
    const tabs = h('div.notif-tabs', filters.map(([id, label]) => h(`button${this.notifFilter === id ? '.on' : ''}`, { onclick: e => { this.notifFilter = id; for (const b of tabs.children) b.classList.toggle('on', b === e.currentTarget); render(); } }, label)));
    render();
    this.notifEl = h('div.card.notif-panel',
      h('div.row', h('b', 'Notifications'), h('div.spacer'), h('button.btn.icon.ghost', { onclick: () => this.toggleNotifications() }, '✕')),
      tabs, body);
    this.root.append(this.notifEl);
  }

  toast(entry) {
    if (!on('notifications')) return;   // switched off: no bell, no feed
    if (this.panel === 'log') this.requestRefresh();
    this.updateBell();
    // sounds for what just happened
    const sound = { birth: 'birth', death: 'death', bad: 'danger', good: /completed/.test(entry.text) ? 'complete' : null, event: /Ability|—/.test(entry.text) ? 'ability' : 'notify' }[entry.kind];
    if (sound) play(sound);
    if (!['event', 'bad', 'death'].includes(entry.kind)) return;
    const el = h(`div.toast.${entry.kind || 'info'}${entry.pos ? '.has-pos' : ''}`, { onclick: () => this.jumpTo(entry.pos) }, entry.text);
    this.els.feed.append(el);
    while (this.els.feed.children.length > 6) this.els.feed.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 6000);
    setTimeout(() => el.remove(), 6700);
  }

  float(text) { if (text) this.toast({ text, kind: 'event' }); }

  /** A banner that stays while cloud saving is failing (null clears it). */
  setSaveProblem(text) {
    if (!text) { this.saveBanner?.remove(); this.saveBanner = null; return; }
    if (this.saveBanner?.dataset.text === text) return;
    this.saveBanner?.remove();
    this.saveBanner = h('div.save-banner', { 'data-text': text }, pxIcon('warning'), h('span', text),
      h('button.btn.sm', { onclick: () => this.onSave?.().then(() => this.hint('Saved to the cloud', 1500)).catch(() => {}) }, 'Retry'));
    this.root.append(this.saveBanner);
  }

  /** Entering a new biome: its name slides in, in its own colour. */
  biomeBanner(key) {
    const t = THEMES[key];
    if (!t) return;
    this.root.querySelector('.biome-banner')?.remove();
    const el = h('div.biome-banner', { style: { '--biome': t.color } }, icon(t.icon, 28), h('div', h('b', t.name), h('span', t.desc)));
    this.root.append(el);
    setTimeout(() => el.remove(), 3600);
  }

  announce(text) {
    // one banner at a time: the rest wait their turn (and repeats are dropped)
    this._announceQ ||= [];
    if (this._announceQ.includes(text)) return;
    this._announceQ.push(text);
    if (this._announcing) return;
    const next = () => {
      const t = this._announceQ.shift();
      if (t == null) { this._announcing = false; return; }
      this._announcing = true;
      const el = h('div.announce', h('div', t));
      this.root.append(el);
      setTimeout(() => el.remove(), 3000);
      setTimeout(next, this._announceQ.length ? 2400 : 3000);
    };
    next();
  }

  showEvent(ev) {
    const g = this.game;
    const content = h('div.col', { style: { gap: '14px' } });
    const m = modal(content, { cls: 'event-modal' });
    const render = (result) => {
      content.replaceChildren(
        h('div.event-art', icon(ev.icon, 90)),
        h('h2', ev.title),
        h('div.event-text', result ? result : ev.text));
      if (result) {
        content.append(h('button.btn.primary', { onclick: () => m.close() }, 'Continue'));
        return;
      }
      for (let i = 0; i < ev.choices.length; i++) {
        const c = ev.choices[i];
        const afford = g.canAfford(c.cost);
        content.append(h('button.choice', {
          disabled: !afford,
          onclick: () => {
            const r = g.chooseEvent(i);
            if (r?.error) { this.hint(r.error, 1500); return; }
            render(r?.text || 'So it was done.');
          },
        },
        h('span.label', c.label),
        c.cost ? costChips(c.cost, g.state.resources) : null,
        c.karma ? h(`span.chip.${c.karma > 0 ? 'good' : 'evil'}`, icon(c.karma > 0 ? 'items/karma_good' : 'items/karma_evil', 16), `${c.karma > 0 ? '+' : ''}${c.karma}`) : null));
      }
    };
    render(null);
  }

  spyModal(p) {
    const g = this.game;
    const mp = this.mp;
    const spies = mp.availableSpies();
    const best = spies.sort((a, b) => b.skills.stealth - a.skills.stealth)[0];
    const odds = best ? Math.round(Math.max(5, Math.min(90, (0.4 + best.skills.stealth * 0.06 - (p.counterIntel ?? 0.1)) * 100))) : 0;
    const err = h('div.error-text');
    const MISSIONS = [
      ['infiltrate', 'Infiltrate in person', 'Take control of your spy when they arrive: walk their land disguised as a traveller and choose what to sabotage, rob or who to kill. Better odds, unless guards are watching.'],
      ['scout', '👁 Scout', 'Count their soldiers, gold and food.'],
      ['steal', '💰 Steal', 'Take a quarter of their gold.'],
      ['sabotage', '💣 Sabotage', 'Burn one of their buildings (uses 1 bomb).'],
      ['incite', '🗡 Incite treason', 'Turn one of their unhappy villagers into a traitor.'],
      ['assassinate', '☠ Assassinate', 'Kill their heir or one of their officials.'],
    ];
    const go = async mission => {
      err.textContent = '';
      try { await mp.launchMission(p.uid, mission); m.close(); this.announce(mission === 'missile' || mission === 'orbital' ? '☢ Launched!' : '🕵 Your agent sets out'); }
      catch (e) { err.textContent = e.message; }
    };
    const m = modal([
      h('div', { style: { textAlign: 'center' } }, icon('units/spy', 72)),
      h('h2', { style: { textAlign: 'center' } }, `Covert operations against ${p.villageName}`),
      best
        ? h('div.muted', `Your best spy is ${best.name} (stealth ${Math.floor(best.skills.stealth)}). Estimated success: ~${odds}%. A failed spy may be caught and executed.`)
        : h('div.error-text', 'No trained spies at home. Build a Spy Den and give someone the Spy job.'),
      ...MISSIONS.map(([id, label, desc]) => h('button.choice', { disabled: !best, onclick: () => go(id) }, h('span.label', label), h('span.faint', desc))),
      hasMissiles(g) ? h('button.choice', { onclick: () => { m.close(); this.aimStrike(p, false); } }, h('span.label', '☢ Aim a missile'), h('span.faint', 'Pick exactly where it lands: it wrecks every building and person in the blast. −25 karma.'), costChips(MISSILE_COST, g.state.resources)) : null,
      hasOrbital(g) ? h('button.choice', { onclick: () => { m.close(); this.aimStrike(p, true); } }, h('span.label', '🛰 Aim an orbital strike'), h('span.faint', 'A bigger blast from orbit, wherever you choose. −35 karma.'), costChips(MISSILE_COST, g.state.resources)) : null,
      err,

    ].filter(Boolean), { closeX: true });
  }

  showProfile(p) {
    const me = p.uid === this.user.uid;
    openProfile(p.uid, {
      onSpy: !me && this.mp && on('spies') ? () => this.spyModal(p) : null,
      user: this.user, username: this.username, world: this.world, village: p.villageName ? p : null,
      onVisit: !me && this.mp ? () => this.askToVisit(p.uid) : null,
      onDeal: !me && this.mp ? () => this.offerModal(p) : null,
      onMarch: !me && this.mp && !this.mp.allies.has(p.uid) ? () => this.raidModal(p) : null,
    });
  }

  // ------------------------------------------------------------ realm map + visiting
  openMap() {
    this.seenMap = true;
    openRealmMap({
      hud: this,
      onVisit: uid => this.askToVisit(uid),
    });
  }

  /** Visiting needs the owner's permission; the answer (or refusal) is shown as a hint. */
  askToVisit(uid) {
    return Promise.resolve().then(() => this.onVisit(uid)).catch(e => { if (!e.shown) this.hint(e.message, 3000); });
  }

  /** A bridge leads to another ruler's land: ask to visit, or intrude with an army or a spy. */
  bridgePrompt(b) {
    this.bridgeBox?.remove();
    const p = this.mp?.players.find(x => x.uid === b.uid) || b;
    const ally = this.mp?.allies.has(b.uid);
    const close = () => { box.remove(); this.bridgeBox = null; };
    const act = fn => () => { close(); fn(); };
    const box = h('div.card.bridge-prompt',
      h('div.row', icon('buildings/castle', 26), h('div',
        h('h3', `Bridge to ${p.villageName || 'another land'}`),
        h('div.faint', `Ruled by ${p.name || 'someone'} · ${p.online ? 'online' : 'offline'} · army ${fmtMinutes(travelMs(this.user.uid, b.uid))} away`)),
        h('div.spacer'), h('button.btn.icon.ghost', { onclick: close, title: 'Close' }, '✕')),
      h('div.muted', ally ? 'You are allies. Ask to cross and look around.' : 'This is their land. Ask permission to visit, or intrude uninvited.'),
      h('div.row',
        h('button.btn.sm.primary', { onclick: act(() => this.askToVisit(b.uid)) }, 'Ask to visit'),
        ally ? null : h('button.btn.sm.danger', { onclick: act(() => this.raidModal(p)) }, 'Invade'),
        on('spies') ? h('button.btn.sm', { onclick: act(() => this.spyModal(p)) }, 'Send a spy') : null,
        h('button.btn.sm', { onclick: act(() => this.openMap()) }, 'World Map')));
    this.bridgeBox = box;
    this.root.append(box);
    play('click');
  }

  /** Someone wants to visit my land: the owner decides. */
  showVisitAsks(asks) {
    for (const a of asks) {
      if (this.visitPrompts?.has(a.uid)) continue;
      (this.visitPrompts ||= new Map());
      play('notify');
      const box = h('div.card.visit-ask',
        avatar(a.name || '?', 34),
        h('div.visit-ask-text', h('b', a.name || 'A ruler'), h('span', ` of ${a.villageName || 'another land'} wants to visit your land.`)),
        h('div.row',
          h('button.btn.sm.primary', { onclick: () => { this.mp.answerVisit(a.uid, true); close(); } }, 'Allow'),
          h('button.btn.sm', { onclick: () => { this.mp.answerVisit(a.uid, false); close(); } }, 'Deny')));
      const close = () => { box.remove(); this.visitPrompts.delete(a.uid); };
      this.visitPrompts.set(a.uid, close);
      this.root.append(box);
      this.game.log(`${a.name || 'A ruler'} asked to visit your land.`, 'event');
    }
    // requests that were withdrawn or timed out
    for (const [uid, close] of [...(this.visitPrompts || [])]) if (!asks.some(a => a.uid === uid)) close();
  }

  setVisiting(profile) {
    this.visiting = profile;
    this.visitBanner?.remove();
    this.select(null);
    this.closePanel();
    if (!profile) return;
    this.visitBanner = h('div.visit-banner',
      avatar(profile.name || '?', 34),
      h('div', h('div.visit-title', profile.spy ? `Infiltrating ${profile.villageName}` : `Visiting ${profile.villageName}`),
        h('div.faint', `Ruled by ${profile.name} · ${ERAS[profile.era || 0]?.name} · 👥 ${profile.pop} · ${fmtMinutes(travelMs(this.user.uid, profile.uid || ''))} from home`)),
      profile.uid && !profile.spy ? h('button.btn.sm', { onclick: () => this.offerModal({ ...profile, uid: profile.uid }) }, '🤝 Deal') : null,
      profile.uid && !profile.spy ? h('button.btn.sm.danger', { onclick: () => this.raidModal({ ...profile, uid: profile.uid }) }, '⚔ March') : null,
      profile.uid && this.mp && !profile.spy && on('spies') ? h('button.btn.sm', { onclick: () => this.spyModal({ ...profile, uid: profile.uid }) }, '🕵 Spy') : null,
      h('button.btn.sm.primary', { onclick: () => this.onReturnHome() }, '🏠 Return home'));
    this.root.append(this.visitBanner);
  }

  // ------------------------------------------------------------ war
  currentThreats() {
    const g = this.game;
    const list = [];
    for (const inc of g.state.incoming) {
      if (inc.warned) list.push({ key: inc.id, name: inc.name, count: inc.count, secs: (inc.arrivesAt - g.state.time) / (g.speed || 1), game: true, ref: inc, kind: 'warband' });
    }
    for (const a of g.mpThreats || []) {
      list.push({ key: a.id, name: `${a.fromVillage}'s army`, count: a.warriors, secs: (a.arrivesAt - Date.now()) / 1000, ref: a, kind: 'player' });
    }
    const battles = Object.entries(g.state.battles || {}).map(([id, b]) => ({
      key: id, name: b.name, battle: true, left: g.state.creatures.filter(c => c.attackId === id).length,
    }));
    return [...list, ...battles];
  }

  updateThreats() {
    const el = this.els.threats;
    if (!on('warbands')) { if (el.childElementCount) el.replaceChildren(); return; }
    const threats = this.currentThreats();
    if (!threats.length) { if (el.childElementCount) el.replaceChildren(); return; }
    const rallied = !!this.game.state.rallied;
    el.replaceChildren(...threats.map(t => h('div.threat',
      icon('items/war', 22),
      t.battle
        ? h('span', h('b', t.name), ` · battle! ${t.left} invader${t.left === 1 ? '' : 's'} left`)
        : h('span', h('b', t.name), ` (${t.count}) arrives in `, h('b.count', fmtClock(Math.max(0, Math.round(t.secs))))),
      t.battle ? null : h('button.btn.sm', { onclick: () => this.showScoutReport({ ...t, seconds: t.secs }) }, 'Orders'))),
    h('button.btn.sm' + (rallied ? '.ghost' : '.danger'), { onclick: () => { if (rallied) standDown(this.game); else rally(this.game); } }, rallied ? 'Stand down' : '⚔ Rally militia'));
  }

  showScoutReport(r) {
    const g = this.game;
    const scouting = scoutSummary(g);
    const cost = tributeCost(g);
    const err = h('div.error-text');
    const warriors = g.state.villagers.filter(v => v.job === 'warrior' && !v.away).length;
    const m = modal([
      h('div.event-art', icon('characters/hunter', 90)),
      h('h2', "Scout's Report"),
      h('div.event-text', `Your Majesty! ${r.name} marches on ${g.state.owner.villageName} with about ${r.count} soldiers. They will be here in ${fmtClock(Math.max(0, Math.round(r.seconds)))}.`),
      h('div.row', { style: { justifyContent: 'center', flexWrap: 'wrap' } },
        h('span.chip', icon('characters/hunter', 16), `${scouting.scouts} scouts`),
        h('span.chip', icon('buildings/watchtower', 16), `${scouting.towers} watchtowers`),
        h('span.chip', `👁 ${Math.round(scouting.chance * 100)}% spot chance`),
        h('span.chip', icon('items/sword', 16), `${warriors} warriors`)),
      h('button.choice', { disabled: !!g.state.rallied, onclick: () => { rally(g); m.close(); } },
        h('span.label', g.state.rallied ? 'The militia is already rallied' : '⚔ Rally the militia — every able adult takes up arms')),
      h('button.choice', {
        onclick: async () => {
          try {
            if (r.kind === 'player') await this.mp.payTribute(r.ref);
            else { const res = payWarbandTribute(g, r.ref); if (res.error) throw new Error(res.error); }
            m.close();
          } catch (e) { err.textContent = e.message; }
        },
      }, h('span.label', '💰 Pay tribute so they turn back'), costChips(cost)),
      h('button.choice', { onclick: () => m.close() }, h('span.label', '🛡 Brace ourselves')),
      err,
      h('div.faint', { style: { textAlign: 'center' } }, 'Scouts (People → Jobs) and Watchtowers raise the chance of spotting armies early. Without them, attacks come as a surprise.'),
    ], { cls: 'event-modal' });
  }

  // ------------------------------------------------------------ minimap
  drawMinimapBase() {
    const w = this.game.world;
    const ctx = this.mini.getContext('2d');
    const img = ctx.createImageData(w.w, w.h);
    for (let i = 0; i < w.tiles.length; i++) {
      const hex = MINI_COLORS[w.tiles[i]] || '#000';
      const n = parseInt(hex.slice(1), 16);
      img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    this.miniBase = document.createElement('canvas');
    this.miniBase.width = w.w; this.miniBase.height = w.h;
    this.miniBase.getContext('2d').putImageData(img, 0, 0);
    this.miniVersion = w.version;
  }

  drawMinimapDots() {
    const g = this.game;
    if (this.miniVersion !== g.world.version) this.drawMinimapBase();
    const ctx = this.mini.getContext('2d');
    const mk = MINI_SCALE * (MAP_W / g.world.w);
    ctx.setTransform(mk, 0, 0, mk, 0, 0);
    // the renderer's smooth terrain overview looks far nicer than flat pixels once it exists
    const terrain = this.renderer.terrain;
    const overview = terrain?.world === g.world && terrain.version === g.world.version ? terrain.overview : null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(overview || this.miniBase, 0, 0, g.world.w, g.world.h);
    ctx.fillStyle = 'rgba(28,70,26,0.55)';
    for (const o of g.state.objects) if (o.t.startsWith('tree_') && o.t !== 'tree_stump') ctx.fillRect(o.x + 0.2, o.y + 0.2, 0.6, 0.6);
    ctx.fillStyle = '#ffae3d';
    for (const b of g.state.buildings) { const s = sizeOf(b); ctx.fillRect(b.tx, b.ty, s, s); }
    ctx.fillStyle = '#ffffff';
    for (const v of g.state.villagers) if (!v.away) ctx.fillRect(Math.floor(v.x / TILE), Math.floor(v.y / TILE), 1, 1);
    // what you look for: home, crafting tables, the dungeon cave and bounties
    const mark = (x, y, color, r) => { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r + 0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    if (g.state.center) mark(g.state.center.x / TILE, g.state.center.y / TILE, '#ffd76a', 2.2);
    for (const b of g.state.buildings) if (b.type === 'crafting_table') mark(b.tx + 0.5, b.ty + 0.5, '#c08a5a', 1.6);
    for (const e of g.state.dungeons || []) mark(e.x / TILE, e.y / TILE, '#b06aff', 2.4);
    for (const c of g.state.creatures) if (c.bounty) mark(c.x / TILE, c.y / TILE, '#ffcf3a', 2);
    // enemies: red dots, bigger and pulsing for armies and bosses
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 160);
    for (const c of g.state.creatures) {
      if (!CREATURES[c.t]?.hostile) continue;
      const army = c.raid || c.attackId;
      const r = (CREATURES[c.t].boss ? 2.6 : army ? 1.8 : 1.2) * (army ? pulse : 1);
      ctx.fillStyle = army ? '#ff2a1f' : '#ff6b5b';
      ctx.beginPath(); ctx.arc(c.x / TILE, c.y / TILE, r, 0, Math.PI * 2); ctx.fill();
    }
    const cam = this.renderer.camera;
    const vw = window.innerWidth / cam.zoom / TILE, vh = window.innerHeight / cam.zoom / TILE;
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5 / MINI_SCALE;
    ctx.strokeRect(cam.x / TILE - vw / 2, cam.y / TILE - vh / 2, vw, vh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ------------------------------------------------------------ homes
  /** Through the door: the isometric house view. */
  enterHouse(b) {
    if (this.houseEditor || this.visiting || this.dungeon) return;
    const g = this.game;
    const hero = heroOf(g);
    this.input.keys?.clear?.();
    Object.assign(this.leadInput, { mx: 0, my: 0, act: false, dash: false, block: false });
    if (g.hero) g.hero.inHouse = true;   // safe while inside
    this.houseEditor = new HouseEditor({
      game: g, building: b, hero, hint: (t, ms) => this.hint(t, ms),
      onCraft: () => { this.craftCat = this.craftCat || 'tools'; this.openPanel('craft'); },
      onEnchant: () => openEnchantMenu(this),
      onClose: () => {
        this.houseEditor = null;
        if (g.hero) g.hero.inHouse = false;
        if (this.panel === 'craft') this.closePanel();
        const v = heroOf(g);
        if (v) { const d = doorOf(g, b); v.x = d.x; v.y = d.y + 10; if (g.hero) g.hero.doorCd = 1.5; }
        this.requestRefresh();
      },
    });
    this.root.classList.add('in-house');
    const off = () => { if (!this.houseEditor) { this.root.classList.remove('in-house'); clearInterval(t); } };
    const t = setInterval(off, 300);
    play('ability');
  }

  // ------------------------------------------------------------ dungeons
  /** Down the cave mouth (or the stairs to a deeper floor). */
  enterDungeon(entrance, depth = 1) {
    if (this.visiting || this.game.sail) return;
    // going down closes whatever covers the screen: the house view, panels and windows
    if (this.houseEditor && !entrance) this.houseEditor.close();
    if (!entrance) { this.closePanel?.(); document.querySelectorAll('.modal-bg').forEach(m => m.remove()); }
    if (entrance && this.dungeon) return;   // already below (a second strike at the cave mouth)
    const prev = this.dungeon;
    const dg = makeDungeonGame(this.game, { depth, entrance: entrance || prev?.dungeon.entrance });
    if (prev) {   // carry your hero's wounds down the stairs
      const was = heroOf(prev), now = heroOf(dg);
      if (was && now) now.hp = was.hp;
      Object.assign(dg.hero, { kills: prev.hero?.kills || 0, finds: prev.hero?.finds || 0 });
    } else leaveSurface(this.game, dg);
    this.dungeon = dg;
    this._dungeonKey = null;
    this.root.classList.add('in-dungeon');
    this.onDungeon?.(dg);
    const v = heroOf(dg);
    if (v) Object.assign(this.renderer.camera, { x: v.x, y: v.y, zoom: Math.max(2.2, this.renderer.camera.zoom) });
    this.announce(depth === 1 ? 'You enter the dungeon' : `Floor ${depth}`);
    if (depth === 1) this.hint('Find the key to open the boss door, beware the spikes, and slay the boss. The stairs you came down lead home.', 8000);
    play('ability');
  }

  leaveDungeon({ knockedOut = false } = {}) {
    const dg = this.dungeon;
    if (!dg) return;
    this.dungeon = null;
    this._dungeonKey = null;
    this.root.classList.remove('in-dungeon');
    returnFromDungeon(this.game, dg, { knockedOut });
    this.onDungeon?.(null);
    const v = heroOf(this.game);
    if (v) Object.assign(this.renderer.camera, { x: v.x, y: v.y });
    if (knockedOut) { this.announce('You were knocked out!'); this.hint('You were carried out of the dungeon and woke up at home.', 5000); }
    else this.announce('Back in the daylight');
  }

  tickDungeon() {
    const dg = this.dungeon, d = dg.dungeon;
    const home = this.game.state.villagers.find(x => x.id === d.homeHeroId);
    if (home?.away) home.away.until = Date.now() + 120_000;   // still below (if the page closes, they come home by themselves)
    const ev = d.event;
    if (!ev) return;
    d.event = null;
    if (ev === 'knockout') this.leaveDungeon({ knockedOut: true });
    else if (ev === 'exit') this.leaveDungeon();
    else if (ev === 'down') this.enterDungeon(null, d.depth + 1);
  }

  /** The dungeon map: explored tiles, you, the key, the boss door, the stairs and chests you have seen. */
  drawDungeonMap() {
    const dg = this.dungeon, cv = this.els.dungeonMap;
    if (!dg || !cv?.isConnected) return;
    const d = dg.dungeon, w = dg.world, ctx = cv.getContext('2d');
    const s = cv.width / w.w;
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, cv.width, cv.height);
    const seen = i => d.seen?.[i];
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const i = y * w.w + x;
      if (!seen(i)) continue;
      const wall = w.tiles[i] === 0;
      const inBoss = x >= d.boss.x && x < d.boss.x + d.boss.w && y >= d.boss.y && y < d.boss.y + d.boss.h;
      ctx.fillStyle = wall ? '#2a2433' : inBoss ? '#5a2a30' : '#8a8494';
      ctx.fillRect(x * s, y * s, s + 0.2, s + 0.2);
    }
    const dot = (p, color, r = 2.2) => { if (!p) return; const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE); if (!seen(ty * w.w + tx)) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc((tx + 0.5) * s, (ty + 0.5) * s, r, 0, Math.PI * 2); ctx.fill(); };
    if (!d.open) for (const p of d.doors) if (seen(p.y * w.w + p.x)) { ctx.fillStyle = '#ffcf5a'; ctx.fillRect(p.x * s, p.y * s, s + 0.2, s + 0.2); }
    dot(d.exit, '#6fe07a', 3);
    dot(d.stairsDown, '#ffcf5a', 3);
    dot(d.key, '#ffe04a', 2.5);
    for (const c of dg.state.chests || []) dot(c, '#c08a4a', 2);
    const boss = bossOf(dg);
    if (boss) dot(boss, '#ff4a4a', 3);
    const v = heroOf(dg);
    if (v && Math.floor(performance.now() / 300) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(v.x / TILE * s, v.y / TILE * s, 3, 0, Math.PI * 2); ctx.fill(); }
  }

  /** Floor, key and boss health while you are below. */
  updateDungeonCard() {
    const dg = this.dungeon;
    if (!dg) { this.els.dungeonCard?.remove(); this.els.dungeonCard = null; return; }
    const d = dg.dungeon, boss = bossOf(dg);
    const key = [d.depth, d.hasKey, d.open, d.cleared].join('|');
    if (key === this._dungeonKey && this.els.dungeonCard) return;
    this._dungeonKey = key;
    this.els.dungeonMap = h('canvas.dungeon-map', { width: 128, height: 128, title: 'Dungeon map (tap to enlarge)', onclick: e => e.currentTarget.classList.toggle('big') });
    const card = h('div.card.dungeon-card',
      h('div.dungeon-title', `Dungeon · Floor ${d.depth}`),
      h('div.dungeon-row',
        h('span.dungeon-key' + (d.hasKey ? '.got' : ''), icon('gear/key', 18), d.open ? 'Door open' : d.hasKey ? 'Key found' : 'Find the key'),
        d.cleared ? h('span.faint', 'Stairs down are open') : null),
      this.els.dungeonMap,
      h('button.btn.sm', { onclick: () => this.leaveDungeon() }, 'Leave dungeon'));
    this._mapDrawnAt = 0;
    if (this.els.dungeonCard) this.els.dungeonCard.replaceWith(card); else this.root.append(card);
    this.els.dungeonCard = card;
  }

  // ------------------------------------------------------------ boss health bar
  /** A big health bar at the top of the screen while a boss (or a bounty) is close to you. */
  updateBossBar(g, dt) {
    const v = heroOf(g);
    let boss = null, bd = TILE * 14;
    // only real bosses get the big bar, and never over an open panel or window (it would cover their close buttons)
    if (v && !this.houseEditor && !this.panel && !document.querySelector('.modal-bg')) {
      for (const c of g.state.creatures) {
        const def = CREATURES[c.t];
        if (!def?.boss && !c.dungeonBoss) continue;
        const d = Math.hypot(c.x - v.x, c.y - v.y);
        if (d < bd || (c === this._boss && d < TILE * 22)) { bd = d; boss = c; }
      }
    }
    let el = this.els.bossBar;
    if (!boss) {
      if (el && !el.classList.contains('leaving')) { el.classList.add('leaving'); setTimeout(() => { if (this.els.bossBar === el && el.classList.contains('leaving')) { el.remove(); this.els.bossBar = null; } }, 400); }
      this._boss = null;
      return;
    }
    const max = Math.max(maxHp(boss), boss.hp ?? 0), hp = Math.max(0, boss.hp ?? max), pct = hp / max;
    if (boss !== this._boss || !el) {
      this._boss = boss;
      this._bossTrail = pct;
      this._bossLastHp = hp;
      el?.remove();
      const def = CREATURES[boss.t];
      const art = !spriteAvailable(def.sprite) && def.fallback ? def.fallback.sprite : def.sprite;
      const name = boss.bounty?.name || BOSS_NAMES[boss.t] || `${boss.elite ? 'Elite ' : ''}${boss.t.replace(/_/g, ' ').replace(/(^|\s)\w/g, m => m.toUpperCase())}`;
      const title = boss.bounty ? `Bounty · ${boss.bounty.gold} gold` : boss.dungeonBoss && this.dungeon ? `Guardian of Floor ${this.dungeon.dungeon.depth}` : boss.elite ? 'Elite' : def.boss ? 'Boss' : 'Strong foe';
      el = this.els.bossBar = h('div.boss-bar',
        h('div.boss-portrait', icon(art, 44)),
        h('div.boss-main',
          h('div.boss-names', h('span.boss-name', name), h('span.boss-title', title)),
          h('div.boss-track',
            h('div.boss-trail'), h('div.boss-fill'), h('div.boss-shine'),
            h('div.boss-ticks', ...Array.from({ length: 9 }, () => h('i'))),
            h('span.boss-hp'))));
      this.root.append(el);
    }
    el.classList.remove('leaving');
    // the red bar drops at once; the pale "damage" bar behind it catches up a moment later
    if (hp < this._bossLastHp - 0.01) {
      this._bossHitAt = performance.now();
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    }
    this._bossLastHp = hp;
    if (performance.now() - (this._bossHitAt || 0) > 450) this._bossTrail += (pct - this._bossTrail) * Math.min(1, dt * 3.5);
    this._bossTrail = Math.max(this._bossTrail, pct);
    el.querySelector('.boss-fill').style.width = `${pct * 100}%`;
    el.querySelector('.boss-trail').style.width = `${this._bossTrail * 100}%`;
    el.querySelector('.boss-shine').style.width = `${pct * 100}%`;
    el.querySelector('.boss-hp').textContent = `${Math.ceil(hp)} / ${max}`;
    el.classList.toggle('enraged', pct <= 0.3);
  }

  destroy() {
    window.removeEventListener('popstate', this.onBack);
    clearInterval(this.missionTimer);
    this.els.bossBar?.remove();
    this.houseEditor?.close();
    this.houseEditor = null;
    this.tutorial?.destroy();
    this.root.replaceChildren();
  }
}

/** Pack items minus the one of each that is equipped in a slot. */
function packExtras(pack, eq) {
  const used = new Set([eq.tool, eq.weapon, eq.armor].filter(x => x && !x.issued).map(x => x.key));
  return Object.entries(pack).map(([k, n]) => [k, n - (used.has(k) ? 1 : 0)]).filter(([, n]) => n > 0);
}

/** Real waiting time: 45s, 7m 26s, 1h 5m. */
function fmtWait(secs) {
  secs = Math.max(0, Math.ceil(secs));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtClock(secs) {
  secs = Math.round(secs);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export { RESOURCES };
