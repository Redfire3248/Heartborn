import { DAY_LENGTH } from '../core/constants.js';
import { chance, clamp, pick } from '../core/rng.js';
import { killVillager } from './villagers.js';
import { destroyBuildings } from './intrigue.js';

/*
 * The Empire: computer-run kingdoms around your land. They grow, scheme, trade, ally and
 * go to war. Beat them and they become vassals (tribute) and then provinces (income) —
 * which can rebel. On top of that, empire-wide events: plagues, golden ages, civil war,
 * meteors, succession crises… anything can happen.
 *
 * state.empire = { kingdoms: [...], history: [...], siege, colonies, nextId }
 */

const SYL_A = ['Val', 'Kor', 'Ash', 'Bel', 'Dun', 'Mor', 'Eld', 'Tar', 'Gal', 'Ryn', 'Os', 'Zar', 'Hel', 'Vor', 'Cai', 'Lum'];
const SYL_B = ['moor', 'heim', 'dor', 'vale', 'reach', 'mark', 'garde', 'fell', 'wyn', 'hold', 'stan', 'ria', 'mont', 'grad'];
const RULER_A = ['Aldric', 'Maren', 'Theron', 'Isolde', 'Brann', 'Sera', 'Oswin', 'Yara', 'Corvin', 'Elda', 'Ragnar', 'Liora'];
const RULER_T = ['the Bold', 'the Cruel', 'the Wise', 'the Young', 'the Pious', 'Ironhand', 'the Greedy', 'the Just', 'Blackheart', 'the Fair'];

export const PERSONALITIES = {
  warlike: { label: 'Warlike', icon: '⚔', desc: 'Respects only strength. Often declares war.' },
  greedy: { label: 'Greedy', icon: '💰', desc: 'Loves trade and gold. Demands tribute from the weak.' },
  peaceful: { label: 'Peaceful', icon: '🕊', desc: 'Prefers alliances. Slow to anger.' },
  devout: { label: 'Devout', icon: '✝', desc: 'Loves kind rulers, hates cruel ones.' },
  cunning: { label: 'Cunning', icon: '🗡', desc: 'Sends spies and plots in the shadows.' },
};

export const STATUS = {
  neutral: { label: 'Neutral', color: '#b5a2c4' },
  allied: { label: 'Allied', color: '#7ee06a' },
  war: { label: 'At war', color: '#ff6b5b' },
  vassal: { label: 'Vassal', color: '#ffcf5a' },
  province: { label: 'Province', color: '#7fc8ff' },
};

export const TITLES = ['Tribe', 'Chiefdom', 'Kingdom', 'Empire', 'Great Empire', 'World Empire'];

const cap = s => s[0].toUpperCase() + s.slice(1);
const history = (g, text, kind = 'event') => {
  const e = g.state.empire;
  e.history.unshift({ text, day: g.day + 1, kind });
  e.history.length = Math.min(e.history.length, 40);
  g.log(`👑 ${text}`, kind);
};

export function empireOf(g) {
  g.state.empire ||= {};
  const e = g.state.empire;
  e.kingdoms ||= [];
  e.history ||= [];
  e.nextId ||= 1;
  return e;
}

function makeKingdom(g) {
  const e = empireOf(g);
  const era = g.state.era;
  const k = {
    id: `k${e.nextId++}`,
    name: pick(SYL_A) + pick(SYL_B),
    ruler: `${pick(RULER_A)} ${pick(RULER_T)}`,
    personality: pick(Object.keys(PERSONALITIES)),
    strength: Math.round(20 + era * 25 + Math.random() * 30 + g.state.villagers.length),
    wealth: Math.round(40 + era * 40 + Math.random() * 60),
    attitude: Math.round(Math.random() * 40 - 20),
    status: 'neutral',
    warScore: 0,
    unrest: 0,
    discoveredDay: g.day,
  };
  if (k.personality === 'peaceful') k.attitude += 15;
  if (k.personality === 'warlike') k.attitude -= 10;
  return k;
}

