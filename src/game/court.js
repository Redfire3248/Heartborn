import { ADULT_AGE } from '../core/constants.js';
import { clamp } from '../core/rng.js';
import { BUILDINGS } from '../data/buildings.js';
import { assignJob } from './villagers.js';
import { isTrained } from './dynasty.js';

/*
 * The Court: villagers you appoint to run the realm for you.
 * Officials stop doing ordinary work, and each one manages one part of the village.
 */
export const OFFICES = {
  steward: {
    name: 'Steward', icon: 'characters/elder', requires: ['campfire'],
    desc: 'Assigns jobs to everyone you have not given orders to: builders, farmers, smiths, woodcutters and miners.',
    options: { focus: [['balanced', 'Balanced'], ['food', 'Food first'], ['wood', 'Wood'], ['stone', 'Stone & ore'], ['growth', 'Growth']] },
  },
  master_builder: {
    name: 'Master Builder', icon: 'characters/blacksmith', requires: ['campfire'],
    desc: 'Orders new homes before people run out of room, farms when food runs low, and storage when it fills up.',
    options: { plan: [['all', 'Homes, farms & storage'], ['homes', 'Homes only'], ['economy', 'Farms & storage only']] },
  },
  marshal: {
    name: 'Marshal', icon: 'characters/warrior', requires: ['barracks', 'training_ground', 'craft_hut'],
    desc: 'Keeps an army of armed warriors, sends smiths to the forge when weapons run short, and rallies the militia when enemies are spotted.',
    options: { army: [['0.1', 'Small guard (10%)'], ['0.2', 'Standing army (20%)'], ['0.35', 'War footing (35%)']] },
  },
  spymaster: {
    name: 'Spymaster', icon: 'characters/hunter', requires: ['watchtower', 'guard_post', 'observatory'],
    desc: 'Trains scouts and runs a web of informants. Enemy armies are far more likely to be spotted early.',
  },
  treasurer: {
    name: 'Treasurer', icon: 'characters/merchant', requires: ['market', 'town_hall'],
    desc: 'Collects taxes wisely: +25% gold from buildings and +2 influence every day.',
  },
  high_priest: {
    name: 'High Priest', icon: 'characters/priest', requires: ['shrine', 'chapel'],
    desc: '+10% luck. When the people grow miserable, the priest leads a blessing (costs 20 influence).',
  },
};

export const ROLE_SPRITE = {
  steward: 'characters/elder', master_builder: 'characters/blacksmith', marshal: 'characters/warrior',
  spymaster: 'characters/hunter', treasurer: 'characters/merchant', high_priest: 'characters/priest',
};

const TICK = { steward: 12, master_builder: 20, marshal: 10, spymaster: 20, high_priest: 30 };

export function officeUnlocked(g, key) {
  const req = OFFICES[key].requires;
  return !req.length || req.some(t => g.hasBuilding(t));
}

export function officialOf(g, key) {
  const id = g.state.court?.[key]?.id;
  return id ? g.state.villagers.find(v => v.id === id) || null : null;
}

export function appoint(g, key, v) {
  const s = g.state;
  if (!OFFICES[key]) return { error: 'Unknown office' };
  if (!officeUnlocked(g, key)) return { error: `Requires a ${OFFICES[key].requires.map(t => BUILDINGS[t]?.name).join(' or ')}` };
  if (!v || v.age < ADULT_AGE || v.away) return { error: 'Only adults at home can serve' };
  const prev = officialOf(g, key);
  if (prev) dismiss(g, key, true);
  if (v.office) dismiss(g, v.office, true);
  s.court ||= {};
  const defaults = Object.fromEntries(Object.entries(OFFICES[key].options || {}).map(([k, opts]) => [k, s.court[key]?.[k] || opts[0][0]]));
  s.court[key] = { id: v.id, ...defaults };
  unarm(g, v);
  v.office = key;
  v.job = 'official';
  v._task = null;
  v.happy = clamp(v.happy + 15, 0, 100);
  g.log(`${v.name} is appointed ${OFFICES[key].name}.`, 'event');
  g.recalc();
  g.emit('change');
  return { ok: true };
}

export function dismiss(g, key, quiet = false) {
  const s = g.state;
  const v = officialOf(g, key);
  if (v) {
    v.office = null;
    v.job = 'idle';
    v.manual = false;
    v._task = null;
  }
  if (s.court?.[key]) s.court[key].id = null;
  if (!quiet && v) g.log(`${v.name} is dismissed as ${OFFICES[key].name}.`, 'info');
  g.recalc();
  g.emit('change');
}

