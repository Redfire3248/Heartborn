import {
  TILE, DAY_LENGTH, DAYS_PER_SEASON, SEASONS, DAYS_PER_YEAR, BASE_STORAGE, BASE_HOUSING, ADULT_AGE,
} from '../core/constants.js';
import { clamp, chance, pick, weighted } from '../core/rng.js';
import { World, T, makeCreature } from './world.js';
import { BUILDINGS, ERAS } from '../data/buildings.js';
import { OBJECTS, CREATURES, setSpriteEra } from '../data/objects.js';
import { EVENTS } from '../data/events.js';
import { updateVillager, makeVillager, dailyVillagers, killVillager } from './villagers.js';
import { updateCreature } from './creatures.js';
import { FateContext } from './fate.js';
import { updateWar, maybeScheduleWarband } from './war.js';
import { updateCourt } from './court.js';
import { dailyTraitors, dailyMachines, updateBombDefense } from './intrigue.js';
import { dailyPeople, ensureRuler, rulerEffects, carriedLuck } from './dynasty.js';
import { LAW_CATEGORIES, NO_LAW_EFFECTS, DEFAULT_LAWS, LAW_COST, lawOption } from '../data/laws.js';

const CAPPED = ['food', 'wood', 'stone', 'coal', 'iron', 'weapons', 'bombs'];

export class Game {
  constructor(state) {
    this.state = state;
    this.world = new World(state.seed);
    this.world.indexObjects(state.objects);
    this.speed = 1;
    this.paused = false;
    this.pendingEvent = null;
    this.selected = null;
    this.listeners = {};
    this.fx = { floaters: [], particles: [], shake: 0 };
    this.offline = false;      // true while fast-forwarding offline progress
    this.recalc();
    ensureRuler(this);
  }

  // ---------- events ----------
  on(name, fn) { (this.listeners[name] ||= []).push(fn); return () => this.off(name, fn); }
  off(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter(f => f !== fn); }
  emit(name, data) { for (const fn of this.listeners[name] || []) fn(data); }

  // ---------- time ----------
  get day() { return Math.floor(this.state.time / DAY_LENGTH); }
  get hour() { return ((this.state.time / DAY_LENGTH) % 1) * 24; }
  get isNight() { const h = this.hour; return h >= 20 || h < 5; }
  get season() { return SEASONS[Math.floor(this.day / DAYS_PER_SEASON) % SEASONS.length]; }
  get year() { return Math.floor(this.day / DAYS_PER_YEAR) + 1; }
  /** 0 = full day, 1 = darkest night */
  get darkness() {
    const h = this.hour;
    if (h >= 21 || h < 4) return 1;
    if (h >= 18) return (h - 18) / 3;
    if (h < 7) return 1 - (h - 4) / 3;
    return 0;
  }

  // ---------- main loop ----------
  update(realDt) {
    if (this.paused || this.pendingEvent) { this.updateFx(realDt); return; }
    let dt = realDt * this.speed;
    // fixed small steps keep the sim stable at high speed
    while (dt > 0) {
      const step = Math.min(dt, 0.1);
      this.step(step);
      dt -= step;
    }
    this.updateFx(realDt);
  }

  step(dt) {
    const s = this.state;
    s.time += dt;
    if (this.day > s.lastDay) { s.lastDay = this.day; this.newDay(); }

    for (const v of [...s.villagers]) updateVillager(this, v, dt);
    for (const c of [...s.creatures]) updateCreature(this, c, dt);
    updateWar(this, dt);
    updateCourt(this, dt);
    updateBombDefense(this, dt);

    if (!this.offline && !this.pendingEvent && s.time >= s.nextEventAt) this.triggerRandomEvent();
    s.modifiers = s.modifiers.filter(m => m.until > s.time);
  }