/** Your army strength compared against kingdoms. */
export function empirePower(g) {
  const warriors = g.state.villagers.filter(v => (v.job === 'warrior' || v.job === 'knight') && !v.away);
  const soldiers = warriors.reduce((n, v) => n + 1 + (v.skills.combat || 0) * 0.15 + (v.armed ? 0.5 : 0), 0);
  const e = g.state.empire || {};
  const allies = (e.kingdoms || []).filter(k => k.status === 'allied').reduce((n, k) => n + k.strength * 0.15, 0);
  return Math.round(soldiers * 12 * (1 + (g.combatBonus || 0)) * (1 + (g.raidBonus || 0)) + (g.defense || 0) * 0.4 + (e.siege || 0) * 25 + allies);
}

export function empireTitle(g) {
  const e = g.state.empire || {};
  const ruled = (e.kingdoms || []).filter(k => k.status === 'vassal' || k.status === 'province').length;
  if (ruled >= 6) return TITLES[5];
  if (ruled >= 4) return TITLES[4];
  if (ruled >= 2) return TITLES[3];
  if (ruled >= 1 || g.hasBuilding('castle')) return TITLES[2];
  if (g.state.villagers.length >= 12) return TITLES[1];
  return TITLES[0];
}

// ------------------------------------------------------------------ daily

export function dailyEmpire(g) {
  const s = g.state;
  if (s.era < 1 && s.villagers.length < 8) return;   // too small for anyone to notice
  const e = empireOf(g);

  // new neighbours are discovered as you grow
  const want = Math.min(8, 2 + s.era + Math.floor(s.villagers.length / 25));
  if (e.kingdoms.length < want && chance(0.35)) {
    const k = makeKingdom(g);
    e.kingdoms.push(k);
    history(g, `Scouts discovered the kingdom of ${k.name}, ruled by ${k.ruler} (${PERSONALITIES[k.personality].label}).`);
  }

  const power = empirePower(g);
  for (const k of e.kingdoms) {
    // kingdoms grow on their own
    if (k.status !== 'province') {
      k.strength = Math.round(k.strength * (1.01 + Math.random() * 0.02) + s.era);
      k.wealth = Math.round(k.wealth * 1.015 + 2);
    }
    // they judge your deeds
    if (k.personality === 'devout') k.attitude += s.karma > 20 ? 1 : s.karma < -20 ? -2 : 0;
    if (k.personality === 'warlike' && power < k.strength * 0.6) k.attitude -= 1;
    k.attitude = clamp(k.attitude + (Math.random() - 0.5) * 3, -100, 100);

    if (k.status === 'war') dailyWar(g, k, power);
    else if (k.status === 'vassal') dailyVassal(g, k, power);
    else if (k.status === 'province') dailyProvince(g, k);
    else if (k.status === 'allied') dailyAlly(g, k);
    else dailyNeutral(g, k, power);
  }

  // colonies among the stars
  if (e.colonies) { g.addResource('gold', 20 * e.colonies); g.addResource('science', 20 * e.colonies); }

  if (chance(0.12)) empireEvent(g);
}

function dailyNeutral(g, k, power) {
  if (k.truceUntil > g.state.time) return;
  const angry = k.attitude < -35;
  const bold = power < k.strength * (k.personality === 'warlike' ? 1.2 : 0.8);
  if (angry && bold && chance(k.personality === 'warlike' ? 0.15 : 0.05)) {
    k.status = 'war'; k.warScore = 0;
    history(g, `${k.name} has DECLARED WAR on you!`, 'bad');
    g.announce(`⚔ ${k.name} declares war!`);
    return;
  }
  if (k.personality === 'greedy' && power < k.strength * 0.5 && chance(0.06)) {
    const demand = Math.max(10, Math.floor(g.state.resources.gold * 0.3));
    decide(g, {
      id: 'tribute_demand', title: `${k.name} Demands Tribute`, icon: 'characters/merchant',
      text: `${k.ruler} sends an envoy: "Pay ${demand} gold, or we will come and take it."`,
      choices: [
        { label: `Pay ${demand} gold`, cost: { gold: demand }, apply: () => { k.attitude += 15; return `${k.name} is satisfied. For now.`; } },
        { label: 'Refuse', apply: () => { k.attitude -= 30; if (chance(0.5)) { k.status = 'war'; k.warScore = 0; return `${k.name} declares war!`; } return 'The envoy leaves in a fury.'; } },
      ],
    }, 1);
    return;
  }
  if (k.attitude > 55 && chance(0.05)) {
    decide(g, {
      id: 'alliance_offer', title: `${k.name} Offers an Alliance`, icon: 'items/alliance',
      text: `${k.ruler} proposes an alliance: their army will help yours, and trade will flow.`,
      choices: [
        { label: 'Accept the alliance', karma: 1, apply: () => { k.status = 'allied'; return `You are now allied with ${k.name}.`; } },
        { label: 'Decline politely', apply: () => { k.attitude -= 10; return 'They are disappointed.'; } },
      ],
    }, 0);
  }
  if (k.personality === 'cunning' && k.attitude < 0 && chance(0.05)) {
    const lost = Math.floor(g.state.resources.gold * 0.15);
    g.addResource('gold', -lost);
    history(g, `Agents of ${k.name} stole ${lost} gold from your treasury!`, 'bad');
  }
}

