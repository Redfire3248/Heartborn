import {
  TILE, DAY_LENGTH, DAYS_PER_YEAR, ADULT_AGE, ELDER_AGE, HUNGER_PER_DAY, FOOD_PER_MEAL, MEAL_RESTORES,
  WALK_SPEED, MAX_SKILL,
} from '../core/constants.js';
import { clamp, pick, chance } from '../core/rng.js';
import { MALE_NAMES, FEMALE_NAMES, BIRTH_TRAITS } from '../data/traits.js';
import { OBJECTS, CREATURES } from '../data/objects.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { rollFate } from './fate.js';
import { damageCreature } from './creatures.js';
import { isTrained, has, onVillagerGone, addItem } from './dynasty.js';
import { CALLINGS } from '../data/people.js';
import { canDoJob, professionLabel, ensureProfession, inheritProfession, professionFromCalling, TRADE_TOOL, grantTradeSkill } from './professions.js';

export const JOBS = {
  idle:    { label: 'Idle',       icon: 'effects/emote_sleep', desc: 'Wanders, helps build, gathers when hungry' },
  gather:  { label: 'Gatherer',   icon: 'nature/berry_bush',   desc: 'Collects berries and wild food' },
  chop:    { label: 'Woodcutter', icon: 'items/axe',           desc: 'Chops trees for wood' },
  mine:    { label: 'Miner',      icon: 'items/pickaxe',       desc: 'Mines rocks and ores (or the Mine)' },
  farm:    { label: 'Farmer',     icon: 'items/hoe',           desc: 'Works farms (needs a Farm)' },
  fish:    { label: 'Fisher',     icon: 'characters/fish',     desc: 'Fishes (needs a Fishing Hut or Harbor)' },
  hunt:    { label: 'Hunter',     icon: 'items/bow',           desc: 'Hunts animals for food' },
  build:   { label: 'Builder',    icon: 'items/hammer',        desc: 'Constructs buildings' },
  spy:     { label: 'Spy',        icon: 'units/spy',           desc: 'Trains at a Spy Den. Trained spies guard against enemy agents and can be sent on missions' },
  recruit: { label: 'Recruit',    icon: 'buildings/training_ground', desc: 'Drills at a Training Ground or Barracks until trained for war' },
  warrior: { label: 'Warrior',    icon: 'items/sword',         desc: 'Trained soldiers only. Guards the village and marches on raids' },
  smith:   { label: 'Smith',      icon: 'items/sword',         desc: 'Crafts weapons at a Craft Hut, Blacksmith or Weaponsmith' },
  scout:   { label: 'Scout',      icon: 'effects/marker_flag', desc: 'Watches the borders. Warns the King of attacks earlier' },
  explore: { label: 'Explorer',   icon: 'nature/tree_pine',    desc: 'Ventures into the wild. Great rewards… or death' },
};

const ITEM_NAMES = { axe: 'Axe', pickaxe: 'Pickaxe', hoe: 'Hoe', hammer: 'Hammer', bow: 'Bow', spear_t: 'Fishing spear' };
const TOOL = { train: 'items/sword', craft: 'items/hammer', chop: 'items/axe', mine: 'items/pickaxe', deepmine: 'items/pickaxe', farm: 'items/hoe', build: 'items/hammer', hunt: 'items/spear', fight: 'items/sword', fish: 'items/spear', explore: 'items/sword' };
const WORK_TIME = { spytrain: 8, train: 8, craft: 8, chop: 5, mine: 6, deepmine: 7, gather: 3, farm: 7, fish: 6, hunt: 2.5, explore: 4, heal: 4, eat: 1.5 };
const JOB_ROLE = { farm: 'farmer', mine: 'miner', hunt: 'hunter', warrior: 'warrior', scout: 'scout', smith: 'blacksmith' };

let idCounter = 0;

export function makeVillager(state, { sex, age = 20, parents = null } = {}) {
  sex ||= Math.random() < 0.5 ? 'm' : 'f';
  return {
    id: `v${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.floor(Math.random() * 1000)}`,
    name: pick(sex === 'f' ? FEMALE_NAMES : MALE_NAMES),
    sex, age, x: 0, y: 0,
    hp: 100, hunger: 80, happy: 60,
    skills: { chop: 0, mine: 0, gather: 0, farm: 0, fish: 0, hunt: 0, build: 0, craft: 0, combat: 0, stealth: 0 },
    traits: Math.random() < 0.3 ? [pick(BIRTH_TRAITS)] : [],
    job: 'idle', partner: null, parents, gen: 1, sick: 0, role: null,
    inv: { pack: {}, coins: 0 }, kills: 0, calling: null, trained: false,
    born: state.time,
  };
}

/** Role shown by the sprite: royalty, or a job look once skilled. */
export function displayRole(v) {
  if (v.ruling) return v.sex === 'f' ? 'queen' : 'king';
  if (v.role) return v.role;
  if (v.office) return `office_${v.office}`;
  if (v.job === 'warrior' || v.job === 'scout') return v.job;
  const role = JOB_ROLE[v.job];
  return role && (v.skills[v.job] || 0) >= 3 ? role : null;
}

export function toolFor(v) {
  const t = v._task;
  if (!t || t.phase !== 'work') return null;
  if (t.type === 'fight' || t.type === 'explore') return weaponOf(v);
  if (t.type === 'train') return null;   // recruits drill with the wooden practice sword they already carry
  const need = TASK_TOOL[t.type];
  if (need && !v.inv?.pack?.[need]) return null;   // no tool of their own: bare hands
  return TOOL[t.type];
}