export function setOfficeOption(g, key, opt, value) {
  const c = g.state.court?.[key];
  if (!c) return;
  c[opt] = value;
  g._courtTimers = {};   // act on the new orders right away
  g.emit('change');
}

// ------------------------------------------------------------------ weapons

export function arm(g, v) {
  if (v.armed || g.state.resources.weapons < 1) return false;
  g.state.resources.weapons -= 1;
  v.armed = true;
  return true;
}

export function unarm(g, v) {
  if (!v.armed) return;
  v.armed = false;
  g.state.resources.weapons += 1;
}

// ------------------------------------------------------------------ tick

export function updateCourt(g, dt) {
  const s = g.state;
  g._courtTimers ||= {};
  g._armTimer = (g._armTimer || 0) - dt;
  if (g._armTimer <= 0) {
    g._armTimer = 2;
    for (const v of s.villagers) {
      if (v.job === 'warrior' && !v.away) arm(g, v);
      else if (v.armed && v.job !== 'warrior' && !v.away) unarm(g, v);
    }
  }
  if (!s.court) return;

  for (const key of Object.keys(OFFICES)) {
    const c = s.court[key];
    if (!c?.id) continue;
    const official = officialOf(g, key);
    if (!official) {
      c.id = null;
      g.log(`The office of ${OFFICES[key].name} stands empty.`, 'bad');
      g.recalc();
      g.emit('change');
      continue;
    }
    if (!TICK[key]) continue;
    g._courtTimers[key] = (g._courtTimers[key] ?? 1) - dt;
    if (g._courtTimers[key] > 0) continue;
    g._courtTimers[key] = TICK[key];
    RUN[key](g, c, official);
  }
}

/** Adults the court may reassign: not officials, not away, not given manual orders. */
function managed(g, { keepWarriors = true, keepScouts = true } = {}) {
  return g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away && !v.office && !v.ruling && !v.manual && v.hp > 0 && v.job !== 'recruit'
    && !(keepWarriors && v.job === 'warrior') && !(keepScouts && v.job === 'scout') && !v.prevJob);
}

/** Give each job its target count, moving as few people as possible. */
function distribute(g, pool, targets) {
  const want = { ...targets };
  const unplaced = [];
  for (const v of pool) {
    if ((want[v.job] || 0) > 0) want[v.job]--;
    else unplaced.push(v);
  }
  let moved = 0;
  for (const v of unplaced) {
    const job = Object.keys(want).find(j => want[j] > 0);
    if (!job) break;
    want[job]--;
    if (v.job !== job) { assignJob(g, v, job, true); moved++; }
  }
  return moved;
}

function slots(g, kind) {
  return g.builtBuildings().filter(b => BUILDINGS[b.type].workplace === kind).reduce((n, b) => n + (BUILDINGS[b.type].slots || 1), 0);
}

