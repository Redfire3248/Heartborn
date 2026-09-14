import { h, icon, avatar, RES_ICON, costChips, bar, clear, modal, confirmModal, fmt, timeAgo } from './dom.js';
import { iconUrl } from '../core/assets.js';
import { TILE, ADULT_AGE, MAP_W, MAP_H, RESOURCES, DAY_LENGTH } from '../core/constants.js';
import { BUILDINGS, ERAS, CATEGORIES } from '../data/buildings.js';
import { OFFICES, officeUnlocked, officialOf, appoint, dismiss, setOfficeOption } from '../game/court.js';
import { OBJECTS, CREATURES, villagerSprite } from '../data/objects.js';
import { TRAITS } from '../data/traits.js';
import { JOBS, assignJob, displayRole } from '../game/villagers.js';
import { DEEDS, runDeed, sacrificeVillager, exileVillager, smiteCreature } from '../game/deeds.js';
import { maxHp } from '../game/creatures.js';
import { rulerOf, rulerTypeOf, rulerTitle, setHeir, setCalling, encourage, ENCOURAGE, inventory, equipment, isTrained, crown, addItem, takeItem } from '../game/dynasty.js';
import { CALLINGS, RULER_TYPES, ITEMS } from '../data/people.js';
import { accuse, punishTraitor, throwBomb, counterIntel, isSpy, hasMissiles, hasOrbital, MISSILE_COST } from '../game/intrigue.js';
import { LAW_CATEGORIES, DEFAULT_LAWS, LAW_COST, describeEffects } from '../data/laws.js';
import { rally, standDown, tributeCost, payWarbandTribute, scoutSummary } from '../game/war.js';
import { leaderboard } from '../net/save.js';
import { fmtRes, travelMs, fmtMinutes, realmPos } from '../net/multiplayer.js';
import { openRealmMap } from './realmMap.js';
import { describeBuilding, effectBadges } from '../data/describe.js';
import { Tutorial } from './tutorial.js';
import { abilityOf, abilityCooldown, canUseAbility, useAbility } from '../game/abilities.js';
import { hasOffice, employmentOf, setTarget, applyNow, applyPreset, moveWorkers, autoPick, bestForOffice, STAFFABLE, JOB_SKILL } from '../game/employment.js';
import { empireOf, empirePower, empireTitle, empireAction, ACTIONS as EMPIRE_ACTIONS, PERSONALITIES, STATUS } from '../game/empire.js';
import { openProfile, friendsPanel } from './social.js';
import { installButton } from './screens.js';
import { startItemDrag } from './itemDrag.js';
import { BUILD, LATEST_CHANGES, checkLatest } from '../core/version.js';

const TOP_RES = ['food', 'wood', 'stone', 'iron', 'weapons', 'bombs', 'gold', 'gems', 'science', 'influence'];
// bombs and science only appear once they matter
const SHOW_WHEN = { bombs: g => g.state.resources.bombs > 0 || g.hasBuilding('powder_mill'), science: g => g.state.resources.science > 0 || g.state.era >= 3 };
const TASK_TEXT = {
  wander: 'Wandering', patrol: 'On patrol', flee: 'Fleeing!', fight: 'Fighting!', hunt: 'Hunting', eat: 'Eating',
  spytrain: 'Learning the spy trade', train: 'Drilling for war', craft: 'Forging weapons', rest: 'Sleeping', heal: 'Being healed', build: 'Building', chop: 'Chopping wood', mine: 'Mining', gather: 'Gathering',
  deepmine: 'Mining deep', farm: 'Farming', fish: 'Fishing', explore: 'Exploring the wilds',
};
const MINI_COLORS = ['#1d4e89', '#3a9ad9', '#e3cd8c', '#5c9e3c', '#66a843', '#8a5a36', '#44613a', '#55535a', '#eef4fa', '#e5561e', '#8c8c8c', '#6b4526'];

const MINI_SCALE = 4;   // minimap canvas pixels per tile

const DOCK_GROUPS = [
  { id: 'build', icon: 'items/hammer', tip: 'Build (B)', tabs: [['build', 'Build']] },
  { id: 'people', icon: 'items/population', tip: 'People & Court (J)', tabs: [['jobs', '👥 People & Jobs'], ['court', '👑 Court']] },
  { id: 'rule', icon: 'items/scroll', tip: 'Rule, Empire & Chronicle (K)', tabs: [['deeds', '📜 Laws'], ['empire', '👑 Empire'], ['log', '📖 Chronicle']] },
  { id: 'realm', icon: 'buildings/castle', tip: 'Realm & Multiplayer (M)', tabs: [['world', '🌍 World'], ['ranks', '🏆 Rankings']], alias: ['map'], map: true },
  null,
  { id: 'settings', icon: 'items/save', tip: 'Save & Settings', tabs: [['settings', 'Settings']] },
];
const groupOf = id => DOCK_GROUPS.find(g => g?.tabs.some(t => t[0] === id));