// the item a task needs; with it work goes faster, without it slower
const TASK_TOOL = { chop: 'axe', mine: 'pickaxe', deepmine: 'pickaxe', farm: 'hoe', build: 'hammer', craft: 'hammer', hunt: 'bow', fish: 'spear_t' };
export const hasToolFor = (v, taskType) => !TASK_TOOL[taskType] || !!v.inv?.pack?.[TASK_TOOL[taskType]];

// what someone without a real weapon grabs in a fight: the tool of their trade, or bare fists
const IMPROVISED = { chop: 'items/axe', mine: 'items/pickaxe', build: 'items/hammer', farm: 'items/hoe', hunt: 'items/bow', fish: 'items/spear', smith: 'items/hammer' };

/** The weapon a villager really has: a forged weapon, one from their pack, or an improvised tool. */
export function weaponOf(v) {
  if (v.armed) return 'items/sword';
  const pack = v.inv?.pack || {};
  if (pack.sword) return 'items/sword';
  if (pack.spear) return 'items/spear';
  const tool = TRADE_TOOL[v.profession];
  return tool && pack[tool] ? IMPROVISED[v.profession] || null : null;
}

export function gainSkill(g, v, skill, silent = false) {
  if (!skill || v.skills[skill] == null) return;
  let rate = 0.05 * (1 + g.learnBonus);
  if (v.traits.includes('genius')) rate *= 2;
  if (v.traits.includes('clever')) rate *= 1.5;
  if (v.traits.includes('ambitious')) rate *= 1.25;
  const before = Math.floor(v.skills[skill]);
  v.skills[skill] = Math.min(MAX_SKILL, v.skills[skill] + rate);
  if (!silent && Math.floor(v.skills[skill]) > before) {
    g.float(v.x, v.y - TILE * 1.4, `${skill} ${Math.floor(v.skills[skill])}!`, '#7fd4ff');
    g.puff(v, 'effects/spark', 5, 10);
  }
}

export function killVillager(g, v, reason) {
  const s = g.state;
  if (!s.villagers.includes(v)) return;
  v._alive = false;
  s.villagers = s.villagers.filter(x => x !== v);
  for (const x of s.villagers) if (x.partner === v.id) { x.partner = null; x.happy = clamp(x.happy - 25, 0, 100); }
  s.stats.deaths = (s.stats.deaths || 0) + 1;
  const tx = Math.floor(v.x / TILE), ty = Math.floor(v.y / TILE);
  if (g.world.walkableTile(tx, ty) && !g.world.objectAt(tx, ty) && !g.buildingAt(tx, ty)) {
    g.world.addObject(s.objects, { id: `o${Date.now().toString(36)}g`, t: 'grave', x: tx, y: ty, charges: 0, name: v.name });
  }
  g.puff(v, 'effects/ghost_wisp', 4);
  g.log(`${v.name} ${reason}. (age ${Math.floor(v.age)})`, 'death', v);
  onVillagerGone(g, v);
  for (const x of s.villagers) x.happy = clamp(x.happy - 4, 0, 100);
  if (g.selected?.kind === 'villager' && g.selected.ref === v) g.selected = null;
  g.emit('change');
  if (!s.villagers.length) g.emit('extinct');
}

// ------------------------------------------------------------------ daily

export function dailyVillagers(g) {
  const s = g.state;
  const pop = s.villagers.length;
  const yearFrac = 1 / DAYS_PER_YEAR;

  for (const v of [...s.villagers]) {
    if (v.robot) continue;   // machines do not age, sicken or wander off
    const wasChild = v.age < ADULT_AGE;
    v.age += v.age < ADULT_AGE ? yearFrac * 12 : yearFrac;   // children grow up in about a week
    if (wasChild && v.age >= ADULT_AGE) {
      const calling = CALLINGS[v.calling || 'none'];
      if (isTrained(v)) v.trained = true;
      professionFromCalling(v);
      const trade = ensureProfession(v);   // grown-ups start working in their household's trade
      grantTradeSkill(v);                  // the childhood head start becomes a real working skill
      v.job = trade === 'warrior' && !v.trained ? 'recruit' : trade;
      if (v.calling) g.log(`${v.name} comes of age as a ${calling.label.toLowerCase()}.`, 'good');
    }
    // old age
    if (v.age > 58 && chance(0.012 * (v.age - 58))) { killVillager(g, v, 'passed away peacefully'); continue; }

    // sickness
    if (v.sick > 0) {
      v.sick -= g.hasBuilding('healer_hut') || g.hasHealer ? 2 : 1;
      if (v.sick <= 0) { v.sick = 0; g.float(v.x, v.y - TILE, 'Recovered', '#9dff8a'); }
      for (const o of s.villagers) {
        if (o !== v && !o.sick && chance((0.08 * Math.min(1, 8 / pop)) / (1 + g.healthBonus))) o.sick = 2;
      }
    } else if (chance((v.traits.includes('sickly') ? 0.04 : 0.012) / (1 + g.healthBonus))) {
      v.sick = 2;
    }

    // unhappy villagers may leave or steal
    if (v.happy < 12 && v.age >= ADULT_AGE && !has(v, 'loyal') && !v.ruling && chance(0.15)) {
      g.log(`${v.name} was so miserable they left the village.`, 'bad');
      s.villagers = s.villagers.filter(x => x !== v);
      onVillagerGone(g, v);
      continue;
    }
    if (v.traits.includes('greedy') && !g.lawful && !s.villagers.some(o => has(o, 'honest') && o.office) && chance(0.15)) {
      const stolen = Math.floor(s.resources.gold * 0.15);
      if (stolen > 0) { s.resources.gold -= stolen; g.log(`${v.name} (Greedy) pocketed ${stolen} gold.`, 'bad'); }
    }
  }

  // romance
  const singles = s.villagers.filter(v => !v.robot && !v.jailed && v.age >= ADULT_AGE && v.age < 50 && !v.partner && v.happy > 30);
  for (const a of singles) {
    if (a.partner || a.sex !== 'f') continue;
    const b = singles.find(x => x.sex === 'm' && !x.partner && !isFamily(a, x));
    if (b && chance(0.85)) {
      a.partner = b.id; b.partner = a.id;
      a._emote = { key: 'effects/emote_love', life: 3 }; b._emote = { key: 'effects/emote_love', life: 3 };
    }
  }

  // births
  const fertility = s.modifiers.reduce((m, x) => m + (x.fertility || 0), 1);
  for (const mom of s.villagers.filter(v => v.sex === 'f' && v.partner && v.age >= ADULT_AGE && v.age < 45)) {
    if (s.villagers.length >= g.housing) break;
    const dad = s.villagers.find(v => v.id === mom.partner);
    if (!dad) continue;
    let p = 0.55 * fertility;
    if (mom.happy > 65) p *= 1.4;
    if (mom.traits.includes('fertile') || dad.traits.includes('fertile')) p *= 1.5;
    if (s.resources.food < s.villagers.length * 2) p *= 0.4;
    if (chance(p)) {
      birth(g, mom, dad);
      if (chance(0.12) && s.villagers.length < g.housing) birth(g, mom, dad);   // twins
    }
  }
  if (pop === 0) return;
}

