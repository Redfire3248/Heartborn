// Laws shape what kind of civilization you build. One law per category is in force.
// Every law is a trade-off. Effects are summed by game.recalc() into game.law.
export const LAW_CATEGORIES = [
  {
    id: 'government', name: 'Government', icon: 'items/crown_leader',
    options: [
      { id: 'council',   name: 'Tribal Council', desc: 'The elders decide together.', effects: { happy: 5 } },
      { id: 'monarchy',  name: 'Monarchy',       era: 1, desc: 'One ruler, one voice. Strong armies and growing influence.', effects: { influence: 2, combat: 0.1, happy: -3 } },
      { id: 'theocracy', name: 'Theocracy',      era: 1, requires: 'shrine', desc: 'Priests rule in the name of the gods. Fate favours you, work slows for prayer.', effects: { fate: 0.15, work: -0.1 } },
      { id: 'republic',  name: 'Republic',       era: 2, desc: 'The people choose their leaders. Productive and content, but soft in war.', effects: { work: 0.15, happy: 5, combat: -0.15, join: 0.05 } },
      { id: 'tyranny',   name: 'Tyranny',        era: 1, desc: 'Rule through fear. They work hard and hate you for it.', effects: { work: 0.25, happy: -20, karma: -1 } },
    ],
  },
  {
    id: 'economy', name: 'Economy', icon: 'items/icon_gold',
    options: [
      { id: 'barter',       name: 'Barter',        desc: 'Simple trade between neighbours.', effects: {} },
      { id: 'taxation',     name: 'Taxation',      era: 1, desc: 'Collect gold from every household each day.', effects: { goldPerPop: 0.5, happy: -6 } },
      { id: 'rationing',    name: 'Rationing',     desc: 'Everyone eats 30% less. Nobody is happy about it.', effects: { food: -0.3, happy: -8 } },
      { id: 'free_market',  name: 'Free Market',   era: 2, requires: 'market', desc: 'Markets earn triple gold and merchants flock in.', effects: { marketMult: 3, happy: 3, join: 0.05 } },
      { id: 'forced_labor', name: 'Forced Labour', era: 1, desc: 'Work from dawn to dusk under the whip.', effects: { work: 0.35, happy: -15, karma: -1 } },
    ],
  },
  {
    id: 'military', name: 'Military', icon: 'items/sword',
    options: [
      { id: 'peace',        name: 'Peaceful',     desc: 'Tools over swords. A calmer people.', effects: { happy: 4 } },
      { id: 'militia',      name: 'Militia',      desc: 'Villagers take up arms by themselves the moment scouts spot an army.', effects: { defense: 5, autoRally: true } },
      { id: 'conscription', name: 'Conscription', era: 1, desc: 'Every adult trains for war. Strong defence, unhappy farmers.', effects: { combat: 0.3, defense: 10, autoRally: true, happy: -6 } },
      { id: 'warmonger',    name: 'Warmonger',    era: 2, requires: 'barracks', desc: 'Conquest is glory. Armies march twice as often and hit harder.', effects: { raidCooldown: 0.5, combat: 0.2, karma: -0.5 } },
    ],
  },
  {
    id: 'faith', name: 'Faith', icon: 'buildings/shrine',
    options: [
      { id: 'old_gods',    name: 'Old Gods',          desc: 'The traditional ways of your ancestors.', effects: {} },
      { id: 'sun_cult',    name: 'Sun Cult',          requires: 'shrine', desc: 'Worship of light. Luck and goodness grow.', effects: { fate: 0.1, karma: 0.5 } },
      { id: 'blood_rites', name: 'Blood Rites',       requires: 'shrine', desc: 'The gods demand blood. Great luck, double reward for sacrifices.', effects: { fate: 0.25, sacrifice: 2, karma: -1.5, happy: -5 } },
      { id: 'freedom',     name: 'Freedom of Belief', era: 2, desc: 'Let all worship as they wish. Happy people, many newcomers.', effects: { happy: 8, join: 0.1, fate: -0.05 } },
    ],
  },
];

export const DEFAULT_LAWS = { government: 'council', economy: 'barter', military: 'peace', faith: 'old_gods' };
export const LAW_COST = { influence: 25 };

export const NO_LAW_EFFECTS = {
  happy: 0, work: 0, combat: 0, defense: 0, fate: 0, influence: 0, goldPerPop: 0, karma: 0,
  food: 0, marketMult: 1, raidCooldown: 1, sacrifice: 1, join: 0, autoRally: false,
};

export function lawOption(category, id) {
  return LAW_CATEGORIES.find(c => c.id === category)?.options.find(o => o.id === id) || null;
}

/** Short human-readable effect chips. */
export function describeEffects(e) {
  const out = [];
  const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (e.work) out.push([`${pct(e.work)} work`, e.work > 0]);
  if (e.combat) out.push([`${pct(e.combat)} combat`, e.combat > 0]);
  if (e.fate) out.push([`${pct(e.fate)} luck`, e.fate > 0]);
  if (e.happy) out.push([`${e.happy > 0 ? '+' : ''}${e.happy} happiness`, e.happy > 0]);
  if (e.defense) out.push([`+${e.defense} defense`, true]);
  if (e.influence) out.push([`+${e.influence} influence/day`, true]);
  if (e.goldPerPop) out.push([`+${e.goldPerPop} gold/villager/day`, true]);
  if (e.food) out.push([`${pct(e.food)} food eaten`, true]);
  if (e.marketMult > 1) out.push([`×${e.marketMult} market gold`, true]);
  if (e.raidCooldown < 1) out.push(['faster raids', true]);
  if (e.sacrifice > 1) out.push(['×2 sacrifice reward', true]);
  if (e.join) out.push(['more newcomers', true]);
  if (e.autoRally) out.push(['auto-rally on attack', true]);
  if (e.karma) out.push([`${e.karma > 0 ? '+' : ''}${e.karma} karma/day`, e.karma > 0]);
  return out;
}
