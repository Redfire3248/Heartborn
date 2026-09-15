import { TILE, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { weighted, irange, clamp, pick } from '../core/rng.js';
import { OUTCOMES } from '../data/outcomes.js';
import { OBJECTS, CREATURES } from '../data/objects.js';
import { BUILDINGS } from '../data/buildings.js';
import { gainSkill } from './villagers.js';
import { addItem } from './dynasty.js';

const SKILL_FOR = { craft: 'craft', quarry: 'mine', chop: 'chop', gather: 'gather', mine: 'mine', deepmine: 'mine', farm: 'farm', fish: 'fish', hunt: 'hunt', build: 'build', explore: 'combat', pray: 'build' };
const BONUS_FOR = { chop: 'chop', mine: 'mine', deepmine: 'mine', quarry: 'mine', farm: 'farm', fish: 'fish', hunt: 'hunt' };
const SEASON_FARM = { Spring: 1, Summer: 1.15, Autumn: 1.3, Winter: 0.35 };

/**
 * Roll fate for an action. Returns { good, text, big }.
 * Chance of good outcomes rises with skill, fate bonus (shrines, karma, modifiers) and Blessed;
 * falls with Cursed. "karmaScaled" bad outcomes are much likelier for evil villages.
 */
export function rollFate(g, action, v, target = null) {
  const table = OUTCOMES[action];
  if (!table) return { good: true, text: '' };
  const skill = v ? v.skills[SKILL_FOR[action]] || 0 : 0;
  let luck = g.fateBonus + skill * 0.04;
  if (v?.traits.includes('blessed')) luck += 0.35;
  if (v?.traits.includes('cursed')) luck -= 0.4;
  const karmaFactor = clamp(1 - g.state.karma / 80, 0.3, 2.2);

  const weightedTable = table.map(o => {
    let w = o.weight;
    if (o.good) w *= Math.max(0.2, 1 + luck);
    else w *= Math.max(0.15, 1 - luck * 0.7);
    if (o.karmaScaled) w *= karmaFactor;
    return { ...o, weight: w };
  });
  const outcome = weighted(weightedTable);
  const ctx = new FateContext(g, v, target, action);
  const text = outcome.apply(ctx) || '';
  if (v && v._alive !== false) gainSkill(g, v, SKILL_FOR[action]);
  if (text) {
    const pos = v || (target && ctx.targetPos());
    if (pos) g.float(pos.x, pos.y - TILE * 1.1, text, outcome.good ? '#9dff8a' : '#ff7a6a');
    if (outcome.big) g.log(`${v ? v.name + ': ' : ''}${text}`, outcome.good ? 'good' : 'bad');
    if (outcome.big && pos) g.puff(pos, outcome.good ? 'effects/spark' : 'effects/skull_curse', 10);
    if (outcome.big && !outcome.good) g.fx.shake = 1;
  }
  return { good: outcome.good, text, big: outcome.big };
}

/** Helper API used by outcome tables and story events. */
export class FateContext {
  constructor(g, v, target, action) {
    this.g = g;
    this._v = v;
    this.target = target;
    this.action = action;
  }

  get state() { return this.g.state; }
  get pop() { return this.g.state.villagers.length; }

  /** For events with no specific villager, a random adult steps up. */
  get v() {
    if (!this._v) {
      const adults = this.state.villagers.filter(x => x.age >= ADULT_AGE);
      this._v = pick(adults.length ? adults : this.state.villagers) || null;
    }
    return this._v;
  }

  chance(p) { return Math.random() < p; }

  targetPos() {
    const t = this.target;
    if (!t) return this.g.center;
    if (t.tx != null) return this.g.buildingCenter(t);
    if (t.def && t.obj) return { x: t.obj.x * TILE + TILE / 2, y: t.obj.y * TILE + TILE };
    return { x: t.x, y: t.y };
  }

  multiplier(res, opts = {}) {
    const g = this.g;
    let m = 1;
    const skill = this._v ? this._v.skills[SKILL_FOR[this.action]] || 0 : 0;
    m += skill * 0.05;
    const bonusKey = BONUS_FOR[this.action];
    if (bonusKey && g.bonus[bonusKey]) m += g.bonus[bonusKey];
    if (opts.farm) m *= SEASON_FARM[g.season];
    if (res === 'influence') m = 1;
    return m;
  }

  gain(res, lo, hi, opts) {
    const n = Math.max(1, Math.round(irange(lo, hi) * this.multiplier(res, opts)));
    return this.g.addResource(res, n);
  }

  /** Weapons from a finished craft, scaled by the recipe and the smith's skill. */
  gainWeapons(mult = 1) {
    const recipe = BUILDINGS[this.target?.type]?.recipe;
    const skill = this._v?.skills.craft || 0;
    const n = Math.max(1, Math.round((recipe?.out || 1) * mult * (1 + skill * 0.05)));
    this.craftRes = recipe?.res || 'weapons';
    return this.g.addResource(this.craftRes, n);
  }

  /** Put something in this villager's own pack. */
  keep(item) { if (this._v) addItem(this._v, item); return ''; }

  gainObj(res) {
    const range = this.target?.def?.[res];
    if (!range) return 0;
    return this.gain(res, range[0], range[1]);
  }

  gainAllObj() {
    const def = this.target?.def;
    if (!def) return '';
    const parts = [];
    for (const res of ['stone', 'coal', 'iron', 'gold', 'gems', 'influence']) {
      if (def[res]) parts.push(`+${this.gain(res, def[res][0], def[res][1])} ${res}`);
    }
    return parts.join(' ');
  }

  gainCreature() {
    const c = this.target;
    const def = c && CREATURES[c.t];
    if (!def?.food) return 0;
    const n = this.gain('food', def.food[0], def.food[1]);
    this.g.state.creatures = this.g.state.creatures.filter(x => x !== c);
    return n;
  }

  lose(res, frac) {
    const r = this.state.resources;
    // a share of the stores, but never a ruinous amount for a big, rich village
    const cap = 40 + this.pop * 5 + this.state.era * 30;
    const lost = Math.floor(Math.min(r[res] * frac, cap));
    r[res] -= lost;
    return lost;
  }

  hurt(n) {
    const v = this.v;
    if (!v) return;
    v.hp -= n;
    v._hurtFlash = 0.3;
    if (v.hp <= 0) this.g.killVillager(v, 'died of wounds');
  }

  hurtRandom(n) { this._v = null; this.hurt(n); }

  kill(reason) { if (this.v) this.g.killVillager(this.v, reason); }

  sick() {
    const v = this.v;
    if (!v) return;
    v.sick = Math.max(v.sick || 0, v.traits.includes('sickly') ? 3 : 2);
  }

  plague() {
    for (const x of this.state.villagers) {
      if (Math.random() < 0.3) x.sick = Math.max(x.sick || 0, 2);
    }
  }

  cureAll() { for (const x of this.state.villagers) x.sick = 0; }

  trait(t) {
    const v = this.v;
    if (!v || v.traits.includes(t)) return;
    if (t === 'cursed') v.traits = v.traits.filter(x => x !== 'blessed');
    if (t === 'blessed') v.traits = v.traits.filter(x => x !== 'cursed');
    v.traits.push(t);
  }

  karma(n) { this.g.addKarma(n); }

  happy(n) { if (this.v) this.v.happy = clamp(this.v.happy + n, 0, 100); }
  happyAll(n) { for (const x of this.state.villagers) x.happy = clamp(x.happy + n, 0, 100); }

  skillUp(skill, n) { if (this.v) for (let i = 0; i < n * 4; i++) gainSkill(this.g, this.v, skill, true); }

  spawn(type) {
    const p = this._v || this.targetPos();
    const a = Math.random() * Math.PI * 2;
    this.g.spawnCreature(type, p.x + Math.cos(a) * TILE * 2, p.y + Math.sin(a) * TILE * 2, { raid: true, born: this.state.time });
  }

  spawnGroup(type, n) { this.g.spawnRaiders(type, n); }

  wanderer(opts) { return this.g.addWanderer(opts); }

  plantSapling() {
    const o = this.target?.obj;
    const base = o ? { x: o.x, y: o.y } : { x: Math.floor(this.g.center.x / TILE), y: Math.floor(this.g.center.y / TILE) };
    this.plantNear(base.x, base.y);
  }

  plantSaplings(n) {
    for (let i = 0; i < n; i++) {
      const p = this.g.randomLandTile(6, 14);
      if (p) this.plantNear(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    }
  }

  plantNear(tx, ty) {
    const { world, state } = this.g;
    for (let i = 0; i < 12; i++) {
      const x = tx + irange(-2, 2), y = ty + irange(-2, 2);
      if (world.walkableTile(x, y) && !world.objectAt(x, y) && !this.g.buildingAt(x, y)) {
        world.addObject(state.objects, { id: `o${Date.now().toString(36)}${i}`, t: 'sapling', x, y, charges: 0 });
        return;
      }
    }
  }

  blightTarget() {
    if (this.target?.tx != null) this.target.blightUntil = this.state.time + DAY_LENGTH;
  }

  buildBoost(f) {
    const b = this.target;
    if (b?.tx == null || b.built) return;
    b.progress = clamp(b.progress + f * 0.25, 0, 0.99);
  }

  lightning() {
    const v = this.v;
    if (!v) return;
    this.g.puff(v, 'effects/lightning', 3, 4);
    this.g.fx.shake = 1.5;
    this.hurt(50);
  }

  babyBoom() {
    this.state.modifiers.push({ id: 'babyboom', fertility: 1, until: this.state.time + DAY_LENGTH * 2 });
  }

  destroyRandomHome() {
    const homes = this.g.builtBuildings().filter(b => BUILDINGS[b.type].housing);
    if (!homes.length) return;
    const b = pick(homes);
    this.g.puff(this.g.buildingCenter(b), 'effects/flame', 14);
    this.state.buildings = this.state.buildings.filter(x => x !== b);
    this.g.recalc();
  }

  sacrifice() {
    const v = this.v;
    if (!v) return;
    this.g.killVillager(v, 'was sacrificed');
    this.g.addResource('influence', 30);
  }
}

export { OBJECTS };