  /** Fast-forward offline progress (no events, no effects). Returns a summary. */
  simulate(seconds) {
    const before = { ...this.state.resources, pop: this.state.villagers.length, deaths: this.state.stats.deaths, births: this.state.stats.births };
    this.offline = true;
    const step = 0.5;
    for (let t = 0; t < seconds; t += step) this.step(step);
    this.offline = false;
    this.fx.floaters.length = 0;
    this.fx.particles.length = 0;
    const s = this.state;
    return {
      seconds,
      pop: s.villagers.length - before.pop,
      births: s.stats.births - before.births,
      deaths: s.stats.deaths - before.deaths,
      resources: Object.fromEntries(Object.keys(s.resources).map(k => [k, Math.floor(s.resources[k] - before[k])])),
    };
  }

  newDay() {
    const s = this.state;
    this.recalc();
    dailyVillagers(this);
    dailyPeople(this);
    dailyTraitors(this);
    dailyMachines(this);

    // regrowth
    for (const o of [...s.objects]) {
      const def = OBJECTS[o.t];
      if (def.growsInto && s.time >= (o.growAt ??= s.time + def.growDays * DAY_LENGTH)) {
        o.t = def.growsInto; delete o.growAt; o.charges = OBJECTS[o.t].charges || 0;
      }
      if (def.regrowDays && o.charges <= 0 && s.time >= (o.regrowAt ??= s.time + def.regrowDays * DAY_LENGTH)) {
        o.charges = def.charges; delete o.regrowAt;
      }
    }

    // daily income from buildings
    for (const b of this.builtBuildings()) {
      const def = BUILDINGS[b.type];
      if (def.gold) this.addResource('gold', Math.round(def.gold * (b.type === 'market' ? this.law.marketMult : 1) * this.goldMult));
      for (const [res, n] of Object.entries(def.daily || {})) this.addResource(res, n);
      if (def.influence) this.addResource('influence', def.influence);
      if (def.interest) this.addResource('gold', Math.floor(s.resources.gold * def.interest));
      if (def.karma) this.addKarma(def.karma);
    }
    this.addResource('influence', 1 + Math.floor(s.villagers.length / 5) + this.law.influence + this.courtInfluence + Math.round(this.ruler.influence || 0));
    if (this.ruler.karma) this.addKarma(this.ruler.karma);
    if (this.law.goldPerPop) this.addResource('gold', Math.floor(s.villagers.length * this.law.goldPerPop));
    if (this.law.karma) this.addKarma(this.law.karma);

    // food spoils a little without a granary
    if (!this.hasBuilding('granary') && s.resources.food > 40) s.resources.food = Math.floor(s.resources.food * 0.97);

    // wildlife comes back
    const wild = s.creatures.filter(c => ['deer', 'rabbit', 'boar'].includes(c.t)).length;
    if (wild < 12) this.spawnWild(pick(['deer', 'rabbit', 'rabbit', 'boar']), 20);

    // night dangers
    if (s.creatures.filter(c => CREATURES[c.t].hostile).length < 12) {
      if (s.karma < -20 && chance(0.35)) this.spawnRaiders(pick(['ghost', 'skeleton']), 1 + Math.floor(-s.karma / 40));
      if (chance(0.12)) this.spawnWild('wolf', 22);
      if (s.villagers.length > 10 && chance(0.06)) this.spawnRaiders('goblin', 2);
    }
    maybeScheduleWarband(this);

    // wanderers join happy, famous villages
    const joinChance = 0.2 + this.joinBonus + (this.hasBuilding('tavern') ? 0.1 : 0) + (s.karma > 30 ? 0.06 : 0) + this.law.join;
    if (s.villagers.length < this.housing && chance(joinChance)) {
      const n = Math.min(this.housing - s.villagers.length, chance(0.35) ? 2 + Math.floor(Math.random() * 2) : 1);
      const v = this.addWanderer();
      for (let i = 1; i < n; i++) this.addWanderer();
      this.log(n > 1 ? `A family of ${n} wanderers has joined your people.` : `${v.name} the wanderer has joined your people.`, 'good');
    }

    this.checkEra();
    s.stats.maxPop = Math.max(s.stats.maxPop || 0, s.villagers.length);
    this.emit('day', this.day);
  }

