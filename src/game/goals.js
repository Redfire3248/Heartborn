import { BUILDINGS, ERAS, buildingSprite } from '../data/buildings.js';
import { addItem } from './dynasty.js';

/*
 * Goals: a short list of things to do next, each with a reward you claim.
 * Three are shown at a time, in order; finishing every goal of an era also opens that era's chest.
 */

const built = (g, type) => g.state.buildings.filter(b => b.type === type && b.built).length;
const pop = g => g.state.villagers.length;
const res = (g, k) => Math.floor(g.state.resources[k] || 0);
const jobCount = (g, job) => g.state.villagers.filter(v => v.job === job).length;
const stat = (g, k) => g.state.stats?.[k] || 0;

function eraGoal(era, reward) {
  return { id: `era${era}`, era: era - 1, text: `Reach the ${ERAS[era].name} era`, need: 1, have: g => (g.state.era >= era ? 1 : 0), reward, icon: 'items/star_rank' };
}

const B = (id, era, type, n, reward, text) => ({ id, era, text: text || (n > 1 ? `Build ${n} ${BUILDINGS[type].name}s` : `Build a ${BUILDINGS[type].name}`), need: n, have: g => built(g, type), reward, icon: buildingSprite(type), type });

export const GOALS = [
  // ---- Primitive: the first fire and a camp (Village needs a Campfire, a Stockpile and 6 people)
  B('fire', 0, 'campfire', 1, { food: 30, wood: 20 }, 'Light a Campfire'),
  B('workshop', 0, 'craft_hut', 1, { wood: 30, stone: 15 }, "Build the blacksmith's workshop (Craft Hut)"),
  B('stockpile', 0, 'stockpile', 1, { wood: 30, stone: 10 }),
  B('tents', 0, 'tent', 2, { wood: 30 }),
  { id: 'trees', era: 0, text: 'Cut down 15 trees', need: 15, have: g => stat(g, 'treesCut'), reward: { wood: 60 }, icon: 'items/axe' },
  { id: 'pop6', era: 0, text: 'Grow to 6 people', need: 6, have: pop, reward: { food: 40 }, icon: 'items/population' },
  eraGoal(1, { food: 60, stone: 30 }),

  // ---- Village (Town needs a Well, a Shrine and 16 people)
  B('farm', 1, 'farm', 1, { food: 60 }),
  B('house', 1, 'house', 1, { wood: 40, stone: 20 }),
  { id: 'baby', era: 1, text: 'Welcome a baby', need: 1, have: g => stat(g, 'births'), reward: { food: 50, influence: 10 }, icon: 'items/baby' },
  B('well', 1, 'well', 1, { food: 40, stone: 20 }),
  B('shrine', 1, 'shrine', 1, { influence: 20 }),
  B('shipyard', 1, 'shipyard', 1, { wood: 40, bombs: 5 }, 'Build a Shipyard and set sail'),
  { id: 'warriors2', era: 1, text: 'Have 2 warriors', need: 2, have: g => jobCount(g, 'warrior'), reward: { weapons: 6 }, icon: 'items/sword' },
  { id: 'food150', era: 1, text: 'Store 150 food', need: 150, have: g => res(g, 'food'), reward: { stone: 40 }, icon: 'items/icon_food' },
  { id: 'pop16', era: 1, text: 'Grow to 16 people', need: 16, have: pop, reward: { gold: 40, influence: 15 }, icon: 'items/population' },
  eraGoal(2, { gold: 60, wood: 100 }),

  // ---- Town (Kingdom needs a Market, Barracks and 35 people)
  B('market', 2, 'market', 1, { gold: 60 }),
  B('barracks', 2, 'barracks', 1, { weapons: 10 }),
  B('blacksmith', 2, 'blacksmith', 1, { iron: 30, coal: 30 }),
  B('houses5', 2, 'house', 5, { wood: 120, stone: 80 }),
  B('school', 2, 'school', 1, { science: 20, gold: 20 }, 'Build a School (science begins)'),
  { id: 'gold200', era: 2, text: 'Save up 200 gold', need: 200, have: g => res(g, 'gold'), reward: { gems: 5 }, icon: 'items/icon_gold' },
  { id: 'office', era: 2, text: 'Appoint a court official', need: 1, have: g => Object.values(g.state.court || {}).filter(c => c?.id).length, reward: { influence: 40 }, icon: 'items/crown_leader' },
  { id: 'pop35', era: 2, text: 'Grow to 35 people', need: 35, have: pop, reward: { food: 200, gold: 60 }, icon: 'items/population' },
  eraGoal(3, { gold: 150, gems: 5 }),

  // ---- Kingdom (Industrial needs a Castle, a Printing Press, 50 people and 150 science)
  B('castle', 3, 'castle', 1, { stone: 200, gold: 100 }),
  B('printing_press', 3, 'printing_press', 1, { science: 60 }),
  B('temple', 3, 'temple', 1, { influence: 60 }),
  { id: 'warriors10', era: 3, text: 'Raise an army of 10 warriors', need: 10, have: g => jobCount(g, 'warrior'), reward: { weapons: 20, iron: 60 }, icon: 'items/war' },
  { id: 'knight', era: 3, text: 'Knight one of your warriors', need: 1, have: g => g.state.villagers.filter(v => v.traits?.includes('knighted')).length, reward: { gold: 120, influence: 30 }, icon: 'items/shield' },
  B('library', 3, 'library', 1, { science: 40 }),
  { id: 'science150', era: 3, text: 'Gather 150 science', need: 150, have: g => res(g, 'science'), reward: { iron: 80, coal: 80 }, icon: 'units/science' },
  { id: 'pop50', era: 3, text: 'Grow to 50 people', need: 50, have: pop, reward: { food: 300, gold: 100 }, icon: 'items/population' },
  eraGoal(4, { gold: 300, gems: 10 }),

  // ---- Industrial (Atomic needs a Factory, a Research Lab, 70 people and 600 science)
  B('factory', 4, 'factory', 1, { iron: 150, coal: 150 }),
  B('research_lab', 4, 'research_lab', 1, { science: 150 }),
  B('spy_den', 4, 'spy_den', 1, { gold: 150 }),
  { id: 'spy', era: 4, text: 'Train a spy', need: 1, have: g => g.state.villagers.filter(v => v.job === 'spy' && (v.skills?.stealth || 0) >= 3).length, reward: { influence: 60, gold: 100 }, icon: 'units/spy' },
  { id: 'science600', era: 4, text: 'Gather 600 science', need: 600, have: g => res(g, 'science'), reward: { gold: 250 }, icon: 'units/science' },
  { id: 'pop70', era: 4, text: 'Grow to 70 people', need: 70, have: pop, reward: { food: 500, gems: 10 }, icon: 'items/population' },
  eraGoal(5, { gold: 500, science: 200 }),

  // ---- Atomic (Future needs a Power Plant, an Academy of Science, 90 people and 2000 science)
  B('power_plant', 5, 'power_plant', 1, { coal: 300, iron: 200 }),
  B('academy_of_science', 5, 'academy_of_science', 1, { science: 300 }),
  B('radar_array', 5, 'radar_array', 1, { gold: 200 }),
  { id: 'bombs20', era: 5, text: 'Stockpile 20 bombs', need: 20, have: g => res(g, 'bombs'), reward: { iron: 300, gold: 200 }, icon: 'units/bomb' },
  { id: 'pop90', era: 5, text: 'Grow to 90 people', need: 90, have: pop, reward: { food: 800, gems: 15 }, icon: 'items/population' },
  eraGoal(6, { gold: 1000, science: 500 }),

  // ---- Future
  B('arcology', 6, 'arcology', 1, { food: 1000, gold: 500 }),
  B('ai_core', 6, 'ai_core', 1, { science: 1000 }),
  B('spaceport', 6, 'spaceport', 1, { gems: 50, gold: 1000 }),
  { id: 'pop200', era: 6, text: 'Grow to 200 people', need: 200, have: pop, reward: { gems: 40, influence: 200 }, icon: 'items/population' },
].filter(goal => !goal.type || BUILDINGS[goal.type]);

