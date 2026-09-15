import { professionFromCalling, TRADE_TOOL } from './professions.js';
import { ADULT_AGE, TILE } from '../core/constants.js';
import { clamp, chance, pick } from '../core/rng.js';
import { CALLINGS, RULER_TYPES, RULER_TITLES, ITEMS, TOOL_FOR_JOB } from '../data/people.js';
import { TRAITS, DYNASTY_NAMES } from '../data/traits.js';

/*
 * People and dynasty: the ruler and succession, callings for children, earned traits,
 * personal inventories, training, and the small ways you can shape a person.
 */

export const TRAINED_SKILL = 3;
export const isTrained = v => !!v.trained || (v.skills?.combat || 0) >= TRAINED_SKILL;
export const has = (v, t) => v.traits.includes(t);

// ------------------------------------------------------------------ ruler

export function rulerOf(g) {
  const id = g.state.ruler?.id;
  return id ? g.state.villagers.find(v => v.id === id) || null : null;
}

/** Best-fitting ruler type for a person, by traits and skills. */
export function rulerTypeOf(v) {
  if (!v) return 'chieftain';
  let best = 'chieftain', bestScore = 1.5;
  for (const [key, type] of Object.entries(RULER_TYPES)) {
    let score = 0;
    for (const [t, w] of Object.entries(type.score)) if (v.traits.includes(t)) score += w;
    if (type.skill) score += (v.skills[type.skill] || 0) * 0.4;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

export function rulerTitle(g, v) {
  const era = Math.min(g.state.era, RULER_TITLES.length - 1);
  return RULER_TITLES[era][v?.sex === 'f' ? 1 : 0];
}

/** Realm-wide effects of the current ruler (halved while a child rules through a regent). */
export function rulerEffects(g) {
  const v = rulerOf(g);
  if (!v) return {};
  const type = RULER_TYPES[g.state.ruler.type || rulerTypeOf(v)];
  const mult = v.age < ADULT_AGE ? 0.5 : 1;
  return Object.fromEntries(Object.entries(type.effects).map(([k, n]) => [k, n * mult]));
}

export function crown(g, v, reason = '') {
  const s = g.state;
  s.ruler ||= { dynasty: pick(DYNASTY_NAMES) };
  const prev = rulerOf(g);
  if (prev && prev !== v) { prev.ruling = false; if (prev.job === 'ruler') prev.job = 'idle'; }
  s.ruler.id = v.id;
  s.ruler.since = s.time;
  s.ruler.type = rulerTypeOf(v);
  if (s.ruler.heirId === v.id) s.ruler.heirId = null;
  v.ruling = true;
  if (v.office) { s.court[v.office].id = null; v.office = null; }
  if (v.age >= ADULT_AGE) { v.job = 'ruler'; v._task = null; }
  v.happy = clamp(v.happy + 20, 0, 100);
  const type = RULER_TYPES[s.ruler.type];
  if (reason) {
    g.announce(`${rulerTitle(g, v)} ${v.name} the ${type.label}`);
    g.log(`${reason} ${v.name} of House ${s.ruler.dynasty} now rules as ${type.label}.${v.age < ADULT_AGE ? ' A regent governs until they come of age.' : ''}`, 'event');
  }
  g.recalc();
  g.emit('change');
}

export function ensureRuler(g) {
  const s = g.state;
  if (rulerOf(g) || !s.villagers.length) return;
  const heir = pickHeir(g);
  if (heir) crown(g, heir, s.ruler?.id ? 'The throne passes on.' : '');
}

function pickHeir(g) {
  const s = g.state;
  const alive = s.villagers.filter(v => !v.away);
  const chosen = alive.find(v => v.id === s.ruler?.heirId);
  if (chosen) return chosen;
  const prevId = s.ruler?.id;
  const children = alive.filter(v => v.parents?.includes(prevId)).sort((a, b) => b.age - a.age);
  const adultChild = children.find(v => v.age >= ADULT_AGE);
  if (adultChild) return adultChild;
  if (children.length) return children[0];
  return [...alive].sort((a, b) => ((b.age >= ADULT_AGE) - (a.age >= ADULT_AGE)) || (b.happy - a.happy))[0] || null;
}

export function setHeir(g, v) {
  g.state.ruler ||= { dynasty: pick(DYNASTY_NAMES) };
  g.state.ruler.heirId = v?.id || null;
  if (v) g.log(`${v.name} is named heir to the throne.`, 'event');
  g.emit('change');
}

/** Called when someone dies or leaves. */
export function onVillagerGone(g, v) {
  if (g.state.ruler?.id === v.id) {
    g.state.ruler.lastRuler = v.name;
    const heir = pickHeir(g);
    if (heir) {
      crown(g, heir, `${v.name} is gone. Long live the new ${rulerTitle(g, heir)}!`);
      if (g.state.ruler.heirId == null && !heir.parents?.includes(v.id)) {
        // no heir of the blood: the realm is shaken
        for (const x of g.state.villagers) x.happy = clamp(x.happy - 10, 0, 100);
        g.log('No heir of the blood — unrest spreads through the realm.', 'bad');
      }
    }
  }
  if (g.state.ruler?.heirId === v.id) g.state.ruler.heirId = null;
}

// ------------------------------------------------------------------ callings & shaping people

export function setCalling(g, v, calling) {
  if (!CALLINGS[calling]) return;
  v.calling = calling === 'none' ? null : calling;
  professionFromCalling(v);   // the calling decides the trade they grow into
  g.emit('change');
}

export const ENCOURAGE = {
  praise:     { label: 'Praise',     icon: 'effects/emote_love',  cost: { influence: 5 },  desc: '+20 happiness. May make them loyal or ambitious.' },
  mentor:     { label: 'Mentor',     icon: 'items/scroll',        cost: { influence: 10 }, desc: 'Personal lessons: +1 in their best skill. Clever minds learn more.' },
  discipline: { label: 'Discipline', icon: 'effects/emote_angry', cost: { influence: 5 },  desc: '−15 happiness. May cure laziness or greed.' },
  knight:     { label: 'Knight',     icon: 'items/sword',         cost: { influence: 25, gold: 10 }, desc: 'Knight a trained warrior with 5+ combat. +25% combat, never flees.' },
};

export function encourage(g, v, action) {
  const def = ENCOURAGE[action];
  if (!def) return { error: 'Unknown action' };
  if (action === 'knight') {
    if (!isTrained(v) || v.skills.combat < 5) return { error: 'Only trained warriors with 5+ combat can be knighted' };
    if (has(v, 'knighted')) return { error: 'Already a knight' };
  }
  const last = v.encouragedAt || -Infinity;
  if (action !== 'knight' && g.state.time - last < 45) return { error: `${v.name} needs time before more attention` };
  if (!g.spend(def.cost)) return { error: 'Not enough resources' };
  v.encouragedAt = g.state.time;
  let text = '';
  switch (action) {
    case 'praise':
      v.happy = clamp(v.happy + 20, 0, 100);
      text = `${v.name} beams with pride.`;
      if (v.gifted) v.ego = Math.min(100, (v.ego || 0) + 8);   // praise feeds a gifted ego
      if (chance(0.2)) text += gain(v, chance(0.5) ? 'loyal' : 'ambitious');
      break;
    case 'mentor': {
      const [skill] = Object.entries(v.skills).sort((a, b) => b[1] - a[1])[0];
      const amount = has(v, 'genius') ? 2 : has(v, 'clever') ? 1.5 : 1;
      v.skills[skill] = Math.min(10, v.skills[skill] + amount);
      text = `${v.name} improves at ${skill} (+${amount}).`;
      break;
    }
    case 'discipline':
      v.happy = clamp(v.happy - 15, 0, 100);
      text = `${v.name} is set straight.`;
      if (v.gifted) v.ego = Math.max(0, (v.ego || 0) - 25);   // a firm word humbles the proud
      for (const bad of ['lazy', 'greedy', 'glutton']) {
        if (has(v, bad) && chance(0.35)) { v.traits = v.traits.filter(t => t !== bad); text += ` No longer ${TRAITS[bad].label.toLowerCase()}!`; break; }
      }
      break;
    case 'knight':
      v.traits.push('knighted');
      v.happy = clamp(v.happy + 25, 0, 100);
      g.addKarma(1);
      text = `Sir ${v.name} is knighted before the realm!`;
      g.announce(`⚔ Sir ${v.name} is knighted`);
      break;
  }
  g.float(v.x, v.y - TILE * 1.2, text, '#ffd76a');
  g.log(text, 'event');
  g.emit('change');
  return { text };
}

function gain(v, trait) {
  if (has(v, trait)) return '';
  v.traits.push(trait);
  return ` Now ${TRAITS[trait].label.toLowerCase()}!`;
}

// ------------------------------------------------------------------ inventory

export function inventory(v) {
  v.inv ||= { pack: {}, coins: 0 };
  v.inv.pack ||= {};
  return v.inv;
}

export function addItem(v, item, n = 1) {
  const inv = inventory(v);
  inv.pack[item] = (inv.pack[item] || 0) + n;
}

export function takeItem(v, item) {
  const inv = inventory(v);
  if (!inv.pack[item]) return false;
  if (--inv.pack[item] <= 0) delete inv.pack[item];
  return true;
}

/** What a person really carries in each slot: items from their pack first, then gear from the village armoury. */
export function equipment(g, v) {
  const iron = g.hasBuilding('blacksmith') || g.hasBuilding('weaponsmith');
  const pack = inventory(v).pack;
  const own = key => (pack[key] ? { ...ITEMS[key], key } : null);
  // the tool of their trade (or of the job they are doing now), if they own one
  const toolKey = [TRADE_TOOL[v.profession], TOOL_FOR_JOB[v.job], ...Object.keys(pack).filter(k => ITEMS[k]?.slot === 'tool')].find(k => k && pack[k]);
  const weaponKey = ['sword', 'spear'].find(k => pack[k]);
  return {
    tool: toolKey ? { ...own(toolKey), quality: iron ? 'Iron' : 'Stone' } : null,
    weapon: weaponKey ? own(weaponKey) : v.armed ? { ...ITEMS[iron ? 'sword' : 'spear'], key: iron ? 'sword' : 'spear', issued: true } : null,
    armor: pack.shield ? own('shield') : v.armed && g.hasBuilding('armory') ? { ...ITEMS.shield, key: 'shield', issued: true } : null,
  };
}

// ------------------------------------------------------------------ daily life

export function dailyPeople(g) {
  const s = g.state;
  ensureRuler(g);
  const ruler = rulerOf(g);
  if (ruler) s.ruler.type = rulerTypeOf(ruler);

  for (const v of s.villagers) {
    const inv = inventory(v);

    // callings shape children as they grow
    if (v.age < ADULT_AGE && v.calling) {
      const c = CALLINGS[v.calling];
      for (const [skill, n] of Object.entries(c.skills)) v.skills[skill] = Math.min(10, (v.skills[skill] || 0) + n * (g.learnBonus + 1));
      if (v.age > 6 && !v._callingTrait) {
        v._callingTrait = true;
        for (const [t, p] of Object.entries(c.traits)) if (chance(p) && !has(v, t)) v.traits.push(t);
      }
    }

    // earned traits
    if (!has(v, 'wise') && v.age >= 50 && chance(0.25)) { v.traits.push('wise'); g.log(`${v.name} has grown wise with age.`, 'good'); }
    if (!has(v, 'veteran') && (v.kills || 0) >= 6) { v.traits.push('veteran'); g.log(`${v.name} is now a battle-hardened veteran.`, 'good'); }
    if (has(v, 'scarred')) v.happy = clamp(v.happy - 3, 0, 100);
    if (has(v, 'ambitious') && !v.office && !v.ruling && v.age >= ADULT_AGE) v.happy = clamp(v.happy - 2, 0, 100);

    // wages, and spending them
    if (v.age >= ADULT_AGE && !['idle', 'official', 'ruler'].includes(v.job)) inv.coins += 1;
    if (v.happy < 50 && inv.coins >= 3 && (g.hasBuilding('tavern') || g.hasBuilding('brewery') || g.hasBuilding('inn'))) {
      inv.coins -= 3;
      v.happy = clamp(v.happy + 10, 0, 100);
    }
    if (inv.pack.pelt && g.hasBuilding('market')) { g.addResource('gold', 3 * inv.pack.pelt); inv.coins += inv.pack.pelt; delete inv.pack.pelt; }
    if (inv.pack.trinket) v.happy = clamp(v.happy + 2, 0, 100);

    // personal remedies
    if (v.sick && takeItem(v, 'herbs')) { v.sick = Math.max(0, v.sick - 2); g.float(v.x, v.y - TILE, 'Used herbs', '#9dff8a'); }
    if (v.hp < 40 && takeItem(v, 'potion')) v.hp = Math.min(Math.max(100, v.hp), v.hp + 40);
  }
}

/** Relics carried by villagers bless the whole realm. */
export function carriedLuck(g) {
  return g.state.villagers.reduce((n, v) => n + (v.inv?.pack?.relic ? 0.05 : 0), 0);
}