function isFamily(a, b) {
  if (!a.parents || !b.parents) return false;
  return a.parents.some(p => b.parents.includes(p)) || a.parents.includes(b.id) || b.parents.includes(a.id);
}

function birth(g, mom, dad) {
  const s = g.state;
  const child = makeVillager(s, { age: 0, parents: [mom.id, dad.id] });
  child.x = mom.x + 6; child.y = mom.y + 4;
  child.gen = Math.max(mom.gen || 1, dad.gen || 1) + 1;
  child.traits = [];
  ensureProfession(mom); ensureProfession(dad);
  inheritProfession(child, mom, dad);   // households pass their trade on
  const inherit = [...mom.traits, ...dad.traits].filter(t => t !== 'blessed' && t !== 'cursed');
  if (inherit.length && chance(0.5)) child.traits.push(pick(inherit));
  if (chance(0.15)) { const t = pick(BIRTH_TRAITS); if (!child.traits.includes(t)) child.traits.push(t); }
  s.villagers.push(child);
  s.stats.births = (s.stats.births || 0) + 1;
  g.puff(child, 'effects/spark', 8);
  g.float(child.x, child.y - TILE, 'A baby is born!', '#ffb3de');
  g.log(`${mom.name} and ${dad.name} welcomed baby ${child.name}.`, 'birth', child);
  g.emit('change');
}

// ------------------------------------------------------------------ per step

export function updateVillager(g, v, dt) {
  const s = g.state;
  if (v.away) {
    // marching with an army far from home
    // (multiplayer settles returning armies; this is only a safety net)
    if (Date.now() > v.away.until + 60_000) returnHome(g, v);
    return;
  }
  v._walking = false;
  if (v._hurtFlash) v._hurtFlash = Math.max(0, v._hurtFlash - dt);
  if (v._emote) { v._emote.life -= dt; if (v._emote.life <= 0) v._emote = null; }

  // needs
  if (v.robot) { v.hunger = 100; v.happy = 60; }
  v.hunger = Math.max(0, v.hunger - (HUNGER_PER_DAY / DAY_LENGTH) * dt * (v.age < ADULT_AGE ? 0.6 : 1) * (has(v, 'glutton') ? 1.5 : 1) * (v.robot ? 0 : 1));
  if (v.hunger <= 0) {
    v.hp -= (30 / DAY_LENGTH) * dt;
    v.happy = Math.max(0, v.happy - dt * 0.2);
    if (v.hp <= 0) { killVillager(g, v, 'starved to death'); return; }
  } else if (v.hp < 100 && !v.sick) {
    v.hp = Math.min(Math.max(100, v.hp), v.hp + ((15 + g.healthBonus * 20) / DAY_LENGTH) * dt);   // admin-made heroes may have more than 100
  }
  if (v.sick) {
    v.hp -= (6 / DAY_LENGTH) * dt;
    if (v.hp <= 0) { killVillager(g, v, 'died of sickness'); return; }
  }
  const housed = s.villagers.length <= g.housing;
  const target = clamp(45 + g.buildingHappy + g.law.happy + (housed ? 8 : -12) + (v.hunger > 40 ? 5 : -18) + s.karma / 8 - (v.sick ? 15 : 0) + (v.partner ? 5 : 0), 0, 100);
  v.happy += (target - v.happy) * dt * 0.01;

  // danger check a few times a second
  v._scan = (v._scan || 0) - dt;
  if (v._scan <= 0) {
    v._scan = 0.4 + Math.random() * 0.2;
    reactToDanger(g, v);
  }

  if (!v._task) chooseTask(g, v);
  if (v._task) runTask(g, v, dt);
}