function dailyWar(g, k, power) {
  const e = empireOf(g);
  const ratio = power / Math.max(1, power + k.strength);
  const swing = (ratio - 0.5) * 50 + (Math.random() - 0.5) * 24 + g.fateBonus * 5;
  k.warScore = clamp(k.warScore + swing, -100, 100);
  k.strength = Math.max(5, Math.round(k.strength - ratio * 8));

  if (swing < 0) {
    const warriors = g.state.villagers.filter(v => v.job === 'warrior');
    if (warriors.length && chance(0.4)) killVillager(g, pick(warriors), `fell fighting ${k.name}`);
    if (chance(0.35)) g.spawnRaiders('bandit', 2 + g.state.era + Math.floor(k.strength / 60));
  }

  if (k.warScore >= 100) {
    e.siege = 0;
    k.status = 'vassal'; k.warScore = 0; k.attitude = -20;
    const loot = g.addResource('gold', Math.floor(k.wealth * 0.4));
    k.wealth = Math.floor(k.wealth * 0.6);
    g.addResource('influence', 30);
    history(g, `VICTORY! ${k.name} surrenders and becomes your vassal. You plunder ${loot} gold.`, 'good');
    g.announce(`🏆 ${k.name} bows to you!`);
  } else if (k.warScore <= -100) {
    k.status = 'neutral'; k.warScore = 0; k.attitude = -40;
    k.truceUntil = g.state.time + DAY_LENGTH * 4;
    const gold = Math.floor(g.state.resources.gold * 0.4);
    g.addResource('gold', -gold);
    destroyBuildings(g, 2, `The armies of ${k.name} burned the`);
    k.wealth += gold;
    history(g, `DEFEAT. ${k.name} sacked your lands, took ${gold} gold and forced a truce.`, 'bad');
    g.announce(`💀 Defeated by ${k.name}`);
  }
}

function dailyVassal(g, k, power) {
  const tribute = g.addResource('gold', Math.max(2, Math.floor(k.wealth * 0.04)));
  k.wealth = Math.max(0, k.wealth - tribute);
  k.unrest = clamp((k.unrest || 0) + (power < k.strength ? 4 : -2) + (g.state.karma < -30 ? 2 : 0), 0, 100);
  if (k.unrest > 60 && chance(0.15)) {
    k.status = 'war'; k.warScore = -20; k.unrest = 0;
    history(g, `Your vassal ${k.name} has REBELLED!`, 'bad');
    g.announce(`🔥 ${k.name} rebels!`);
  }
}

function dailyProvince(g, k) {
  const r = pick(['food', 'wood', 'stone', 'iron', 'gold']);
  g.addResource(r, 10 + g.state.era * 5);
  g.addResource('gold', 3 + g.state.era);
  const avgHappy = g.state.villagers.reduce((n, v) => n + v.happy, 0) / Math.max(1, g.state.villagers.length);
  k.unrest = clamp((k.unrest || 0) + (avgHappy < 40 ? 3 : -1) + (g.state.karma < -40 ? 3 : 0) + (Math.random() - 0.6) * 2, 0, 100);
  if (k.unrest > 75 && chance(0.12)) {
    k.status = 'war'; k.warScore = -10; k.unrest = 0;
    k.strength = Math.round(30 + g.state.era * 30);
    history(g, `The province of ${k.name} rises in REVOLT and declares independence!`, 'bad');
    g.announce(`🔥 ${k.name} revolts!`);
  }
}