const SHOWN = 3;

function goalState(g) {
  return (g.state.goals ||= { claimed: [], chests: [] });
}

export const isClaimed = (g, id) => goalState(g).claimed.includes(id);

/** The goals shown right now: the first few unclaimed goals of eras you have reached. */
export function activeGoals(g) {
  const out = [];
  for (const goal of GOALS) {
    if (goal.era > g.state.era || isClaimed(g, goal.id)) continue;
    const have = Math.min(goal.need, Math.max(0, goal.have(g)));
    out.push({ ...goal, have, done: have >= goal.need });
    if (out.length >= SHOWN) break;
  }
  return out;
}

export function claimGoal(g, id) {
  const goal = GOALS.find(x => x.id === id);
  if (!goal || isClaimed(g, id)) return null;
  if (goal.era > g.state.era || goal.have(g) < goal.need) return null;
  goalState(g).claimed.push(id);
  grant(g, goal.reward);
  g.log(`Goal complete: ${goal.text}. Reward: ${rewardText(goal.reward)}`, 'good');
  const chest = openEraChest(g, goal.era);
  g.emit('change');
  return { goal, chest };
}

/** Every goal of an era claimed: that era's chest opens once. */
function openEraChest(g, era) {
  const st = goalState(g);
  if (st.chests.includes(era)) return null;
  if (GOALS.some(x => x.era === era && !st.claimed.includes(x.id))) return null;
  st.chests.push(era);
  const scale = [1, 2, 5, 12, 30, 70, 150][era] || 1;
  const reward = { gold: 50 * scale, gems: 2 * scale, influence: 20 * scale };
  grant(g, reward);
  const ruler = g.state.villagers.find(v => v.ruling);
  if (ruler) addItem(ruler, 'relic', 1);
  g.log(`The ${ERAS[era].name} chest opens: ${rewardText(reward)} and an Ancient Relic for your ruler!`, 'good');
  g.announce(`${ERAS[era].name} chest opened!`);
  return reward;
}

function grant(g, reward) {
  for (const [k, n] of Object.entries(reward)) g.state.resources[k] = (g.state.resources[k] || 0) + n;   // rewards ignore storage limits
}

export const rewardText = reward => Object.entries(reward).map(([k, n]) => `+${n} ${k}`).join(', ');

export function goalsLeftInEra(g) {
  const st = goalState(g);
  const era = Math.min(g.state.era, Math.max(...GOALS.map(x => x.era)));
  const inEra = GOALS.filter(x => x.era === era);
  return { era, done: inEra.filter(x => st.claimed.includes(x.id)).length, total: inEra.length };
}
