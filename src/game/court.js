import { ADULT_AGE } from '../core/constants.js';
import { clamp } from '../core/rng.js';
import { BUILDINGS } from '../data/buildings.js';
import { assignJob } from './villagers.js';
import { isTrained } from './dynasty.js';
import { canDoJob, ensureProfession, isVersatile } from './professions.js';
import { bestForOffice } from './employment.js';

/*
 * The Court: villagers you appoint to run the realm for you.
 * Officials stop doing ordinary work, and each one manages one part of the village.
 */
export const OFFICES = {
  steward: {
    name: 'Steward', icon: 'characters/elder', requires: ['campfire'],
    desc: 'Puts everyone you have not given orders to to work in their own trade, sends Jacks of all trades where hands are needed, and tells you which workplaces are missing.',
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
      // the official died (or left): the realm appoints the best successor at once
      c.id = null;
      const heir = bestForOffice(g, key);
      if (heir && !appoint(g, key, heir).error) g.log(`The ${OFFICES[key].name} is gone. ${heir.name} takes up the office.`, 'event');
      else g.log(`The office of ${OFFICES[key].name} stands empty: nobody is fit to serve.`, 'bad');
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
export function managed(g, { keepWarriors = true, keepScouts = true } = {}) {
  return g.state.villagers.filter(v => v.age >= ADULT_AGE && !v.away && !v.office && !v.ruling && !v.manual && v.hp > 0 && v.job !== 'recruit'
    && !(keepWarriors && v.job === 'warrior') && !(keepScouts && v.job === 'scout') && !v.prevJob);
}

/** Give each job its target count, moving as few people as possible. */
export function distribute(g, pool, targets) {
  const want = { ...targets };
  const unplaced = [];
  for (const v of pool) {
    if ((want[v.job] || 0) > 0) want[v.job]--;
    else unplaced.push(v);
  }
  let moved = 0;
  for (const v of unplaced) {
    const job = Object.keys(want).find(j => want[j] > 0 && canDoJob(v, j));   // only jobs in their trade
    if (!job) continue;
    want[job]--;
    if (v.job !== job) { assignJob(g, v, job, true); moved++; }
  }
  return moved;
}

export function slots(g, kind) {
  return g.builtBuildings().filter(b => BUILDINGS[b.type].workplace === kind).reduce((n, b) => n + (BUILDINGS[b.type].slots || 1), 0);
}

// trades that need a workplace, and what to build when there are too few
export const TRADE_WORKPLACE = {
  farm: { kind: 'farm', build: ['farm', 'orchard'] },
  fish: { kind: 'fish', build: ['fishing_hut', 'harbor'] },
  smith: { kind: 'smith', build: ['craft_hut', 'blacksmith', 'weaponsmith'] },
  spy: { kind: 'spytrain', build: ['spy_den'] },
};

/**
 * Put people to work in their own trade. Trades that need a workplace (farms, fishing huts, forges) only take
 * as many as there are places; the rest gather food until more are built. Jacks of all trades fill the gaps.
 * Returns { moved, shortages: { trade: people without a place } }.
 */
export function workTrades(g, pool, focus = 'balanced') {
  const s = g.state;
  const room = {};
  for (const [trade, w] of Object.entries(TRADE_WORKPLACE)) room[trade] = slots(g, w.kind);
  const trainingPlace = g.builtBuildings().some(b => BUILDINGS[b.type].workplace === 'train');
  const shortages = {};
  const plan = new Map();
  const flexible = [];

  // people who already work in a limited trade keep their place first, so nobody is shuffled around
  const ordered = [...pool].sort((a, b) => (b.job === ensureProfession(b)) - (a.job === ensureProfession(a)));
  for (const v of ordered) {
    if (isVersatile(v)) { flexible.push(v); continue; }
    const trade = ensureProfession(v);
    let job = trade;
    if (trade === 'warrior') job = v.trained ? null : trainingPlace ? 'recruit' : 'gather';   // trained soldiers are the Marshal's
    if (!job) continue;
    if (room[job] != null) {
      if (room[job] > 0) room[job]--;
      else { shortages[job] = (shortages[job] || 0) + 1; job = 'gather'; }
    }
    plan.set(v, job);
  }

  // Jacks of all trades go where the realm needs hands most
  const r = s.resources, pop = s.villagers.length;
  const hungry = r.food < pop * 4 || focus === 'food' || focus === 'growth';
  const unbuilt = s.buildings.filter(b => !b.built).length;
  const count = {};
  for (const j of plan.values()) count[j] = (count[j] || 0) + 1;
  for (const v of flexible) {
    let job;
    if (unbuilt && (count.build || 0) < Math.min(unbuilt * 2, 6)) job = 'build';          // unfinished construction first
    else if (hungry && room.farm > 0) { job = 'farm'; room.farm--; }
    else if (hungry && room.fish > 0) { job = 'fish'; room.fish--; }
    else if (hungry) job = 'gather';
    else if (focus === 'stone') job = 'mine';
    else if (focus === 'wood') job = 'chop';
    else job = (count.chop || 0) <= (count.mine || 0) ? 'chop' : 'mine';
    count[job] = (count[job] || 0) + 1;
    plan.set(v, job);
  }

  let moved = 0;
  for (const [v, job] of plan) if (v.job !== job && assignJob(g, v, job, true)) moved++;
  return { moved, shortages };
}

const RUN = {
  steward(g, c) {
    const s = g.state;
    if (s.rallied) return;
    // the Employment Office's job targets take priority over the Steward's own plan
    if (g.hasBuilding('employment_office') && s.employment?.on && Object.values(s.employment.targets || {}).some(n => n > 0)) return;
    const pool = managed(g);
    if (!pool.length) return;
    const { moved, shortages } = workTrades(g, pool, c.focus);
    c.shortages = shortages;
    if (moved >= 2) g.log(`Steward: put ${moved} villagers to work in their trades.`, 'info');
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
    // workplaces for people whose trade has nowhere to work (the Steward reports them)
    const short = Object.entries(s.court?.steward?.shortages || {}).sort((a, b) => b[1] - a[1]);
    const roomiest = list => [...list].filter(t => BUILDINGS[t]).sort((a, b) => (BUILDINGS[b].slots || 1) - (BUILDINGS[a].slots || 1));
    for (const [trade, n] of short) if (n >= 2 && TRADE_WORKPLACE[trade] && tryTypes(roomiest(TRADE_WORKPLACE[trade].build))) return;
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
      // the Marshal only enlists people meant for war: the Soldier calling, trained fighters, or brave volunteers
      const recruits = managed(g).filter(v => v.hp > 50 && (v.calling === 'soldier' || v.trained || v.profession === 'warrior') && canDoJob(v, 'warrior'))
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