function dailyAlly(g, k) {
  if (k.attitude < 10 && chance(0.1)) { k.status = 'neutral'; history(g, `${k.name} has broken off the alliance.`, 'bad'); return; }
  if (chance(0.08)) {
    const res = pick(['food', 'wood', 'stone', 'gold']);
    history(g, `Your ally ${k.name} sends a gift: +${g.addResource(res, 20 + g.state.era * 10)} ${res}.`, 'good');
  }
  // allies join your wars
  for (const enemy of empireOf(g).kingdoms) if (enemy.status === 'war' && chance(0.3)) enemy.warScore = clamp(enemy.warScore + 8, -100, 100);
}

// ------------------------------------------------------------------ player actions

export const ACTIONS = {
  envoy: { label: 'Send Envoy', icon: '📜', cost: { influence: 10, gold: 5 }, when: k => k.status !== 'province', desc: '+relations' },
  trade: { label: 'Trade', icon: '⚖', cost: { food: 30 }, when: k => ['neutral', 'allied', 'vassal'].includes(k.status), desc: 'Food for gold' },
  spy: { label: 'Spy', icon: '🕵', cost: { gold: 15 }, when: k => k.status !== 'province', desc: 'Steal gold or weaken them' },
  tribute: { label: 'Demand Tribute', icon: '💰', cost: { influence: 5 }, when: k => k.status === 'neutral', desc: 'Works if you are stronger' },
  alliance: { label: 'Propose Alliance', icon: '🤝', cost: { influence: 20 }, when: k => k.status === 'neutral', desc: 'Needs good relations' },
  war: { label: 'Declare War', icon: '⚔', cost: { influence: 15 }, when: k => ['neutral', 'allied'].includes(k.status), desc: 'Conquer them' },
  peace: { label: 'Offer Peace', icon: '🕊', cost: { gold: 30 }, when: k => k.status === 'war', desc: 'End the war' },
  annex: { label: 'Annex', icon: '🏛', cost: { influence: 60 }, when: k => k.status === 'vassal', desc: 'Vassal → province (daily income)' },
  release: { label: 'Grant Freedom', icon: '🕊', cost: {}, when: k => k.status === 'vassal' || k.status === 'province', desc: 'Free them (karma, ally)' },
  marriage: { label: 'Royal Marriage', icon: '💍', cost: { gold: 50, influence: 20 }, when: k => ['neutral', 'allied'].includes(k.status), desc: 'Alliance through marriage' },
};