function reactToDanger(g, v) {
  const t = v._task;
  if (t?.type === 'fight' || t?.type === 'flee') return;
  const range = v.job === 'warrior' ? TILE * 12 : TILE * 3;
  let nearest = null, nd = Infinity;
  for (const c of g.state.creatures) {
    if (!CREATURES[c.t].hostile) continue;
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < nd) { nd = d; nearest = c; }
  }
  if (!nearest || nd > range) return;
  // courage in numbers: three or more adults nearby will gang up on a beast
  const allies = g.state.villagers.filter(o => !o.away && o.age >= ADULT_AGE && o.hp > 30 && Math.hypot(o.x - nearest.x, o.y - nearest.y) < TILE * 6).length;
  const fighter = v.job === 'warrior' || v.traits.includes('brave') || has(v, 'knighted') || allies >= 3;
  const scared = v.age < ADULT_AGE || v.traits.includes('coward')
    || (!fighter && (v.hp < 30 || CREATURES[nearest.t].hp > 45));
  setTask(v, scared ? { type: 'flee', target: nearest, timer: 3 } : { type: 'fight', target: nearest, phase: 'move' });
  v._emote = { key: 'effects/emote_alert', life: 1.5 };
}

function setTask(v, task) {
  releaseTask(v);
  v._task = { phase: 'move', timer: 0, ...task };
}

function releaseTask(v) {
  const t = v._task;
  if (t?.target?.obj && t.target.obj._res === v.id) delete t.target.obj._res;
  v._task = null;
}

// ------------------------------------------------------------------ choosing work

function chooseTask(g, v) {
  const s = g.state;
  if (v._cooldown > 0) { v._cooldown -= 0.1; wander(g, v, 3); return; }

  if (v.sick && g.hasBuilding('healer_hut')) {
    const hut = nearestBuilding(g, v, b => b.type === 'healer_hut');
    if (hut) { setTask(v, { type: 'heal', building: hut, ...standAt(g, hut) }); return; }
  }

  if (v.hunger < 35) {
    if (s.resources.food >= FOOD_PER_MEAL) {
      const spot = nearestBuilding(g, v, b => ['campfire', 'stockpile', 'granary', 'tavern'].includes(b.type), 30);
      const pos = spot ? standAt(g, spot) : { x: v.x, y: v.y };
      setTask(v, { type: 'eat', ...pos });
      return;
    }
    if (v.age >= ADULT_AGE && tryGather(g, v)) return;
  }

  if (v.age < ADULT_AGE) { wander(g, v, 4); return; }

  if (g.isNight && v.job !== 'warrior') {
    const home = nearestBuilding(g, v, b => BUILDINGS[b.type].housing || b.type === 'campfire', 40);
    const pos = home ? standAt(g, home) : { x: v.x, y: v.y };
    setTask(v, { type: 'rest', ...pos });
    return;
  }

  // construction sites builders can reach (a site nobody can walk to is skipped for a while, so it can't stall the rest)
  const unbuilt = s.buildings.filter(b => !b.built && !(b._noPathUntil > s.time));
  if (unbuilt.length && (v.job === 'build' || v.job === 'idle')) {
    const b = pickSite(g, v, unbuilt);
    setTask(v, { type: 'build', building: b, ...standAt(g, b) });
    return;
  }

  switch (v.job) {
    case 'chop': if (tryObject(g, v, 'chop', 45)) return; break;
    case 'gather': if (tryGather(g, v)) return; break;
    case 'mine': {
      const mine = freeWorkplace(g, v, 'mine');
      if (mine) { setTask(v, { type: 'deepmine', building: mine, ...standAt(g, mine) }); return; }
      if (tryObject(g, v, 'mine', 50)) return;
      break;
    }
    case 'farm': {
      const farm = freeWorkplace(g, v, 'farm');
      if (farm) { setTask(v, { type: 'farm', building: farm, ...standAt(g, farm, true) }); return; }
      if (tryGather(g, v)) return;
      break;
    }
    case 'fish': {
      const hut = freeWorkplace(g, v, 'fish');
      if (hut) { setTask(v, { type: 'fish', building: hut, ...standAt(g, hut) }); return; }
      if (tryGather(g, v)) return;
      break;
    }
    case 'hunt': {
      const prey = nearestOf(v, s.creatures.filter(c => {
        const d = CREATURES[c.t];
        return d.food && !d.water && !d.hostile && !d.flying && !dangerAt(g, c.x, c.y);
      }), c => c, TILE * 35);
      if (prey) { setTask(v, { type: 'hunt', target: prey, phase: 'move' }); return; }
      if (tryGather(g, v)) return;
      break;
    }
    case 'spy': {
      if ((v.skills.stealth || 0) < 3) {
        const den = freeWorkplace(g, v, 'spytrain');
        if (den) { setTask(v, { type: 'spytrain', building: den, ...standAt(g, den) }); return; }
      }
      // trained spies keep watch in the shadows around the village
      const p = g.randomLandTile(4, 12);
      if (p) { setTask(v, { type: 'patrol', x: p.x, y: p.y, wait: 4 + Math.random() * 4 }); return; }
      break;
    }
    case 'prisoner': {
      const cell = nearestBuilding(g, v, b => b.type === 'prison' || b.type === 'jail', 80);
      const c = cell ? g.buildingCenter(cell) : g.center;
      setTask(v, { type: 'wander', x: c.x + (Math.random() - 0.5) * TILE, y: c.y + TILE * 0.6, wait: 8 });
      return;
    }
    case 'recruit': {
      const yard = freeWorkplace(g, v, 'train');
      if (yard) { setTask(v, { type: 'train', building: yard, ...standAt(g, yard, true) }); return; }
      break;
    }
    case 'ruler':
    case 'smith': {
      if (v.job === 'ruler') {
        const c = g.center;
        setTask(v, { type: 'wander', x: c.x + (Math.random() - 0.5) * TILE * 3, y: c.y + (Math.random() - 0.5) * TILE * 3, wait: 5 + Math.random() * 5 });
        return;
      }
      const forge = freeWorkplace(g, v, 'smith');
      if (forge) { setTask(v, { type: 'craft', building: forge, ...standAt(g, forge) }); return; }
      if (tryGather(g, v)) return;
      break;
    }
    case 'official': {
      const c = g.center;
      setTask(v, { type: 'wander', x: c.x + (Math.random() - 0.5) * TILE * 4, y: c.y + (Math.random() - 0.5) * TILE * 4, wait: 4 + Math.random() * 4 });
      return;
    }
    case 'warrior': {
      const c = g.center;
      setTask(v, { type: 'patrol', x: c.x + (Math.random() - 0.5) * TILE * 10, y: c.y + (Math.random() - 0.5) * TILE * 10 });
      return;
    }
    case 'scout': {
      // walk the borders, pausing to watch the horizon
      const p = g.randomLandTile(10, 17);
      if (p) { setTask(v, { type: 'patrol', x: p.x, y: p.y, wait: 3 + Math.random() * 4 }); return; }
      break;
    }
    case 'explore': {
      const ruins = nearestOf(v, s.objects.filter(o => o.t === 'ruins' && !o._res), o => tileCenter(o), TILE * 80);
      if (ruins) {
        ruins._res = v.id;
        setTask(v, { type: 'explore', target: { obj: ruins, def: OBJECTS.ruins }, ...besideObject(ruins) });
      } else {
        const p = g.randomLandTile(18, 32);
        if (p) setTask(v, { type: 'explore', target: null, ...p });
      }
      return;
    }
  }
  // nothing to do: help build, else hang around the fire
  if (unbuilt.length) {
    const b = pickSite(g, v, unbuilt);
    setTask(v, { type: 'build', building: b, ...standAt(g, b) });
    return;
  }
  wander(g, v, 5);
}