  // ---------- derived values ----------
  recalc() {
    const built = this.builtBuildings();
    let housing = BASE_HOUSING, storage = BASE_STORAGE, foodStorage = 0, weaponStorage = 0, fate = 0, happy = 0, defense = 0, combat = 0, learn = 0, speed = 0, health = 0, spot = 0, join = 0, raid = 0;
    let lawful = false, healer = false, workBonus = 0;
    const bonus = {};
    const law = { ...NO_LAW_EFFECTS };
    for (const [cat, id] of Object.entries({ ...DEFAULT_LAWS, ...(this.state.laws || {}) })) {
      for (const [k, v] of Object.entries(lawOption(cat, id)?.effects || {})) {
        if (typeof v === 'boolean') law[k] = law[k] || v;
        else if (k === 'marketMult' || k === 'raidCooldown' || k === 'sacrifice') law[k] *= v;
        else law[k] += v;
      }
    }
    this.law = law;
    for (const b of built) {
      const d = BUILDINGS[b.type];
      housing += d.housing || 0;
      storage += d.storage || 0;
      foodStorage += d.storageFood || 0;
      weaponStorage += d.storageWeapons || 0;
      spot += d.spot || 0;
      join += d.join || 0;
      raid += d.raidPower || 0;
      workBonus += d.work_bonus || 0;
      lawful ||= !!d.lawful;
      healer ||= !!d.heal;
      fate += d.fate || 0;
      happy += d.happy || 0;
      defense += d.defense || 0;
      combat += d.combat || 0;
      learn += d.learn || 0;
      speed += d.speed || 0;
      health += d.health || 0;
      for (const [k, v] of Object.entries(d.bonus || {})) bonus[k] = (bonus[k] || 0) + v;
    }
    setSpriteEra(this.state.era);
    const ruler = rulerEffects(this);
    this.ruler = ruler;
    storage += ruler.storage || 0;
    combat += ruler.combat || 0;
    defense += ruler.defense || 0;
    raid += ruler.raid || 0;
    learn += ruler.learn || 0;
    fate += (ruler.fate || 0) + carriedLuck(this);
    happy += ruler.happy || 0;
    join += ruler.join || 0;
    lawful ||= !!ruler.lawful;
    if (ruler.build) bonus.build = (bonus.build || 0) + ruler.build;
    this.workBonus = workBonus;
    this.housing = housing;
    this.caps = Object.fromEntries(CAPPED.map(k => [k, k === 'weapons' || k === 'bombs' ? 40 + weaponStorage + Math.floor(storage / 10) : storage + (k === 'food' ? foodStorage : 0)]));
    const court = this.state.court || {};
    const seated = key => court[key]?.id && this.state.villagers.some(v => v.id === court[key].id);
    this.spotBonus = spot + (seated('spymaster') ? 0.2 : 0);
    this.joinBonus = join;
    this.raidBonus = raid;
    this.lawful = lawful;
    this.hasHealer = healer;
    this.goldMult = (seated('treasurer') ? 1.25 : 1) * (1 + (ruler.gold || 0));
    this.courtInfluence = seated('treasurer') ? 2 : 0;
    fate += seated('high_priest') ? 0.1 : 0;
    this.buildingFate = fate;
    this.buildingHappy = Math.max(-30, Math.min(happy, 60));
    this.defense = defense + law.defense;
    this.combatBonus = combat + law.combat;
    this.learnBonus = learn;
    this.speedBonus = speed;
    this.healthBonus = health;
    this.bonus = bonus;
  }

  get fateBonus() {
    const mods = this.state.modifiers.reduce((s, m) => s + (m.fate || 0), 0);
    return this.buildingFate + mods + this.law.fate + this.state.karma / 250;
  }

  get center() {
    const fire = this.state.buildings.find(b => b.type === 'campfire' && b.built);
    return fire ? this.buildingCenter(fire) : this.state.center;
  }

  get karmaTitle() {
    const k = this.state.karma;
    if (k >= 60) return 'Saint';
    if (k >= 20) return 'Kind';
    if (k > -20) return 'Neutral';
    if (k > -60) return 'Dark';
    return 'Tyrant';
  }