export function empireAction(g, kid, action) {
  const e = empireOf(g);
  const k = e.kingdoms.find(x => x.id === kid);
  const a = ACTIONS[action];
  if (!k || !a) return { error: 'Unknown' };
  if (!a.when(k)) return { error: 'Not possible right now' };
  if (!g.canAfford(a.cost)) return { error: 'Not enough resources' };
  const power = empirePower(g);
  let text;
  switch (action) {
    case 'envoy': {
      const gain = 8 + Math.floor(Math.random() * 10) + (k.personality === 'peaceful' ? 6 : 0) - (k.personality === 'warlike' ? 4 : 0);
      k.attitude = clamp(k.attitude + gain, -100, 100);
      text = `Your envoy was received by ${k.ruler}. Relations +${gain}.`;
      break;
    }
    case 'trade': {
      const gold = g.addResource('gold', Math.round((15 + k.wealth * 0.05) * (k.personality === 'greedy' ? 1.3 : 1)));
      k.attitude = clamp(k.attitude + 3, -100, 100);
      text = `Caravans return from ${k.name}: +${gold} gold.`;
      break;
    }
    case 'spy': {
      if (chance(0.55 + g.fateBonus * 0.2)) {
        if (chance(0.5)) { const gold = g.addResource('gold', Math.floor(k.wealth * 0.15)); k.wealth -= gold; text = `Your spies stole ${gold} gold from ${k.name}.`; }
        else { k.strength = Math.round(k.strength * 0.8); text = `Your spies sabotaged the armies of ${k.name} (−20% strength).`; }
      } else {
        k.attitude = clamp(k.attitude - 25, -100, 100);
        text = `Your spy was caught in ${k.name}! Relations −25.`;
        if (chance(0.3) && k.personality !== 'peaceful') { k.status = 'war'; k.warScore = 0; text += ' They declare war!'; }
      }
      break;
    }
    case 'tribute': {
      if (power > k.strength * 1.3) {
        const gold = g.addResource('gold', Math.floor(k.wealth * 0.25));
        k.wealth -= gold; k.attitude -= 20;
        text = `${k.name} fears you and pays ${gold} gold.`;
      } else {
        k.attitude -= 30;
        text = `${k.ruler} laughs at your demand. Relations −30.`;
      }
      break;
    }
    case 'alliance': {
      if (k.attitude >= 40 || (k.personality === 'peaceful' && k.attitude >= 20)) { k.status = 'allied'; text = `${k.name} agrees to an alliance!`; }
      else { k.attitude -= 5; text = `${k.name} does not trust you enough (needs relations 40+).`; }
      break;
    }
    case 'war': {
      if (k.status === 'allied') g.addKarma(-8);
      k.status = 'war'; k.warScore = 0; k.attitude = -60;
      for (const other of e.kingdoms) if (other !== k && other.personality === 'peaceful') other.attitude -= 10;
      text = `You declared war on ${k.name}. Your army strength ${power} vs their ${k.strength}.`;
      break;
    }
    case 'peace': {
      if (k.warScore > -30 || chance(0.5)) { k.status = 'neutral'; k.warScore = 0; k.truceUntil = g.state.time + DAY_LENGTH * 3; k.attitude = -20; text = `${k.name} accepts peace.`; }
      else { text = `${k.name} smells victory and refuses peace.`; }
      break;
    }
    case 'annex': {
      k.status = 'province'; k.unrest = 20;
      text = `${k.name} is now a province of your empire. It will send resources every day — keep your people happy or it may revolt.`;
      break;
    }
    case 'release': {
      k.status = 'allied'; k.attitude = 70; g.addKarma(6);
      text = `You granted ${k.name} its freedom. They become a grateful ally. +6 karma.`;
      break;
    }
    case 'marriage': {
      if (k.attitude > -10) { k.status = 'allied'; k.attitude = clamp(k.attitude + 40, -100, 100); g.addResource('influence', 10); text = `A royal wedding unites your house with ${k.name}. Allies!`; }
      else { k.attitude -= 10; text = `${k.ruler} refuses to marry into your house.`; }
      break;
    }
  }
  g.spend(a.cost);
  history(g, text, /caught|laughs|refuse|not trust/.test(text) ? 'bad' : 'event');
  g.emit('change');
  return { text };
}

// ------------------------------------------------------------------ random empire events

/** Show a choice if the player is here, otherwise take the default choice. */
function decide(g, ev, defaultChoice) {
  if (!g.offline && !g.pendingEvent) { g.startEvent(ev); return; }
  const c = ev.choices[defaultChoice];
  if (c.cost && !g.spend(c.cost)) return;
  history(g, `${ev.title}: ${c.apply()}`);
}