/** Nearest construction site, but spread out: each builder already working a site makes it count as further away. */
function pickSite(g, v, sites) {
  const crew = new Map();
  for (const x of g.state.villagers) if (x !== v && x._task?.type === 'build') crew.set(x._task.building, (crew.get(x._task.building) || 0) + 1);
  let best = null, bd = Infinity;
  for (const b of sites) {
    const c = g.buildingCenter(b);
    const d = Math.hypot(c.x - v.x, c.y - v.y) + (crew.get(b) || 0) * TILE * 4;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function tryGather(g, v) { return tryObject(g, v, 'gather', 40); }

/** Wild predators make the ground around them off-limits for ordinary work. */
function dangerAt(g, x, y) {
  for (const c of g.state.creatures) {
    if (CREATURES[c.t].hostile && Math.hypot(c.x - x, c.y - y) < TILE * 7) return true;
  }
  return false;
}

function tryObject(g, v, work, maxTiles) {
  const obj = nearestOf(v, g.state.objects.filter(o => {
    if (OBJECTS[o.t].work !== work || o._res || (OBJECTS[o.t].charges != null && o.charges <= 0)) return false;
    const p = tileCenter(o);
    return Math.hypot(p.x - v.x, p.y - v.y) < TILE * maxTiles && !dangerAt(g, p.x, p.y);
  }), o => tileCenter(o), TILE * maxTiles);
  if (!obj) return false;
  obj._res = v.id;
  setTask(v, { type: work, target: { obj, def: OBJECTS[obj.t] }, ...besideObject(obj) });
  return true;
}

function freeWorkplace(g, v, kind) {
  const places = g.builtBuildings().filter(b => BUILDINGS[b.type].workplace === kind && !(b.blightUntil > g.state.time));
  const counts = new Map();
  for (const x of g.state.villagers) {
    const b = x._task?.building;
    if (b) counts.set(b, (counts.get(b) || 0) + 1);
  }
  const free = places.filter(b => (counts.get(b) || 0) < BUILDINGS[b.type].slots);
  return nearestOf(v, free, b => g.buildingCenter(b));
}

function wander(g, v, radiusTiles) {
  const c = v.age < ADULT_AGE || v.job === 'idle' ? g.center : { x: v.x, y: v.y };
  for (let i = 0; i < 6; i++) {
    const x = c.x + (Math.random() - 0.5) * TILE * radiusTiles * 2;
    const y = c.y + (Math.random() - 0.5) * TILE * radiusTiles * 2;
    if (g.world.walkable(x, y)) { setTask(v, { type: 'wander', x, y, wait: 1 + Math.random() * 3 }); return; }
  }
}

// ------------------------------------------------------------------ running tasks

function runTask(g, v, dt) {
  const t = v._task;
  const s = g.state;

  switch (t.type) {
    case 'wander':
    case 'patrol':
      if (t.phase === 'move') {
        const r = moveTo(g, v, t.x, t.y, dt);
        if (r === 'fail') return releaseTask(v);
        if (r === 'arrived') { t.phase = 'wait'; t.timer = t.wait ?? 2; }
      } else if ((t.timer -= dt) <= 0) releaseTask(v);
      return;

    case 'flee': {
      // run away from the threat, bending toward the village where others can help
      const c = t.target;
      const cen = g.center;
      const ax = v.x - c.x, ay = v.y - c.y, ad = Math.hypot(ax, ay) || 1;
      const hx = cen.x - v.x, hy = cen.y - v.y, hd = Math.hypot(hx, hy) || 1;
      const home = hd > TILE * 2 ? 0.9 : 0;
      let dx = ax / ad + (hx / hd) * home, dy = ay / ad + (hy / hd) * home;
      const dd = Math.hypot(dx, dy) || 1;
      const sp = walkSpeed(g, v) * 1.25 * dt;
      const nx = v.x + (dx / dd) * sp, ny = v.y + (dy / dd) * sp;
      if (g.world.walkable(nx, ny)) { v.x = nx; v.y = ny; }
      else if (g.world.walkable(nx, v.y)) v.x = nx;
      else if (g.world.walkable(v.x, ny)) v.y = ny;
      v._walking = true; v._flip = dx < 0;
      t.timer -= dt;
      const safe = !s.creatures.includes(c) || ad > TILE * 8;
      if (safe || t.timer <= -6) releaseTask(v);
      return;
    }

    case 'fight': {
      const c = t.target;
      if (!s.creatures.includes(c)) return releaseTask(v);
      const d = Math.hypot(c.x - v.x, c.y - v.y);
      if (d > TILE * 18) return releaseTask(v);
      if (d > TILE * 0.9) {
        t.phase = 'move';
        chase(g, v, c, dt);
      } else {
        t.phase = 'work';
        v._flip = c.x < v.x;
        t.timer -= dt;
        if (t.timer <= 0) {
          t.timer = 1;
          let dmg = (4 + v.skills.combat * 1.2) * (1 + g.combatBonus);
          if (v.job === 'warrior') dmg *= v.armed ? 1.8 : 0.7;   // bare fists are no match for a blade
          if (!isTrained(v)) dmg *= 0.6;                           // untrained militia swing wildly
          if (has(v, 'cruel')) dmg *= 1.2;
          if (has(v, 'veteran')) dmg *= 1.3;
          if (has(v, 'knighted')) dmg *= 1.25;
          if (v.traits.includes('brave')) dmg *= 1.5;
          if (v.age >= ELDER_AGE) dmg *= 0.6;
          gainSkill(g, v, 'combat');
          damageCreature(g, c, dmg, v);
        }
      }
      return;
    }

    case 'hunt': {
      const c = t.target;
      if (!s.creatures.includes(c)) return releaseTask(v);
      const d = Math.hypot(c.x - v.x, c.y - v.y);
      if (t.phase === 'move') {
        if (d > TILE * 50) return releaseTask(v);
        if (d > TILE * 0.8) { chase(g, v, c, dt); return; }
        t.phase = 'work';
        t.timer = WORK_TIME.hunt / workSpeed(g, v);
        c._stunned = t.timer + 0.5;
      }
      if ((t.timer -= dt) <= 0) {
        rollFate(g, 'hunt', v, c);
        releaseTask(v);
      }
      return;
    }

    case 'eat':
    case 'rest':
    case 'heal':
    default:
      break;
  }

  // generic: walk to a spot, then work for a while
  if (t.phase === 'move') {
    let r = moveTo(g, v, t.x, t.y, dt);
    if (r === 'fail' && (t.type === 'eat' || t.type === 'rest')) r = 'arrived';   // eat/sleep where you stand
    if (r === 'fail' && t.type === 'build' && t.building) {
      const c = g.buildingCenter(t.building), size = sizeOf(t.building);
      if (Math.hypot(c.x - v.x, c.y - v.y) < (size / 2 + 3) * TILE) r = 'arrived';   // close enough: build from here
      else t.building._noPathUntil = s.time + 30;                                    // unreachable for now: try other sites
    }
    if (r === 'fail') { v._cooldown = 1; return releaseTask(v); }
    if (r !== 'arrived') return;
    t.phase = 'work';
    t.timer = (WORK_TIME[t.type] || 4) / workSpeed(g, v);
    if (t.building) v._flip = g.buildingCenter(t.building).x < v.x;
    else if (t.target?.obj) v._flip = tileCenter(t.target.obj).x < v.x;
  }

  switch (t.type) {
    case 'eat':
      if ((t.timer -= dt) > 0) return;
      if (s.resources.food >= FOOD_PER_MEAL) {
        if (Math.random() >= -g.law.food) s.resources.food -= FOOD_PER_MEAL;   // rationing skips some meals' cost
        v.hunger = Math.min(100, v.hunger + MEAL_RESTORES);
      }
      if (v.hunger < 60 && s.resources.food >= FOOD_PER_MEAL) t.timer = 1.5;
      else releaseTask(v);
      return;

    case 'rest':
      if (!v._emote) v._emote = { key: 'effects/emote_sleep', life: 2 };
      v.happy = Math.min(100, v.happy + dt * 0.02);
      if (!g.isNight) releaseTask(v);
      return;

    case 'heal':
      if ((t.timer -= dt) > 0) return;
      v.sick = 0;
      v.hp = Math.min(Math.max(100, v.hp), v.hp + 30);
      g.float(v.x, v.y - TILE, 'Healed', '#9dff8a');
      releaseTask(v);
      return;

    case 'build': {
      const b = t.building;
      if (!s.buildings.includes(b) || b.built) return releaseTask(v);
      const def = BUILDINGS[b.type];
      b.progress += (dt * workSpeed(g, v)) / def.work;
      t.fateTimer = (t.fateTimer || 0) + dt;
      if (t.fateTimer > 6) { t.fateTimer = 0; rollFate(g, 'build', v, b); if (!s.villagers.includes(v)) return; }
      if (Math.random() < dt * 2) g.puff({ x: t.x, y: t.y - 8 }, 'effects/dust', 1, 20);
      if (b.progress >= 1) {
        gainSkill(g, v, 'build');
        g.finishBuilding(b);
        releaseTask(v);
      }
      return;
    }

    case 'chop':
    case 'mine':
    case 'gather': {
      const { obj } = t.target;
      if (!s.objects.includes(obj) || (OBJECTS[obj.t].work !== t.type)) return releaseTask(v);
      if ((t.timer -= dt) > 0) return;
      rollFate(g, t.type, v, t.target);
      consumeObject(g, obj, t.type);
      releaseTask(v);
      return;
    }

    case 'spytrain': {
      if ((t.timer -= dt) > 0) return;
      if (!s.buildings.includes(t.building)) return releaseTask(v);
      for (let i = 0; i < 6; i++) gainSkill(g, v, 'stealth', i < 5);
      if ((v.skills.stealth || 0) >= 3 && !v.spyTrained) {
        v.spyTrained = true;
        g.log(`${v.name} has finished training as a spy.`, 'good');
      }
      releaseTask(v);
      return;
    }

    case 'train': {
      if ((t.timer -= dt) > 0) return;
      if (!s.buildings.includes(t.building)) return releaseTask(v);
      for (let i = 0; i < 6; i++) gainSkill(g, v, 'combat', i < 5);
      if (!v.trained && isTrained(v)) {
        v.trained = true;
        g.float(v.x, v.y - TILE, 'Training complete!', '#ffd76a');
        g.log(`${v.name} has completed training and can now serve as a warrior.`, 'good');
        if (v.job === 'recruit') assignJob(g, v, 'warrior', !v.manual);
      }
      releaseTask(v);
      return;
    }

    case 'craft': {
      if ((t.timer -= dt) > 0) return;
      const recipe = BUILDINGS[t.building.type]?.recipe;
      if (!recipe || !s.buildings.includes(t.building)) return releaseTask(v);
      if (!g.canAfford(recipe.cost)) {
        const need = Object.entries(recipe.cost).filter(([k, n]) => s.resources[k] < n).map(([k]) => k).join(', ');
        g.float(v.x, v.y - TILE, `Needs ${need}`, '#ffb44a');
        v._cooldown = 6;
        return releaseTask(v);
      }
      const outRes = recipe.res || 'weapons';
      if (s.resources[outRes] >= (g.caps[outRes] || Infinity)) {
        g.float(v.x, v.y - TILE, 'Storage full', '#ffb44a');
        v._cooldown = 6;
        return releaseTask(v);
      }
      g.spend(recipe.cost);
      // tools first: someone working without the tool of their trade gets one
      const needy = s.villagers.find(x => x.age >= ADULT_AGE && !x.away && TRADE_TOOL[x.profession] && !x.inv?.pack?.[TRADE_TOOL[x.profession]]);
      if (needy) {
        const tool = TRADE_TOOL[needy.profession];
        addItem(needy, tool, 1);
        gainSkill(g, v, 'craft', true);
        g.float(v.x, v.y - TILE, `${ITEM_NAMES[tool] || tool} for ${needy.name}`, '#ffd76a');
        releaseTask(v);
        return;
      }
      rollFate(g, 'craft', v, t.building);
      releaseTask(v);
      return;
    }

    case 'deepmine':
    case 'farm':
    case 'fish':
      if ((t.timer -= dt) > 0) return;
      if (t.type === 'farm' && t.building.blightUntil > s.time) return releaseTask(v);
      rollFate(g, (t.type === 'deepmine' && BUILDINGS[t.building.type]?.outcome) || t.type, v, t.building);
      releaseTask(v);
      return;

    case 'explore':
      if ((t.timer -= dt) > 0) return;
      rollFate(g, 'explore', v, t.target);
      if (t.target?.obj && s.objects.includes(t.target.obj)) g.world.removeObject(s.objects, t.target.obj);
      if (s.villagers.includes(v)) {
        v.job = 'idle';
        const c = g.center;
        releaseTask(v);
        setTask(v, { type: 'wander', x: c.x, y: c.y, wait: 1 });
      }
      return;
  }
}

function consumeObject(g, obj, work) {
  const s = g.state;
  const def = OBJECTS[obj.t];
  if (work === 'chop') {
    s.stats.treesCut = (s.stats.treesCut || 0) + 1;
    if (def.stump) { obj.t = 'tree_stump'; obj.growAt = s.time + OBJECTS.tree_stump.growDays * DAY_LENGTH; }
    else g.world.removeObject(s.objects, obj);
    g.puff(tileCenter(obj), 'effects/leaf', 5);
    return;
  }
  obj.charges = (obj.charges || 1) - 1;
  if (obj.charges <= 0 && !def.regrowDays) g.world.removeObject(s.objects, obj);
  g.puff(tileCenter(obj), work === 'mine' ? 'effects/rock_chunk' : 'effects/leaf', 4);
}

// ------------------------------------------------------------------ movement helpers

export function walkSpeed(g, v) {
  let sp = WALK_SPEED * (1 + g.speedBonus);
  if (v.age < ADULT_AGE) sp *= 0.85;
  if (v.age >= ELDER_AGE) sp *= 0.7;
  if (v.sick) sp *= 0.7;
  if (v.hunger <= 0) sp *= 0.7;
  if (has(v, 'nimble')) sp *= 1.2;
  return sp;
}

function workSpeed(g, v) {
  let m = 1;
  if (v.traits.includes('strong')) m *= 1.3;
  if (v.traits.includes('lazy')) m *= 0.7;
  if (has(v, 'hardworking')) m *= 1.2;
  if (v.age >= ELDER_AGE) m *= 0.65;
  if (v.sick) m *= 0.5;
  if (v.happy > 70) m *= 1.1;
  else if (v.happy < 25) m *= 0.8;
  if (g.state.karma <= -60) m *= 1.1;   // tyrants rule by fear
  m *= Math.max(0.3, 1 + g.law.work + (g.ruler?.work || 0));
  const t = v._task;
  if (t) m *= 1 + (v.skills[t.type === 'deepmine' ? 'mine' : t.type] || 0) * 0.06;
  if (t?.type === 'build') m *= (1 + (g.bonus.build || 0)) * (v.profession === 'build' ? 2.5 : 1.3);   // builders by trade are much faster
  if (t && TASK_TOOL[t.type]) m *= hasToolFor(v, t.type) ? 1.25 : 0.8;   // the right tool makes all the difference
  m *= 1 + (g.workBonus || 0);
  if (v.robot) m *= 1.2;
  return m;
}

function moveTo(g, v, x, y, dt) {
  const t = v._task;
  if (!t.path) {
    t.path = g.world.findPath(v.x, v.y, x, y);
    if (!t.path) return 'fail';
  }
  let remaining = walkSpeed(g, v) * dt;
  while (remaining > 0 && t.path.length) {
    const wp = t.path[0];
    const dx = wp.x - v.x, dy = wp.y - v.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) v._flip = dx < 0;
    if (d <= remaining) { v.x = wp.x; v.y = wp.y; remaining -= d; t.path.shift(); }
    else { v.x += (dx / d) * remaining; v.y += (dy / d) * remaining; remaining = 0; }
  }
  v._walking = true;
  return t.path.length ? 'moving' : 'arrived';
}

function chase(g, v, c, dt) {
  const t = v._task;
  t.repath = (t.repath || 0) - dt;
  if (!t.path || t.repath <= 0) {
    t.repath = 1;
    t.path = g.world.findPath(v.x, v.y, c.x, c.y, 2500);
    if (!t.path) { releaseTask(v); v._cooldown = 1; return; }
  }
  moveTo(g, v, c.x, c.y, dt);
}

function tileCenter(o) { return { x: o.x * TILE + TILE / 2, y: o.y * TILE + TILE / 2 }; }

function besideObject(o) {
  const side = Math.random() < 0.5 ? -1 : 1;
  return { x: o.x * TILE + TILE / 2 + side * 14, y: o.y * TILE + TILE * 0.85 };
}

/** A walkable spot along the front edge of a building. */
function standAt(g, b, inside = false) {
  const size = sizeOf(b);
  if (inside) {
    return { x: (b.tx + Math.random() * size) * TILE, y: (b.ty + 0.3 + Math.random() * (size - 0.3)) * TILE };
  }
  for (let i = 0; i < 8; i++) {
    const x = (b.tx + Math.random() * size) * TILE;
    const y = (b.ty + size) * TILE + 6;
    if (g.world.walkable(x, y)) return { x, y };
  }
  const c = g.buildingCenter(b);
  return { x: c.x, y: c.y + (size / 2) * TILE };
}

function nearestBuilding(g, v, pred, maxTiles = 60) {
  return nearestOf(v, g.builtBuildings().filter(pred), b => g.buildingCenter(b), TILE * maxTiles);
}

function nearestOf(v, list, posOf, maxDist = Infinity) {
  let best = null, bd = maxDist;
  for (const item of list) {
    const p = posOf(item);
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < bd) { bd = d; best = item; }
  }
  return best;
}

