import { BUILDINGS, ERAS } from './buildings.js';
import { OFFICES } from '../game/court.js';
import { ABILITIES } from '../game/abilities.js';

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
 * The same facts as short badges (icon + a few characters) for quick reading in the Build menu.
 * `tip` holds the full sentence for hover/long-press.
 */
export function effectBadges(type) {
  const d = BUILDINGS[type];
  const out = [];
  const add = (icon, label, tip, good = true) => out.push({ icon, label, tip, good });
  const n = v => `${v > 0 ? '+' : ''}${v}`;
  const p = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (d.housing) add('🏠', d.housing, `Houses ${d.housing} people`);
  if (d.storage) add('📦', n(d.storage), `+${d.storage} storage for every resource`);
  if (d.storageFood) add('🌾', n(d.storageFood), `+${d.storageFood} food storage`);
  if (d.storageWeapons) add('🗄', n(d.storageWeapons), `+${d.storageWeapons} weapon storage`);
  if (d.workplace) add(WORKPLACE[d.workplace]?.[0] || '👷', `${d.slots || 1}`, `${WORKPLACE[d.workplace]?.[1] || 'Workplace'} (${d.slots || 1} workers)`);
  if (d.recipe) add('⚒', `${d.recipe.out}`, `Crafts ${d.recipe.out} ${d.recipe.res || 'weapons'} from ${Object.entries(d.recipe.cost).map(([k, v]) => `${v} ${k}`).join(' + ')}`);
  for (const [res, v] of Object.entries(d.daily || {})) add(RES_EMOJI[res] || '📅', `${n(v)}/d`, `+${v} ${res} every day`);
  if (d.gold) add('💰', `${n(d.gold)}/d`, `+${d.gold} gold every day`);
  if (d.influence) add('☀', `${n(d.influence)}/d`, `+${d.influence} influence every day`);
  if (d.interest) add('🏦', `${Math.round(d.interest * 100)}%`, `${Math.round(d.interest * 100)}% daily interest on gold`);
  for (const [k, v] of Object.entries(d.bonus || {})) add('📈', p(v), `${p(v)} ${BONUS[k] || k}`);
  if (d.work_bonus) add('⚙', p(d.work_bonus), `Everyone works ${p(d.work_bonus)} faster`);
  if (d.speed) add('🏃', p(d.speed), `Everyone moves ${p(d.speed)} faster`);
  if (d.happy) add(d.happy > 0 ? '😊' : '😟', n(d.happy), `${n(d.happy)} happiness for everyone`, d.happy > 0);
  if (d.health) add('❤', n(d.health), 'Fewer sicknesses');
  if (d.heal) add('✚', '', 'Cures the sick');
  if (d.learn) add('📚', p(d.learn), `Skills grow ${p(d.learn)} faster`);
  if (d.fate) add('🍀', p(d.fate), `${p(d.fate)} luck`);
  if (d.karma) add(d.karma > 0 ? '😇' : '😈', n(d.karma), `${n(d.karma)} karma a day`, d.karma > 0);
  if (d.join) add('🚶', '', 'More wanderers join');
  if (d.defense) add('🛡', n(d.defense), `+${d.defense} defense`);
  if (d.combat) add('⚔', p(d.combat), `${p(d.combat)} combat`);
  if (d.raidPower) add('💥', p(d.raidPower), `Armies strike ${p(d.raidPower)} harder`);
  if (d.spot) add('👁', p(d.spot), `${p(d.spot)} chance to spot armies`);
  if (d.counterIntel) add('🕶', p(d.counterIntel), 'Enemy spies fail more often');
  if (d.lawful) add('⚖', '', 'Stops stealing');
  if (d.light) add('🔥', '', 'Lights the night');
  if (d.nearWater) add('🌊', '', 'Must be next to water', false);
  if (d.missile) add('☢', '', 'Can strike other realms', false);
  if (d.robots) add('🤖', d.robots, `Builds up to ${d.robots} robots`);
  const ability = ABILITIES[type];
  if (ability) add(ability.icon, 'ability', `Ability — ${ability.name}: ${ability.desc}`);
  return out;
}
const RES_EMOJI = { food: '🍖', wood: '🪵', stone: '🪨', coal: '⚫', iron: '⛓', gold: '💰', gems: '💎', science: '🔬', weapons: '🗡', bombs: '💣', influence: '☀' };

/**
 * Everything a building does, generated from its real game data.
 * Returns [{ icon, text, good }] so every screen explains buildings the same way.
 */
export function describeBuilding(type) {
  const d = BUILDINGS[type];
  const out = [];
  const add = (icon, text, good = true) => out.push({ icon, text, good });

  const ability = ABILITIES[type];
  if (ability) add(ability.icon, `Ability — ${ability.name}: ${ability.desc}`);
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