const EMPIRE_EVENTS = [
  { w: 3, run: g => {
    let n = 0; for (const v of g.state.villagers) if (!v.robot && chance(0.35)) { v.sick = 3; n++; }
    history(g, `PLAGUE sweeps the land! ${n} people fall sick.`, 'bad');
  } },
  { w: 3, run: g => {
    g.state.modifiers.push({ id: 'golden', fate: 0.3, happy: 15, work: 0.2, until: g.state.time + DAY_LENGTH * 3 }); g.recalc();
    history(g, 'A GOLDEN AGE dawns: luck, joy and hard work for 3 days.', 'good');
  } },
  { w: 2, run: g => {
    const gems = g.addResource('gems', 5), iron = g.addResource('iron', 30);
    if (chance(0.5)) destroyBuildings(g, 1, 'A METEOR smashed into the');
    history(g, `A METEOR falls from the sky! Star-metal found: +${gems} gems, +${iron} iron.`, 'event');
  } },
  { w: 2, run: g => { destroyBuildings(g, 1 + Math.floor(Math.random() * 2), 'An EARTHQUAKE toppled the'); history(g, 'The ground shakes — an EARTHQUAKE!', 'bad'); } },
  { w: 2, run: g => {
    const lost = Math.floor(g.state.resources.food * 0.35); g.addResource('food', -lost);
    history(g, `FAMINE: blight destroys ${lost} food.`, 'bad');
  } },
  { w: 2, run: g => { const gold = g.addResource('gold', 40 + g.state.era * 20); history(g, `GOLD RUSH! Prospectors strike it rich: +${gold} gold.`, 'good'); } },
  { w: 1, run: g => { g.spawnRaiders('dragon', 1); history(g, 'A DRAGON has been sighted over your lands!', 'bad'); g.announce('🐉 A dragon approaches!'); } },
  { w: 2, run: g => {
    const avg = g.state.villagers.reduce((n, v) => n + v.happy, 0) / Math.max(1, g.state.villagers.length);
    if (avg > 45 || g.state.villagers.length < 8) return;
    const rebels = g.state.villagers.filter(v => !v.ruling && v.happy < 40).slice(0, 4);
    for (const v of rebels) v.traitor = true;
    history(g, `CIVIL UNREST: ${rebels.length} unhappy citizens join a secret rebellion.`, 'bad');
  } },
  { w: 2, run: g => {
    const e = empireOf(g);
    const ks = e.kingdoms.filter(k => k.status === 'neutral');
    if (ks.length < 2) return;
    const [a, b] = [pick(ks), pick(ks)];
    if (a === b) return;
    const winner = chance(a.strength / (a.strength + b.strength)) ? a : b, loser = winner === a ? b : a;
    winner.strength += Math.floor(loser.strength * 0.3); winner.wealth += Math.floor(loser.wealth * 0.4);
    loser.strength = Math.floor(loser.strength * 0.5); loser.wealth = Math.floor(loser.wealth * 0.6);
    history(g, `War between kingdoms: ${winner.name} crushed ${loser.name} and grows mighty.`);
  } },
  { w: 2, run: g => {
    const e = empireOf(g);
    const k = pick(e.kingdoms.filter(x => x.status !== 'province'));
    if (!k) return;
    k.ruler = `${pick(RULER_A)} ${pick(RULER_T)}`;
    k.personality = pick(Object.keys(PERSONALITIES));
    k.attitude = Math.round(Math.random() * 40 - 20);
    history(g, `SUCCESSION in ${k.name}: the old ruler is dead. ${k.ruler} (${PERSONALITIES[k.personality].label}) takes the throne.`);
  } },
  { w: 1, run: g => {
    const ruler = g.state.villagers.find(v => v.ruling);
    if (!ruler) return;
    if (chance(0.4 - g.fateBonus * 0.2)) { killVillager(g, ruler, 'was assassinated'); history(g, `ASSASSINATION! ${ruler.name} was murdered by a hidden blade.`, 'bad'); }
    else history(g, `An assassin tried to kill ${ruler.name} — the guards stopped them!`, 'event');
  } },
  { w: 2, run: g => {
    decide(g, {
      id: 'prophet', title: 'A Prophet Appears', icon: 'characters/priest',
      text: 'A wild-eyed prophet preaches in your streets. Crowds gather.',
      choices: [
        { label: 'Let them preach', karma: 2, apply: () => { g.state.modifiers.push({ id: 'prophet', fate: 0.2, until: g.state.time + DAY_LENGTH * 2 }); g.recalc(); return 'The people are inspired. +20% luck for 2 days.'; } },
        { label: 'Exile the prophet', karma: -2, apply: () => { g.addResource('influence', 10); return 'Order is kept. +10 influence.'; } },
      ],
    }, 0);
  } },
  { w: 2, run: g => {
    const room = Math.max(0, g.housing - g.state.villagers.length);
    if (room < 2) return;
    const n = Math.min(room, 3 + Math.floor(Math.random() * 5));
    for (let i = 0; i < n; i++) g.addWanderer();
    history(g, `REFUGEES from a burning kingdom arrive: ${n} new people.`, 'good');
  } },
  { w: 1, run: g => {
    const e = empireOf(g);
    const k = pick(e.kingdoms.filter(x => x.status === 'vassal' || x.status === 'province'));
    if (!k) return;
    const gold = g.addResource('gold', 30 + g.state.era * 15);
    history(g, `${k.name} sends a festival gift to honour your rule: +${gold} gold.`, 'good');
  } },
];

export function empireEvent(g, index = null) {
  const list = EMPIRE_EVENTS;
  let ev;
  if (index != null) ev = list[index];
  else {
    const total = list.reduce((n, x) => n + x.w, 0);
    let r = Math.random() * total;
    ev = list.find(x => (r -= x.w) < 0) || list[0];
  }
  ev.run(g);
  g.emit('change');
}

export const EMPIRE_EVENT_COUNT = EMPIRE_EVENTS.length;
export { cap as capitalize };