const RUN = {
  steward(g, c) {
    const s = g.state;
    if (s.rallied) return;
    const pool = managed(g);
    if (!pool.length) return;
    const pop = s.villagers.length;
    const r = s.resources;
    const targets = {};
    let left = pool.length;
    const give = (job, n) => { n = Math.max(0, Math.min(left, Math.floor(n))); if (n) { targets[job] = (targets[job] || 0) + n; left -= n; } };

    const unbuilt = s.buildings.filter(b => !b.built).length;
    give('build', unbuilt ? Math.min(3, 1 + Math.floor(unbuilt / 2)) : 0);

    const hungry = r.food < pop * 4;
    const foodShare = c.focus === 'food' ? 0.5 : c.focus === 'growth' ? 0.42 : hungry ? 0.45 : 0.3;
    const foodWorkers = Math.ceil(pool.length * foodShare);
    const farm = Math.min(slots(g, 'farm'), foodWorkers);
    const fish = Math.min(slots(g, 'fish'), foodWorkers - farm);
    give('farm', farm);
    give('fish', fish);
    give('gather', Math.max(0, foodWorkers - farm - fish));

    const warriors = s.villagers.filter(v => v.job === 'warrior').length;
    const needWeapons = r.weapons < Math.max(4, warriors + 2) || s.court?.marshal?.id;
    const smithSlots = slots(g, 'smith');
    if (smithSlots && needWeapons) give('smith', 1);

    const miningSpots = slots(g, 'mine') + 2;
    const woodW = c.focus === 'wood' ? 0.7 : c.focus === 'stone' ? 0.3 : 0.55;
    const wood = Math.ceil(left * woodW);
    give('chop', wood);
    give('mine', Math.min(left, miningSpots + (c.focus === 'stone' ? 3 : 0)));
    give('chop', left);   // anyone still free cuts wood

    const moved = distribute(g, pool, targets);
    if (moved >= 2) g.log(`Steward: reassigned ${moved} villagers.`, 'info');
  },

  // (recruits are left to finish their training)
  master_builder(g, c) {
    const s = g.state;
    if (s.buildings.filter(b => !b.built).length >= 2) return;
    const pop = s.villagers.length;
    const order = type => {
      const spot = g.findBuildSpot(type);
      if (!spot) return false;
      const res = g.placeBuilding(type, spot.tx, spot.ty);
      if (res.ok) g.log(`Master Builder ordered a ${BUILDINGS[type].name}.`, 'event');
      return res.ok;
    };
    const tryTypes = types => types.some(t => BUILDINGS[t] && BUILDINGS[t].era <= s.era && g.canAfford(BUILDINGS[t].cost) && order(t));

    if (!g.hasBuilding('campfire') && !s.buildings.some(b => b.type === 'campfire') && tryTypes(['campfire'])) return;
    if (c.plan !== 'economy' && g.housing - pop <= 3 && tryTypes(['house', 'hut', 'tent'])) return;
    if (c.plan === 'homes') return;
    const farms = s.buildings.filter(b => BUILDINGS[b.type].workplace === 'farm').length;
    if (s.resources.food < pop * 5 && farms < Math.ceil(pop / 5) && tryTypes(['orchard', 'farm'])) return;
    const full = Object.entries(g.caps).some(([k, cap]) => s.resources[k] >= cap * 0.9);
    if (full && tryTypes(['warehouse', 'stockpile'])) return;
    if ((s.court?.marshal?.id || pop >= 8) && !s.buildings.some(b => BUILDINGS[b.type].workplace === 'smith') && tryTypes(['weaponsmith', 'craft_hut'])) return;
  },

  marshal(g, c) {
    const s = g.state;
    const pop = s.villagers.length;
    const target = Math.max(1, Math.round(pop * Number(c.army || 0.2)));
    const warriors = s.villagers.filter(v => (v.job === 'warrior' || v.job === 'recruit') && !v.away && !v.prevJob);
    if (warriors.length < target) {
      const recruits = managed(g).filter(v => v.hp > 50)
        .sort((a, b) => (b.skills.combat - a.skills.combat) || (b.traits.includes('brave') - a.traits.includes('brave')));
      for (const v of recruits.slice(0, target - warriors.length)) assignJob(g, v, isTrained(v) ? 'warrior' : 'recruit', true);
    } else if (warriors.length > target + 1) {
      for (const v of warriors.filter(v => !v.manual).slice(0, warriors.length - target)) assignJob(g, v, 'gather', true);
    }
    const unarmed = s.villagers.filter(v => v.job === 'warrior' && !v.armed).length;
    if (unarmed && slots(g, 'smith') && !s.villagers.some(v => v.job === 'smith')) {
      const smith = managed(g).sort((a, b) => b.skills.craft - a.skills.craft)[0];
      if (smith) { assignJob(g, smith, 'smith', true); g.log(`Marshal: ${smith.name} is sent to the forge — ${unarmed} warriors lack weapons.`, 'info'); }
    }
  },

  spymaster(g) {
    const s = g.state;
    const target = 1 + Math.floor(s.villagers.length / 15);
    const scouts = s.villagers.filter(v => v.job === 'scout' && !v.away).length;
    if (scouts < target) {
      const v = managed(g).sort((a, b) => a.age - b.age)[0];
      if (v) assignJob(g, v, 'scout', true);
    }
  },

  high_priest(g) {
    const s = g.state;
    if (!s.villagers.length) return;
    const avg = s.villagers.reduce((n, v) => n + v.happy, 0) / s.villagers.length;
    if (avg < 35 && g.spend({ influence: 20 })) {
      for (const v of s.villagers) v.happy = clamp(v.happy + 15, 0, 100);
      g.puff(g.center, 'effects/spark', 16, 60);
      g.log('High Priest leads a blessing. Spirits rise. (−20 influence)', 'event');
    }
  },
};

