import { TILE, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { pick, clamp } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { rollFate } from './fate.js';
import { damageCreature } from './creatures.js';
import { onVillagerGone } from './dynasty.js';

// Player powers. Good deeds raise karma, evil deeds pay out now and cost later.
export const DEEDS = [
  {
    id: 'bless', name: 'Bless the Village', icon: 'items/karma_good', cost: { influence: 15 }, karma: 1,
    desc: 'Everyone gains +15 happiness.',
    run: g => { for (const v of g.state.villagers) v.happy = clamp(v.happy + 15, 0, 100); g.puff(g.center, 'effects/spark', 16, 60); return 'Warmth fills every heart.'; },
  },
  {
    id: 'pray', name: 'Pray to the Gods', icon: 'buildings/shrine', cost: { influence: 10 }, requires: 'shrine',
    desc: 'Roll fate: blessings, visions… or divine wrath if your karma is low.',
    run: g => {
      const adults = g.state.villagers.filter(v => v.age >= ADULT_AGE);
      if (!adults.length) return 'No one to pray.';
      return rollFate(g, 'pray', pick(adults)).text;
    },
  },
  {
    id: 'feast', name: 'Hold a Feast', icon: 'items/icon_food', cost: { food: 30 }, karma: 2,
    desc: '+20 happiness and more babies for two days.',
    run: g => {
      for (const v of g.state.villagers) v.happy = clamp(v.happy + 20, 0, 100);
      g.state.modifiers.push({ id: 'feast', fertility: 0.8, until: g.state.time + DAY_LENGTH * 2 });
      return 'Music and laughter into the night.';
    },
  },
  {
    id: 'smite', name: 'Divine Smite', icon: 'effects/lightning', cost: { influence: 20 },
    desc: 'Lightning strikes the most dangerous monster near your village.',
    canRun: g => hostilesNear(g).length > 0 || 'No monsters nearby',
    run: g => {
      const target = hostilesNear(g).sort((a, b) => CREATURES[b.t].damage - CREATURES[a.t].damage)[0];
      g.puff(target, 'effects/lightning', 4, 6);
      g.puff(target, 'effects/explosion', 6);
      g.fx.shake = 1.5;
      damageCreature(g, target, 150, null);
      return `Lightning strikes the ${target.t.replace('_', ' ')}!`;
    },
  },
  {
    id: 'tribute', name: 'Demand Tribute', icon: 'items/icon_gold', cost: {}, karma: -4,
    desc: 'Squeeze gold from your people. −15 happiness for everyone.',
    run: g => {
      const gold = g.addResource('gold', g.state.villagers.length * 2);
      for (const v of g.state.villagers) v.happy = clamp(v.happy - 15, 0, 100);
      return `+${gold} gold. The people resent you.`;
    },
  },
  {
    id: 'dark_pact', name: 'Dark Pact', icon: 'items/karma_evil', cost: { influence: 30 }, karma: -12,
    desc: 'Huge luck for 2 days… but the dead may walk tonight.',
    run: g => {
      g.state.modifiers.push({ id: 'pact', fate: 0.5, until: g.state.time + DAY_LENGTH * 2 });
      if (Math.random() < 0.5) g.spawnRaiders('skeleton', 3);
      return 'Shadows whisper promises of fortune.';
    },
  },
];

export function runDeed(g, id) {
  const deed = DEEDS.find(d => d.id === id);
  if (!deed) return { error: 'Unknown deed' };
  if (deed.requires && !g.hasBuilding(deed.requires)) return { error: `Requires a ${deed.requires}` };
  const can = deed.canRun ? deed.canRun(g) : true;
  if (can !== true) return { error: can };
  if (!g.spend(deed.cost)) return { error: 'Not enough resources' };
  g.addKarma(deed.karma || 0);
  const text = deed.run(g);
  g.log(`${deed.name}: ${text}`, (deed.karma || 0) < 0 ? 'bad' : 'event');
  g.emit('change');
  return { text };
}

export function sacrificeVillager(g, v) {
  g.killVillager(v, 'was sacrificed to the gods');
  const influence = g.addResource('influence', 40 * g.law.sacrifice);
  g.addKarma(-15);
  g.state.modifiers.push({ id: 'sacrifice', fate: 0.2, until: g.state.time + DAY_LENGTH * 2 });
  g.fx.shake = 1;
  return `The gods accept the offering. +${influence} influence, luck rises.`;
}

export function exileVillager(g, v) {
  g.state.villagers = g.state.villagers.filter(x => x !== v);
  for (const x of g.state.villagers) x.happy = clamp(x.happy - 5, 0, 100);
  g.addKarma(-3);
  g.log(`${v.name} was exiled.`, 'bad');
  onVillagerGone(g, v);
  if (g.selected?.ref === v) g.selected = null;
  g.emit('change');
}

export function smiteCreature(g, c) {
  if (!g.spend({ influence: 20 })) return { error: 'Needs 20 influence' };
  g.puff(c, 'effects/lightning', 4, 6);
  g.fx.shake = 1.2;
  damageCreature(g, c, 150, null);
  return { text: 'Smitten!' };
}

function hostilesNear(g) {
  const cen = g.center;
  return g.state.creatures.filter(c => CREATURES[c.t].hostile && Math.hypot(c.x - cen.x, c.y - cen.y) < TILE * 30);
}