  // ---------- resources ----------
  addResource(res, n) {
    const r = this.state.resources;
    if (n < 0) { r[res] = Math.max(0, r[res] + n); return n; }
    const cap = this.caps[res];
    const before = r[res];
    r[res] = cap ? Math.min(cap, r[res] + n) : r[res] + n;
    return Math.floor(r[res] - before);
  }
  canAfford(cost = {}) { return Object.entries(cost).every(([k, v]) => this.state.resources[k] >= v); }
  spend(cost = {}) {
    if (!this.canAfford(cost)) return false;
    for (const [k, v] of Object.entries(cost)) this.state.resources[k] -= v;
    return true;
  }
  addKarma(n) { this.state.karma = clamp(this.state.karma + n, -100, 100); }

  // ---------- buildings ----------
  builtBuildings() { return this.state.buildings.filter(b => b.built); }
  hasBuilding(type) { return this.state.buildings.some(b => b.type === type && b.built); }
  buildingCenter(b) {
    const size = BUILDINGS[b.type].size;
    return { x: (b.tx + size / 2) * TILE, y: (b.ty + size / 2) * TILE };
  }
  buildingAt(tx, ty) {
    return this.state.buildings.find(b => {
      const size = BUILDINGS[b.type].size;
      return tx >= b.tx && ty >= b.ty && tx < b.tx + size && ty < b.ty + size;
    }) || null;
  }
  canPlace(type, tx, ty, { ignoreCost = false } = {}) {
    const def = BUILDINGS[type];
    if (!def) return { ok: false, why: 'Unknown building' };
    if (def.era > this.state.era) return { ok: false, why: `Requires the ${ERAS[def.era].name} era` };
    if (!ignoreCost && !this.canAfford(def.cost)) return { ok: false, why: 'Not enough resources' };
    for (let y = 0; y < def.size; y++) for (let x = 0; x < def.size; x++) {
      if (!this.world.walkableTile(tx + x, ty + y)) return { ok: false, why: 'Cannot build on water' };
      if (this.buildingAt(tx + x, ty + y)) return { ok: false, why: 'Space is taken' };
      const o = this.world.objectAt(tx + x, ty + y);
      if (o && (o.t === 'grave' || o.t === 'ruins')) return { ok: false, why: 'Cannot build on graves or ruins' };
    }
    if (def.nearWater && !this.world.nearWater(tx, ty, def.size)) return { ok: false, why: 'Must be next to water' };
    return { ok: true };
  }