export class HUD {
  constructor({ game, renderer, input, mp, user, isAdmin, onSave, onSignOut, onRestart, onVisit, onReturnHome, world, username, onSwitchWorld }) {
    Object.assign(this, { game, renderer, input, mp, user, isAdmin, onSave, onSignOut, onRestart, onVisit, onReturnHome, world, username, onSwitchWorld });
    this.root = document.getElementById('ui');
    this.panel = null;
    this.buildType = null;
    this.follow = null;
    this.lastSavedAt = 0;
    this.prevRes = {};
    this.tickTimer = 0;
    this.els = {};
    this.build();

    game.on('log', e => this.toast(e));
    game.on('announce', t => this.announce(t));
    game.on('event', ev => this.showEvent(ev));
    game.on('change', () => this.requestRefresh());
    game.on('scoutReport', r => this.showScoutReport(r));
    if (mp) {
      mp.on('chat', () => this.panel === 'world' && this.worldTab === 'chat' && this.refreshPanel());
      mp.on('players', () => this.panel === 'world' && this.worldTab === 'players' && this.refreshPanel());
      mp.on('armies', () => this.panel === 'world' && this.worldTab === 'players' && this.refreshPanel());
      this.missionTimer = setInterval(() => { if (this.panel === 'world' && this.worldTab === 'players' && (mp.missions().length || mp.armies().length) && !this.panelEl?.matches(':hover')) this.refreshPanel(); }, 1000);
      mp.on('inbox', () => { this.updateBadges(); if (this.panel === 'world' && this.worldTab === 'offers') this.refreshPanel(); });
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
    this.els.pop = h('span.v', '3');
    this.els.housing = h('span.cap', '');
    resCard.prepend(h('div.res', { title: 'Population / housing' }, icon('items/population', 24), h('div', this.els.pop, this.els.housing)));

    this.els.karmaDot = h('i');
    this.els.karmaTitle = h('div.karma-title', 'Neutral');
    this.els.era = h('span.era-badge', ERAS[0].name);
    this.els.shield = h('span.shield-badge');
    const karmaCard = h('div.card',
      h('div.col', { style: { gap: '2px', alignItems: 'center' } },
        h('div.karma', { title: 'Karma — good deeds bring luck and happiness; evil brings power and curses' },
          icon('items/karma_evil', 22), h('div.karma-track', this.els.karmaDot), icon('items/karma_good', 22)),
        h('div.row', { style: { gap: '6px' } }, this.els.karmaTitle, this.els.era, this.els.shield)));

    this.els.day = h('div.day', 'Day 1');
    this.els.season = h('div.season', 'Spring · Year 1');
    const clockCard = h('div.card', h('div.clock', this.els.day, this.els.season));
    this.root.append(h('div.topbar', resCard), h('div.statusbar', karmaCard, clockCard));

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
      }, icon(grp.icon, 34), h('span.tip', grp.tip));
      for (const id of [...ids, ...(grp.alias || [])]) this.els.dock[id] = btn;
      dock.append(btn);
    }
    this.root.append(dock);

    this.els.feed = h('div.feed');
    this.root.append(this.els.feed);

    // minimap
    this.mini = h('canvas', { width: MAP_W * MINI_SCALE, height: MAP_H * MINI_SCALE });
    this.mini.addEventListener('pointerdown', e => {
      const r = this.mini.getBoundingClientRect();
      this.follow = null;
      this.input.panTo(((e.clientX - r.left) / r.width) * MAP_W * TILE, ((e.clientY - r.top) / r.height) * MAP_H * TILE);
    });
    this.root.append(h('div.card.minimap', this.mini));
    this.drawMinimapBase();

    this.els.threats = h('div.threats');
    this.root.append(this.els.threats);
    this.tutorial = new Tutorial(this);

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
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;
    this.tickTimer = 0.25;

    const s = g.state;
    for (const k of TOP_RES) {
      const { el, v, cap } = this.els.res[k];
      if (SHOW_WHEN[k]) el.hidden = !SHOW_WHEN[k](g);
      const val = Math.floor(s.resources[k] || 0);
      v.textContent = fmt(val);
      const c = g.caps[k];
      cap.textContent = c ? `/${fmt(c)}` : '';
      el.classList.toggle('full', !!c && val >= c);
      const prev = this.prevRes[k];
      if (prev != null && val !== prev) {
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(val > prev ? 'flash-up' : 'flash-down');
      }
      this.prevRes[k] = val;
    }
    this.els.pop.textContent = s.villagers.length;
    this.els.housing.textContent = `/${g.housing}`;
    this.els.karmaDot.style.left = `${(s.karma + 100) / 2}%`;
    this.els.karmaTitle.textContent = `${g.karmaTitle} (${Math.round(s.karma)})`;
    this.els.era.textContent = ERAS[s.era].name;
    const shieldH = Math.ceil(((s.shieldUntil || 0) - Date.now()) / 3600000);
    this.els.shield.textContent = shieldH > 0 ? `🛡 ${shieldH}h` : '';
    const hour = Math.floor(g.hour);
    this.els.day.textContent = `Day ${g.day + 1} · ${String(hour).padStart(2, '0')}:00 ${g.isNight ? '🌙' : '☀'}`;
    this.els.season.textContent = `${g.season} · Year ${g.year}`;

    this.updateInspector();
    this.updateThreats();
    this.drawMinimapDots();
    if (this.panel === 'jobs' || this.panel === 'deeds' || this.panel === 'build') this.softRefresh();
    if (this.panel === 'court') {
      const key = JSON.stringify([s.court, s.ruler, s.villagers.map(v => v.id + v.job + (v.office || '') + v.traits.length).join(), g.builtBuildings().length]);
      if (key !== this.courtKey && !this.panelEl?.contains(document.activeElement)) { this.courtKey = key; this.refreshPanel(); }
    }
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'v') { this.openMap(); return; }
    if (k === 'escape' && this.visiting) { this.onReturnHome(); return; }
    if (k === 'escape') { if (this.demolishMode) this.toggleDemolish(false); else if (this.buildType) this.cancelBuild(); else if (this.game.selected) this.select(null); else this.closePanel(); }
    else if (k === 'x') this.toggleDemolish();
    else if (k === 'r' && this.lastBuild) { if (this.game.canAfford(BUILDINGS[this.lastBuild].cost)) this.startBuild(this.lastBuild); else this.hint(`Not enough resources for another ${BUILDINGS[this.lastBuild].name}`, 1500); }
    else if (k === '/') { e.preventDefault?.(); this.buildSearchFocused = true; if (this.panel === 'build') this.panelEl?.querySelector('.build-search')?.focus(); else this.openPanel('build'); }
    else if (k === 'b') this.togglePanel('build');
    else if (k === 'j') this.togglePanel('jobs');
    else if (k === 'c') this.togglePanel('court');
    else if (k === 'k') this.togglePanel('deeds');
    else if (k === 'l') this.togglePanel('log');
    else if (k === 'm') this.togglePanel('world');
    else if (k === 'h') { this.follow = null; this.input.panTo(this.game.center.x, this.game.center.y); }
  }

  // ------------------------------------------------------------ world interaction
  onHover(tx, ty) {
    this.renderer.hoverTile = { tx, ty };
    if (this.buildType && !this.placeDrag) {
      const size = BUILDINGS[this.buildType].size;
      const ax = tx - Math.floor((size - 1) / 2), ay = ty - Math.floor((size - 1) / 2);
      this.renderer.ghost = { type: this.buildType, tx: ax, ty: ay, ok: this.game.canPlace(this.buildType, ax, ay).ok };
    }
  }

  onClick(w, tx, ty, shift) {
    const g = this.game;
    if (this.buildType) {
      const gh = this.renderer.ghost;
      if (!gh) return;
      const res = g.placeBuilding(this.buildType, gh.tx, gh.ty);
      if (!res.ok) { this.hint(res.why, 1800); return; }
      // walls and gates stay in placement mode so you can draw lines of them
      if (!shift && !this.buildType.startsWith('wall') && !this.buildType.startsWith('gate')) this.cancelBuild();
      return;
    }
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

  // ---- demolish tool (X): click a building or drag a box over many
  toggleDemolish(on = !this.demolishMode) {
    if (on) { this.cancelBuild(); this.select(null); }
    this.demolishMode = on;
    this.demolishDrag = null;
    this.renderer.ghost = null;
    this.planTip?.remove();
    if (on) this.hint('🗑 Demolish — click a building or drag a box over many · X / Esc / right-click to stop');
    else this.hintEl?.remove();
  }

  buildingsInBox(a, b) {
    const x0 = Math.min(a.tx, b.tx), x1 = Math.max(a.tx, b.tx), y0 = Math.min(a.ty, b.ty), y1 = Math.max(a.ty, b.ty);
    return this.game.state.buildings.filter(bd => {
      const s = BUILDINGS[bd.type].size;
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
    for (const b of list) if (this.game.state.buildings.includes(b)) this.game.demolish(b);
    if (this.game.selected?.kind === 'building' && !this.game.state.buildings.includes(this.game.selected.ref)) this.select(null);
    this.hint(`Demolished ${list.length} building${list.length === 1 ? '' : 's'}`, 1600);
  }

  onPlaceStart(tx, ty) {
    if (this.demolishMode) { this.demolishDrag = { start: { tx, ty } }; this.demolishPreview(tx, ty); return; }
    if (!this.buildType) return;
    const start = this.anchorOf(this.buildType, tx, ty);
    this.placeDrag = { start };
    this.onPlaceMove(tx, ty);
  }

  onPlaceMove(tx, ty) {
    if (this.demolishMode) { if (this.demolishDrag) this.demolishPreview(tx, ty); return; }
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
    for (const sp of spots) {
      if (!this.game.canAfford(BUILDINGS[type].cost)) break;
      if (this.game.placeBuilding(type, sp.tx, sp.ty).ok) placed++;
    }
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
    this.hint(`Placing ${BUILDINGS[type].name} — click to build · drag to fill an area · Right-click/Esc to cancel`);
  }

  cancelBuild() {
    this.buildType = null;
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
  }

  startBuildHintRestore() {
    if (this.buildType && !this.root.contains(this.hintEl)) this.hint(`Placing ${BUILDINGS[this.buildType].name} — click or drag to build · Right-click/Esc to cancel`);
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
      h('button.btn.icon.ghost', { onclick: () => this.closePanel(), title: 'Close' }, '✕'));
  }

  refreshPanel() {
    if (!this.panelEl) return;
    const scroll = this.panelEl.querySelector('.side-body')?.scrollTop || 0;
    const fn = {
      build: () => this.buildPanel(), jobs: () => this.jobsPanel(), court: () => this.courtPanel(), deeds: () => this.deedsPanel(), log: () => this.logPanel(), empire: () => this.empirePanel(),
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
        const hits = Object.entries(BUILDINGS).filter(([type, d]) => `${d.name} ${d.desc} ${d.cat} ${describeBuilding(type).map(e => e.text).join(' ')}`.toLowerCase().includes(q));
        body.append(h('div.faint', `${hits.length} building${hits.length === 1 ? '' : 's'} match “${this.buildQuery.trim()}”`));
        body.append(h('div.bgrid', hits.map(([type, def]) => this.buildCard(type, def))));
        return;
      }
      if (this.buildTab > g.state.era) body.append(this.unlockChecklist(this.buildTab));
      const inEra = Object.entries(BUILDINGS).filter(([, d]) => d.era === this.buildTab);
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
      this.lastBuild && BUILDINGS[this.lastBuild] ? h('button.btn.sm', { title: 'Build it again (R)', onclick: () => this.startBuild(this.lastBuild) }, icon(`buildings/${this.lastBuild}`, 18), `Again (R)`) : null);
    return [this.head('items/hammer', 'Build', `${ERAS[g.state.era].name} era`), tabs, h('div.build-search-row', search, tools), body];
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
          i.type ? icon(`buildings/${i.type}`, 22) : h('span', i.icon),
          h('span', i.text),
          i.frac != null && !i.done ? bar(Math.min(1, i.frac), '#ffcf5a') : null)))));
    }
    return h('div.col', { style: { gap: '8px' } }, rows);
  }

  buildCard(type, def) {
    const g = this.game;
    const locked = def.era > g.state.era;
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
    h('div.thumb', icon(`buildings/${type}`, 56), count ? h('span.bcount', `×${count}`) : null),
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
      body.append(steward
        ? h('div.law.active', h('div', h('b', `Steward ${steward.name} manages jobs`), h('div.faint', `${manual} villager${manual === 1 ? '' : 's'} follow your personal orders instead.`)),
          manual ? h('button.btn.sm', { onclick: () => { for (const v of adults) v.manual = false; g._courtTimers = {}; g.emit('change'); } }, 'Hand all to Steward') : null)
        : h('div.faint', 'Tip: appoint a Steward in the Court (C) and jobs will be assigned for you.'));
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
        body.append(h('div.job-row',
          icon(def.icon, 36),
          h('div', h('div', { style: { fontWeight: 700 } }, def.label), h('div.faint', def.desc)),
          h('div.job-controls',
            h('div.stepper',
              h('button', { title: 'Remove (Shift ×10, Ctrl ×100)', onclick: e => { const n = moveWorkers(g, job, -step(e)); if (!n) this.hint(`Nobody works as ${def.label}`, 1200); } }, '−'),
              h('span.count', workers.length),
              h('button', { title: 'Add (Shift ×10, Ctrl ×100)', onclick: e => { const n = moveWorkers(g, job, step(e)); if (!n) this.hint(g.lastJobError || 'Nobody available', 1500); } }, '+')),
            h('button.btn.sm.auto-pick', {
              title: `Auto pick: move the most skilled person into ${def.label}`,
              onclick: () => { const v = autoPick(g, job); this.hint(v ? `⭐ ${v.name} (${JOB_SKILL[job] || 'skill'} ${Math.floor(v.skills[JOB_SKILL[job]] || 0)}) is now a ${def.label}` : 'Nobody available', 1800); },
            }, '⭐'),
            office && STAFFABLE.includes(job) ? target : null)));
      }
    } else {
      for (const v of [...g.state.villagers].sort((a, b) => b.age - a.age)) {
        const sel = v.away ? h('span.chip.bad', '⚔ At war') : v.office ? h('span.chip.good', `👑 ${OFFICES[v.office].name}`) : v.age >= ADULT_AGE
          ? h('select.input', { style: { width: '120px' }, onchange: e => assignJob(g, v, e.target.value) },
            Object.entries(JOBS).map(([id, d]) => h('option', { value: id, selected: v.job === id }, d.label)))
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
        h('div.faint', 'The ruler’s traits decide their type. Raise your heir with the Leader or Scholar calling, and shape them with Praise, Mentor and Discipline.'),
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
    if (this.deedsTab === 'laws') return [this.head('items/scroll', 'Rule the Realm', 'Your laws decide what your civilization becomes'), tabs, this.lawsBody()];
    const body = h('div.side-body');
    body.append(h('div.faint', 'Your powers as guide. Good deeds raise karma (luck, happiness, wanderers). Evil deeds pay now — and invite curses, ghosts and rebellion.'));
    for (const d of DEEDS) {
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
    body.append(h('div.log', [...s.log].reverse().map(e =>
      h(`div.log-entry.${e.kind}`, h('span.d', `Day ${e.day}`), h('span', e.text)))));
    return [this.head('items/scroll', 'Chronicle', s.owner.villageName), body];
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
            h('span.faint', left ? fmtClock(left / 1000) : 'Arriving…')), bar(1 - left / total, m.kind === 'missile' ? '#ff6b5b' : '#9f7aea')));
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
            h('button.btn.sm', { onclick: () => this.offerModal(p) }, '🤝 Deal'),
            ally ? h('button.btn.sm.ghost', { onclick: () => mp.breakAlliance(p.uid) }, 'Break') : h('button.btn.sm.danger', { onclick: () => this.raidModal(p) }, '⚔ Raid'))));
      }
    } else if (this.worldTab === 'chat') {
      const list = h('div.chat');
      for (const m of mp.chat) {
        list.append(h(`div.msg${m.uid === this.user.uid ? '.me' : ''}`,
          h('span', { style: { cursor: 'pointer' }, onclick: () => this.showProfile({ uid: m.uid, name: m.name, villageName: m.village }) }, avatar(m.name, 28)),
          h('div', h('div.who', m.name, ' ', h('span', `· ${m.village || ''}`)), h('div', m.text))));
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
      h('div.row', h('div.spacer'), h('button.btn.ghost', { onclick: () => m.close() }, 'Cancel'),
        h('button.btn.primary', {
          onclick: async () => {
            try {
              await mp.sendOffer(p, type, type === 'alliance' ? {} : read('give'), type === 'trade' ? read('want') : {});
              m.close();
              this.hint('Offer sent!', 1500);
            } catch (e) { err.textContent = e.message; }
          },
        }, 'Send offer')),
    ]);
  }

  raidModal(p) {
    const mp = this.mp;
    const check = mp.raidCheck(p);
    const warriors = mp.availableWarriors().length;
    const err = h('div.error-text', check === true ? '' : check);
    const m = modal([
      h('div', { style: { textAlign: 'center' } }, icon('items/war', 72)),
      h('h2', { style: { textAlign: 'center' } }, `March on ${p.villageName}?`),
      h('div.muted', `Your ${warriors} warrior${warriors === 1 ? '' : 's'} will march for ${fmtMinutes(travelMs(this.user.uid, p.uid))} to reach them, and just as long to come home. Their scouts may see you coming — they can rally, pay you tribute, or fight. If they are away, the battle is decided by strength. Victory plunders 20% of their food, wood, stone and gold.`),
      h('div.row', { style: { flexWrap: 'wrap' } }, h('span.chip.evil', '−8 karma'), h('span.chip', 'Warriors leave the village'), h('span.chip.bad', 'Some may not return')),
      err,
      h('div.row', h('div.spacer'), h('button.btn.ghost', { onclick: () => m.close() }, 'Stand down'),
        h('button.btn.danger', {
          disabled: check !== true,
          onclick: async e => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
              const r = await mp.launchAttack(p.uid);
              m.close();
              this.announce(`⚔ Your army marches on ${r.target.villageName}!`);
            } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
          },
        }, '⚔ March!')),
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
        item('🎓', 'Restart tutorial', () => { this.tutorial.restart(); this.closePanel(); }),
        install,
        item('🚪', 'Sign out', this.onSignOut)),
      h('h3', 'Controls'),
      h('div.keys',
        ...[['Drag / WASD', 'Move camera'], ['Scroll / Q E', 'Zoom'], ['Right-click / Esc', 'Cancel'], ['B J K M', 'Build · People · Rule · World'],
          ['X', 'Demolish tool'], ['R', 'Build the last building again'], ['/', 'Search buildings'], ['H', 'Jump home'], ...(this.isAdmin ? [['F2', 'Admin console']] : [])]
          .map(([k, d]) => h('div.key-row', h('kbd', k), h('span.faint', d)))),
      h('h3', 'Version'),
      this.versionRow(),
      danger);
    // the install entry gets the same look as the other rows
    install.replaceChildren(h('span.set-icon', '📲'), h('span', 'Install app'), h('span.set-arrow', '›'));
    return [this.head('items/save', 'Save & Settings'), body];
  }

  /** Build number + a button that asks the live site whether a newer version is out. */
  versionRow() {
    const status = h('span.faint', '');
    const btn = h('button.btn.sm', {
      onclick: async () => {
        btn.disabled = true; status.textContent = 'Checking…';
        try {
          const r = await checkLatest();
          status.textContent = r.isLatest ? '✓ Newest version' : `⚠ ${r.live.version} is out — reload to update`;
          status.style.color = r.isLatest ? 'var(--good)' : 'var(--gold)';
          if (!r.isLatest) { btn.textContent = '⟳ Reload now'; btn.onclick = () => location.reload(); }
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
  dragItem(e, from, key, count) {
    const g = this.game;
    startItemDrag(e, {
      iconKey: ITEMS[key]?.icon || 'items/relic',
      count,
      findTarget: (sx, sy) => {
        if (document.elementFromPoint(sx, sy)?.closest('#ui > *:not(.drag-keychain)')) return null;   // over a panel, not the map
        const w = this.renderer.screenToWorld(sx, sy);
        let best = null, bd = TILE * 0.9;
        for (const v of g.state.villagers) {
          if (v === from || v.away) continue;
          const d = Math.hypot(v.x - w.x, v.y - TILE * 0.4 - w.y);
          if (d < bd) { bd = d; best = v; }
        }
        return best;
      },
      onDrop: to => {
        if (!takeItem(from, key)) return;
        addItem(to, key, 1);
        g.float(to.x, to.y - TILE, `+1 ${ITEMS[key]?.label || key}`, '#ffd76a');
        g.log(`${from.name} gave ${to.name} a ${ITEMS[key]?.label || key}.`, 'info');
        this.updateInspector(true);
      },
    });
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
      v.calling ? h('span.chip', `Calling: ${CALLINGS[v.calling].label}`) : null,
    ].filter(Boolean);

    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(villagerSprite({ ...v, role }), 72)),
        h('div.col', { style: { gap: '2px' } },
          h('div.title', v.traits.includes('knighted') ? `Sir ${v.name}` : v.name),
          h('div.faint', `${v.sex === 'f' ? '♀' : '♂'} Age ${Math.floor(v.age)} · Gen ${v.gen || 1}${g.state.ruler?.dynasty && (v.ruling || v.parents?.includes(g.state.ruler.id)) ? ` · House ${g.state.ruler.dynasty}` : ''}`),
          h('div', { style: { fontSize: '13px' } }, v.sick ? '🤒 ' : '', task),
          partner ? h('div.faint', `♥ ${partner.name}`) : null,
          parents.length ? h('div.faint', `Child of ${parents.join(' & ')}`) : null)),
      badges.length ? h('div.traits', badges) : null,
      h('div.traits', v.traits.length
        ? v.traits.map(t => h(`span.chip.${TRAITS[t]?.good ? 'good' : 'bad'}`, { title: TRAITS[t]?.desc }, `${TRAITS[t]?.earned ? '★ ' : ''}${TRAITS[t]?.label || t}`))
        : h('span.faint', 'No notable traits yet')),
      statRow('Health', v.hp, v.hp > 40 ? '#6fdc5a' : '#ff5a4a'),
      statRow('Hunger', v.hunger, '#ffb44a'),
      statRow('Happy', v.happy, '#ffd76a'),

      h('h3', 'Inventory'),
      h('div.inv', slot('Tool', eq.tool), slot('Weapon', eq.weapon), slot('Armor', eq.armor),
        h('div.inv-slot', { title: 'Wages earned from work' }, h('b', { style: { color: 'var(--gold)', fontSize: '16px' } }, inv.coins), h('span', 'Coins'))),
      h('div.traits', Object.keys(inv.pack).length
        ? Object.entries(inv.pack).map(([k, n]) => h('span.chip.pack-item', {
          title: `${ITEMS[k]?.desc || ''}${ITEMS[k]?.desc ? ' · ' : ''}Drag onto another villager to give it`,
          onpointerdown: e => this.dragItem(e, v, k, n),
        }, icon(ITEMS[k]?.icon || 'items/relic', 16), `${ITEMS[k]?.label || k} ×${n}`))
        : h('span.faint', 'Pack is empty')),
      v.kills ? h('div.faint', `⚔ ${v.kills} foes defeated`) : null,

      h('h3', 'Skills'),
      h('div.skills', Object.entries(v.skills).map(([k, val]) => h('div.skill', h('span', `${k} ${Math.floor(val)}`), bar(val / 10)))),

      v.age < ADULT_AGE
        ? h('div.field', h('label', 'Calling — what should they grow up to be?'),
          h('select.input', { onchange: e => { setCalling(g, v, e.target.value); this.updateInspector(true); } },
            Object.entries(CALLINGS).map(([id, c]) => h('option', { value: id, selected: (v.calling || 'none') === id }, c.label))),
          h('div.faint', CALLINGS[v.calling || 'none'].desc))
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
            }, Object.entries(JOBS).map(([id, d]) => h('option', { value: id, selected: v.job === id }, d.label + (id === 'warrior' && !isTrained(v) ? ' (needs training)' : ''))))),
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

  /** The building's special action: button, cost and recharge timer. */
  abilityCard(b) {
    const g = this.game;
    const a = abilityOf(b.type);
    if (!a) return null;
    const left = abilityCooldown(g, b);
    const ok = canUseAbility(g, b);
    const label = left > 0 ? `Ready in ${Math.ceil(left / DAY_LENGTH * 24)}h` : ok === true ? `${a.icon} ${a.name}` : ok;
    return h('div.ability',
      h('div.ability-head', h('span.ability-icon', a.icon), h('div', h('div.ability-name', a.name), h('div.faint', `Recharges every ${a.cooldown} day${a.cooldown > 1 ? 's' : ''}`))),
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
    const workers = g.state.villagers.filter(v => v._task?.building === b).length;
    return [
      h('div.row', { style: { gap: '12px' } },
        h('div.portrait', icon(`buildings/${b.type}`, 72)),
        h('div.col', { style: { gap: '2px' } },
          h('div.title', def.name),
          b.built ? (b.blightUntil > g.state.time ? h('span.chip.bad', 'Blighted') : h('span.chip.good', 'Built')) : h('span.chip', `Building ${Math.floor(b.progress * 100)}%`))),
      !b.built ? bar(b.progress, '#ffd76a') : null,
      h('div.muted', def.desc),
      def.slots ? h('span.chip', `👷 ${workers}/${def.slots} working now`) : null,
      this.abilityCard(b),
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
      def.hostile ? h('div.faint', `Deals ${def.damage} damage. Warriors will hunt it down.`) : h('div.faint', def.food ? 'Hunters can bring it down for food.' : 'Harmless.'),
      def.hostile ? h('div.row', { style: { flexWrap: 'wrap', gap: '6px' } },
        h('button.btn.evil', { onclick: () => { const r = smiteCreature(g, c); if (r.error) this.hint(r.error, 1500); } }, h('span', '⚡ Divine Smite'), costChips({ influence: 20 }, g.state.resources)),
        h('button.btn.danger', { onclick: () => { const r = throwBomb(g, c); this.hint(r.error || r.text, 1800); } }, h('span', '💣 Throw bomb'), costChips({ bombs: 1 }, g.state.resources))) : null,
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
  toast(entry) {
    if (this.panel === 'log') this.refreshPanel();
    if (!['event', 'bad', 'death'].includes(entry.kind)) return;
    const el = h(`div.toast.${entry.kind || 'info'}`, entry.text);
    this.els.feed.append(el);
    while (this.els.feed.children.length > 6) this.els.feed.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 6000);
    setTimeout(() => el.remove(), 6700);
  }

  float(text) { if (text) this.toast({ text, kind: 'event' }); }

  announce(text) {
    const el = h('div.announce', h('div', text));
    this.root.append(el);
    setTimeout(() => el.remove(), 4100);
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
      hasMissiles(g) ? h('button.choice', { onclick: () => go('missile') }, h('span.label', '☢ Launch missile'), h('span.faint', 'Destroys 3 buildings and kills people. −25 karma.'), costChips(MISSILE_COST, g.state.resources)) : null,
      hasOrbital(g) ? h('button.choice', { onclick: () => go('orbital') }, h('span.label', '🛰 Orbital strike'), h('span.faint', 'Destroys 5 buildings. −35 karma.'), costChips(MISSILE_COST, g.state.resources)) : null,
      err,
      h('div.row', h('div.spacer'), h('button.btn.ghost', { onclick: () => m.close() }, 'Cancel')),
    ].filter(Boolean));
  }

  showProfile(p) {
    const me = p.uid === this.user.uid;
    openProfile(p.uid, {
      onSpy: !me && this.mp ? () => this.spyModal(p) : null,
      user: this.user, username: this.username, world: this.world, village: p.villageName ? p : null,
      onVisit: !me && this.mp ? () => this.onVisit(p.uid) : null,
      onDeal: !me && this.mp ? () => this.offerModal(p) : null,
      onMarch: !me && this.mp && !this.mp.allies.has(p.uid) ? () => this.raidModal(p) : null,
    });
  }

  // ------------------------------------------------------------ realm map + visiting
  openMap() {
    this.seenMap = true;
    openRealmMap({
      hud: this,
      onVisit: async uid => {
        try { await this.onVisit(uid); } catch (e) { this.hint(e.message, 3000); }
      },
    });
  }

  setVisiting(profile) {
    this.visiting = profile;
    this.visitBanner?.remove();
    this.select(null);
    this.closePanel();
    if (!profile) return;
    this.visitBanner = h('div.visit-banner',
      avatar(profile.name || '?', 34),
      h('div', h('div.visit-title', `Visiting ${profile.villageName}`),
        h('div.faint', `Ruled by ${profile.name} · ${ERAS[profile.era || 0]?.name} · 👥 ${profile.pop} · ${fmtMinutes(travelMs(this.user.uid, profile.uid || ''))} from home`)),
      profile.uid ? h('button.btn.sm', { onclick: () => this.offerModal({ ...profile, uid: profile.uid }) }, '🤝 Deal') : null,
      profile.uid ? h('button.btn.sm.danger', { onclick: () => this.raidModal({ ...profile, uid: profile.uid }) }, '⚔ March') : null,
      profile.uid && this.mp ? h('button.btn.sm', { onclick: () => this.spyModal({ ...profile, uid: profile.uid }) }, '🕵 Spy') : null,
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
    const threats = this.currentThreats();
    const el = this.els.threats;
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
    const img = ctx.createImageData(MAP_W, MAP_H);
    for (let i = 0; i < w.tiles.length; i++) {
      const hex = MINI_COLORS[w.tiles[i]] || '#000';
      const n = parseInt(hex.slice(1), 16);
      img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    this.miniBase = document.createElement('canvas');
    this.miniBase.width = MAP_W; this.miniBase.height = MAP_H;
    this.miniBase.getContext('2d').putImageData(img, 0, 0);
    this.miniVersion = w.version;
  }

  drawMinimapDots() {
    const g = this.game;
    if (this.miniVersion !== g.world.version) this.drawMinimapBase();
    const ctx = this.mini.getContext('2d');
    ctx.setTransform(MINI_SCALE, 0, 0, MINI_SCALE, 0, 0);
    // the renderer's smooth terrain overview looks far nicer than flat pixels once it exists
    const terrain = this.renderer.terrain;
    const overview = terrain?.world === g.world && terrain.version === g.world.version ? terrain.overview : null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(overview || this.miniBase, 0, 0, MAP_W, MAP_H);
    ctx.fillStyle = 'rgba(28,70,26,0.55)';
    for (const o of g.state.objects) if (o.t.startsWith('tree_') && o.t !== 'tree_stump') ctx.fillRect(o.x + 0.2, o.y + 0.2, 0.6, 0.6);
    ctx.fillStyle = '#ffae3d';
    for (const b of g.state.buildings) { const s = BUILDINGS[b.type].size; ctx.fillRect(b.tx, b.ty, s, s); }
    ctx.fillStyle = '#ffffff';
    for (const v of g.state.villagers) if (!v.away) ctx.fillRect(Math.floor(v.x / TILE), Math.floor(v.y / TILE), 1, 1);
    ctx.fillStyle = '#ff3b3b';
    for (const c of g.state.creatures) if (CREATURES[c.t]?.hostile) ctx.fillRect(Math.floor(c.x / TILE) - 0.5, Math.floor(c.y / TILE) - 0.5, 2, 2);
    const cam = this.renderer.camera;
    const vw = window.innerWidth / cam.zoom / TILE, vh = window.innerHeight / cam.zoom / TILE;
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5 / MINI_SCALE;
    ctx.strokeRect(cam.x / TILE - vw / 2, cam.y / TILE - vh / 2, vw, vh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  destroy() {
    clearInterval(this.missionTimer);
    this.tutorial?.destroy();
    this.root.replaceChildren();
  }
}

function fmtClock(secs) {
  secs = Math.round(secs);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export { RESOURCES };