export function returnHome(g, v) {
  const c = g.center;
  v.away = null;
  v.x = c.x + (Math.random() - 0.5) * TILE * 3;
  v.y = c.y + (Math.random() - 0.5) * TILE * 3;
  v.hunger = Math.max(v.hunger, 40);
  g.puff(v, 'effects/dust', 4);
}

/** Villagers physically in the village (not away marching). */
export const present = g => g.state.villagers.filter(v => !v.away);

/** Player-issued order from the UI. */
/** auto = ordered by the Court; otherwise it is the ruler's own order and the Steward leaves it alone. */
export function assignJob(g, v, job, auto = false) {
  if (!JOBS[job] || v.age < ADULT_AGE || v.away || v.office || v.ruling || v.jailed) return false;
  // people stick to their own trade; only a Jack of all trades can take any job
  if (!canDoJob(v, job)) { g.lastJobError = `${v.name} is a ${professionLabel(v)} — only a Jack of all trades can switch trades`; return false; }
  if (job === 'warrior' && !isTrained(v)) {
    // only trained soldiers can be warriors: send them to drill instead
    if (!g.hasBuilding('training_ground') && !g.hasBuilding('barracks')) { g.lastJobError = `${v.name} is untrained — build a Training Ground to train recruits`; return false; }
    job = 'recruit';
  }
  if (!auto) v.manual = job !== 'idle';
  if (v.armed && job !== 'warrior') { v.armed = false; g.state.resources.weapons += 1; }
  v.job = job;
  releaseTask(v);
  g.emit('change');
  return true;
}