  placeBuilding(type, tx, ty) {
    const check = this.canPlace(type, tx, ty);
    if (!check.ok) return check;
    const def = BUILDINGS[type];
    this.spend(def.cost);
    for (let y = 0; y < def.size; y++) for (let x = 0; x < def.size; x++) {
      const o = this.world.objectAt(tx + x, ty + y);
      if (o) this.world.removeObject(this.state.objects, o);
    }
    const b = { id: `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, type, tx, ty, built: false, progress: 0 };
    this.state.buildings.push(b);
    this.puff(this.buildingCenter(b), 'effects/dust', 6);
    this.emit('change');
    return { ok: true, building: b };
  }

  finishBuilding(b) {
    b.built = true;
    b.progress = 1;
    const def = BUILDINGS[b.type];
    this.recalc();
    const c = this.buildingCenter(b);
    this.puff(c, 'effects/spark', 12);
    this.float(c.x, c.y - TILE, `${def.name} built!`, '#ffd76a');
    this.log(`${def.name} completed.`, 'good');
    if (b.type === 'castle') this.crownRuler();
    this.checkEra();
    this.emit('change');
  }

  demolish(b) {
    const def = BUILDINGS[b.type];
    const refund = b.built ? 0.4 : 0.8;
    for (const [k, v] of Object.entries(def.cost)) this.addResource(k, Math.floor(v * refund));
    this.state.buildings = this.state.buildings.filter(x => x !== b);
    this.puff(this.buildingCenter(b), 'effects/smoke', 10);
    this.recalc();
    this.emit('change');
  }

  crownRuler() {
    ensureRuler(this);
    const v = this.state.villagers.find(x => x.id === this.state.ruler?.id);
    if (v) this.announce(`${v.name} is crowned in the new castle!`);
  }

  checkEra() {
    const s = this.state;
    const next = ERAS[s.era + 1];
    if (!next) return;
    if (s.villagers.length >= next.pop && next.requires.every(t => this.hasBuilding(t)) && (s.resources.science || 0) >= (next.science || 0)) {
      s.era++;
      this.addResource('influence', 25 * s.era);
      this.announce(`Your people enter the ${next.name} era!`);
      this.log(`A new age: the ${next.name} era begins.`, 'event');
      this.emit('change');
    }
  }

  // ---------- population ----------
  addWanderer(opts = {}) {
    const c = this.center;
    const v = makeVillager(this.state, { age: opts.child ? 6 + Math.random() * 4 : 16 + Math.random() * 20 });
    v.x = c.x + (Math.random() - 0.5) * TILE * 4;
    v.y = c.y + (Math.random() - 0.5) * TILE * 4;
    v.job = opts.child ? 'idle' : 'gather';
    this.state.villagers.push(v);
    this.puff(v, 'effects/spark', 8);
    return v;
  }

  // ---------- creatures ----------
  spawnCreature(type, x, y, extra = {}) {
    if (!CREATURES[type]) return null;
    const c = makeCreature(type, 0, 0);
    Object.assign(c, { x, y, ...extra });
    // monsters that come for the village grow with it, so tiny tribes are not wiped out
    if (c.raid && CREATURES[type].hostile) c.scale = clamp(0.3 + this.state.villagers.length * 0.06, 0.4, 1.6);
    this.state.creatures.push(c);
    return c;
  }

  randomLandTile(minDist, maxDist) {
    const cen = this.center;
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = minDist + Math.random() * (maxDist - minDist);
      const tx = Math.floor(cen.x / TILE + Math.cos(a) * d), ty = Math.floor(cen.y / TILE + Math.sin(a) * d);
      if (this.world.walkableTile(tx, ty)) return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
    }
    return null;
  }

  spawnWild(type, minDist) {
    const p = this.randomLandTile(minDist, minDist + 15);
    if (p) this.spawnCreature(type, p.x, p.y);
  }

  /** Hostiles that march on the village. */
  spawnRaiders(type, n, near = null) {
    const base = near || this.randomLandTile(12, 18);
    if (!base) return;
    for (let i = 0; i < n; i++) {
      this.spawnCreature(type, base.x + (Math.random() - 0.5) * TILE * 2, base.y + (Math.random() - 0.5) * TILE * 2, { raid: true, born: this.state.time });
    }
    const def = CREATURES[type];
    if (!this.offline && def.hostile) this.log(`${n > 1 ? n + ' ' : 'A '}${type.replace('_', ' ')}${n > 1 ? 's' : ''} approach${n > 1 ? '' : 'es'} the village!`, 'bad');
  }

  // ---------- story events ----------
  triggerRandomEvent() {
    const s = this.state;
    s.nextEventAt = s.time + DAY_LENGTH * (1 + Math.random() * 1.5);
    const pop = s.villagers.length;
    const pool = EVENTS.filter(e => (!e.minPop || pop >= e.minPop) && (!e.condition || e.condition(this)));
    if (!pool.length) return;
    this.startEvent(weighted(pool));
  }

  startEvent(event) {
    if (!event || this.pendingEvent) return;
    this.pendingEvent = event;
    this.emit('event', event);
  }

  chooseEvent(index) {
    const event = this.pendingEvent;
    if (!event) return null;
    const choice = event.choices[index];
    if (choice.cost && !this.spend(choice.cost)) return { error: 'Not enough resources' };
    if (choice.needsVictim && !this.state.villagers.length) return { error: 'No one to sacrifice' };
    this.addKarma(choice.karma || 0);
    const ctx = new FateContext(this, null, null, 'event');
    const text = choice.apply(ctx) || '';
    this.state.stats.events = (this.state.stats.events || 0) + 1;
    this.log(`${event.title}: ${text}`, choice.karma < 0 ? 'bad' : 'event');
    this.pendingEvent = null;
    this.emit('change');
    return { text };
  }

  /** Whether the militia rallies by itself when scouts spot an army. */
  get autoRally() { return !!(this.law.autoRally || this.state.court?.marshal?.id); }

  /** A free spot near the centre with a one-tile gap around it, so roads stay open. */
  findBuildSpot(type) {
    const def = BUILDINGS[type];
    const cx = Math.floor(this.center.x / TILE), cy = Math.floor(this.center.y / TILE);
    for (let r = 2; r < 26; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (!this.canPlace(type, tx, ty).ok) continue;
        let crowded = false;
        for (let y = ty - 1; y <= ty + def.size && !crowded; y++) {
          for (let x = tx - 1; x <= tx + def.size; x++) if (this.buildingAt(x, y)) { crowded = true; break; }
        }
        if (!crowded) return { tx, ty };
      }
    }
    return null;
  }

  // ---------- laws ----------
  canEnact(category, id) {
    const s = this.state;
    const opt = lawOption(category, id);
    if (!opt) return 'Unknown law';
    if ((s.laws?.[category] || DEFAULT_LAWS[category]) === id) return 'Already the law';
    if (opt.era && s.era < opt.era) return `Requires the ${ERAS[opt.era].name} era`;
    if (opt.requires && !this.hasBuilding(opt.requires)) return `Requires a ${BUILDINGS[opt.requires].name}`;
    const last = s.lawChangedAt?.[category];
    if (last != null && s.time - last < DAY_LENGTH) return 'The people need a day before another change';
    if (!this.canAfford(LAW_COST)) return `Needs ${LAW_COST.influence} influence`;
    return true;
  }

  enactLaw(category, id) {
    const ok = this.canEnact(category, id);
    if (ok !== true) return { error: ok };
    const s = this.state;
    this.spend(LAW_COST);
    s.laws = { ...DEFAULT_LAWS, ...(s.laws || {}), [category]: id };
    s.lawChangedAt = { ...(s.lawChangedAt || {}), [category]: s.time };
    // sudden change unsettles people for a moment
    for (const v of s.villagers) v.happy = clamp(v.happy - 4, 0, 100);
    this.recalc();
    const opt = lawOption(category, id);
    const cat = LAW_CATEGORIES.find(c => c.id === category);
    this.log(`Royal decree: ${opt.name} is now the ${cat.name.toLowerCase()} of ${s.owner.villageName}.`, 'event');
    this.announce(`📜 ${opt.name}`);
    this.emit('change');
    return { ok: true };
  }

  // ---------- feedback ----------
  log(text, kind = 'info') {
    const entry = { text, kind, day: this.day + 1, t: Date.now() };
    this.state.log.push(entry);
    if (this.state.log.length > 120) this.state.log.splice(0, this.state.log.length - 120);
    if (!this.offline) this.emit('log', entry);
  }
  announce(text) { if (!this.offline) this.emit('announce', text); }
  float(x, y, text, color = '#fff') {
    if (this.offline || !text) return;
    this.fx.floaters.push({ x, y, text, color, life: 2.2, max: 2.2 });
  }
  puff(pos, spriteKey, n = 6, spread = 14) {
    if (this.offline) return;
    for (let i = 0; i < n; i++) {
      this.fx.particles.push({
        x: pos.x + (Math.random() - 0.5) * spread, y: pos.y - Math.random() * spread,
        vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30,
        sprite: spriteKey, size: 8 + Math.random() * 8, life: 0.8 + Math.random() * 0.6, max: 1.4, rot: Math.random() * 6,
      });
    }
  }
  updateFx(dt) {
    const { floaters, particles } = this.fx;
    for (const f of floaters) { f.life -= dt; f.y -= 18 * dt; }
    for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 20 * dt; p.rot += dt * 2; }
    this.fx.floaters = floaters.filter(f => f.life > 0);
    this.fx.particles = particles.filter(p => p.life > 0);
    this.fx.shake = Math.max(0, this.fx.shake - dt * 8);
  }

  // re-exported helpers for other modules
  killVillager(v, reason) { killVillager(this, v, reason); }
}
