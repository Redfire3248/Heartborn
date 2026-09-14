import { BUILDINGS, ERAS } from './buildings.js';
import { OFFICES } from '../game/court.js';

const pct = n => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`;
const WORKPLACE = {
  farm: ['🌾', 'Farmers work here for food'],
  mine: ['⛏', 'Miners work here for stone and ore'],
  fish: ['🐟', 'Fishers work here for food'],
  smith: ['🔨', 'Smiths craft here'],
  train: ['🎯', 'Recruits train here to become warriors'],
  spytrain: ['🕵', 'Spies train here'],
};
const BONUS = { chop: 'wood from chopping', mine: 'ore from mining', farm: 'farm food', fish: 'fish caught', hunt: 'meat from hunting', build: 'building speed' };

/**
 * Everything a building does, generated from its real game data.
 * Returns [{ icon, text, good }] so every screen explains buildings the same way.
 */
export function describeBuilding(type) {
  const d = BUILDINGS[type];
  const out = [];
  const add = (icon, text, good = true) => out.push({ icon, text, good });

  if (d.housing) add('🏠', `Houses ${d.housing} people`);
  if (d.storage) add('📦', `+${d.storage} storage for every resource`);
  if (d.storageFood) add('🌾', `+${d.storageFood} food storage`);
  if (d.storageWeapons) add('⚔', `+${d.storageWeapons} weapon & bomb storage`);
  if (d.workplace) {
    const [icon, text] = WORKPLACE[d.workplace] || ['👷', 'Workplace'];
    add(icon, `${text} (${d.slots || 1} worker${(d.slots || 1) === 1 ? '' : 's'})`);
  }
  if (d.recipe) {
    const res = d.recipe.res || 'weapons';
    add('⚒', `Turns ${Object.entries(d.recipe.cost).map(([k, n]) => `${n} ${k}`).join(' + ')} into ${d.recipe.out} ${res}`);
  }
  if (d.outcome === 'quarry') add('🪨', 'Safer than a mine: mostly stone, sometimes iron or gems');
  for (const [res, n] of Object.entries(d.daily || {})) add('📅', `+${n} ${res} every day`);
  if (d.gold) add('💰', `+${d.gold} gold every day`);
  if (d.influence) add('☀', `+${d.influence} influence every day`);
  if (d.interest) add('🏦', `${Math.round(d.interest * 100)}% daily interest on your gold`);
  for (const [k, n] of Object.entries(d.bonus || {})) add('📈', `${pct(n)} ${BONUS[k] || k}`);
  if (d.work_bonus) add('⚙', `Everyone works ${pct(d.work_bonus)} faster`);
  if (d.speed) add('🏃', `Everyone moves ${pct(d.speed)} faster`);
  if (d.happy) add(d.happy > 0 ? '😊' : '😟', `${d.happy > 0 ? '+' : ''}${d.happy} happiness for everyone`, d.happy > 0);
  if (d.health) add('❤', `Fewer sicknesses (health +${d.health})`);
  if (d.heal) add('✚', 'Sick villagers come here to be cured');
  if (d.learn) add('📚', `Skills grow ${pct(d.learn)} faster`);
  if (d.fate) add('🎲', `${pct(d.fate)} luck on every fate roll`);
  if (d.karma) add(d.karma > 0 ? '😇' : '😈', `${d.karma > 0 ? '+' : ''}${d.karma} karma every day`, d.karma > 0);
  if (d.join) add('🚶', 'More wanderers join your people');
  if (d.fertility) add('👶', 'Many more births');
  if (d.defense) add('🛡', `+${d.defense} defense (enemies deal less damage)`);
  if (d.combat) add('⚔', `${pct(d.combat)} combat for your fighters`);
  if (d.raidPower) add('💥', `Your armies strike ${pct(d.raidPower)} harder`);
  if (d.spot) add('👁', `${pct(d.spot)} chance to spot enemy armies early`);
  if (d.counterIntel) add('🕶', `Enemy spies fail more often (${pct(d.counterIntel)})`);
  if (d.traitorWatch) add('🔎', 'Traitors are exposed more often');
  if (d.lawful) add('⚖', 'Greedy villagers stop stealing');
  if (d.vault) add('🔒', 'Half your gold is hidden from thieves and spies');
  if (d.bombDefense) add('💣', 'Fires bombs at invaders during battles (uses bombs)');
  if (d.shelter) add('🧱', 'Halves deaths from missile strikes');
  if (d.missileShield) add('🛡', 'Blocks missiles and orbital strikes');
  if (d.missile) add('☢', d.orbital ? 'Can launch orbital strikes at other realms' : 'Can launch missiles at other realms', false);
  if (d.robots) add('🤖', `Builds up to ${d.robots} robot workers`);
  if (d.light) add('🔥', 'Lights up the night');
  if (d.nearWater) add('🌊', 'Must be built next to water', false);
  if (d.trade) add('🤝', 'Unlocks trading with other players');
  if (type === 'barracks') add('⚔', 'Needed to march on other players');
  if (type === 'campfire') add('🏕', 'Village centre: villagers gather, eat and rest here');
  const offices = Object.entries(OFFICES).filter(([, o]) => o.requires.includes(type)).map(([, o]) => o.name);
  if (offices.length) add('👑', `Unlocks the ${offices.join(' / ')} office`);
  const eraUnlock = ERAS.find(e => e.requires.includes(type));
  if (eraUnlock) add('🏛', `Required to reach the ${eraUnlock.name} era`);
  return out;
}
