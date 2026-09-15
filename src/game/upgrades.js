/*
 * Job upgrades: invest in a position (Builder, Woodcutter, Miner...) and everyone in it works faster.
 * Every level is +10% speed, up to level 10 (twice as fast). Each level costs more than the last.
 */

export const MAX_LEVEL = 10;
export const PER_LEVEL = 0.1;

// the jobs you can upgrade, and the kinds of work each one speeds up
export const UPGRADES = {
  build: { label: 'Builders', tasks: ['build'] },
  chop: { label: 'Woodcutters', tasks: ['chop'] },
  mine: { label: 'Miners', tasks: ['mine', 'deepmine'] },
  farm: { label: 'Farmers', tasks: ['farm'] },
  fish: { label: 'Fishers', tasks: ['fish'] },
  hunt: { label: 'Hunters', tasks: ['hunt'] },
  gather: { label: 'Gatherers', tasks: ['gather'] },
  smith: { label: 'Smiths', tasks: ['craft'] },
};

const TASK_JOB = Object.fromEntries(Object.entries(UPGRADES).flatMap(([job, u]) => u.tasks.map(t => [t, job])));

export const jobLevel = (g, job) => g.state.upgrades?.[job] || 0;

/** Speed multiplier from upgrades for a kind of work. */
export function upgradeSpeed(g, taskType) {
  const job = TASK_JOB[taskType];
  return job ? 1 + jobLevel(g, job) * PER_LEVEL : 1;
}

/** What the next level costs: more wood and stone each time, gold growing faster, iron from level 5. */
export function upgradeCost(g, job) {
  const next = jobLevel(g, job) + 1;
  const cost = { wood: 40 * next, stone: 25 * next, gold: 10 * next * next };
  if (next >= 5) cost.iron = 15 * (next - 3);
  if (next >= 8) cost.science = 40 * (next - 6);
  return cost;
}

export function upgradeJob(g, job) {
  if (!UPGRADES[job]) return { error: 'This position cannot be upgraded' };
  const level = jobLevel(g, job);
  if (level >= MAX_LEVEL) return { error: `${UPGRADES[job].label} are already at the top level` };
  const cost = upgradeCost(g, job);
  if (!g.spend(cost)) return { error: 'Not enough resources' };
  (g.state.upgrades ||= {})[job] = level + 1;
  const pct = (level + 1) * PER_LEVEL * 100;
  g.log(`${UPGRADES[job].label} upgraded to level ${level + 1}: they work ${Math.round(pct)}% faster.`, 'good');
  g.announce(`${UPGRADES[job].label} level ${level + 1}!`);
  g.emit('change');
  return { ok: true, level: level + 1 };
}

// ------------------------------------------------------------------ court offices

export const OFFICE_UPGRADES = {
  master_builder: {
    label: 'Master Builder', max: 5,
    effect: level => `${2 + level} projects at once, plans every ${Math.max(6, 20 - level * 3)}s`,
  },
};

export const officeLevel = (g, key) => g.state.officeLevels?.[key] || 0;

export function officeUpgradeCost(g, key) {
  const next = officeLevel(g, key) + 1;
  return { wood: 60 * next, stone: 40 * next, gold: 25 * next * next, influence: 20 * next };
}

export function upgradeOffice(g, key) {
  const def = OFFICE_UPGRADES[key];
  if (!def) return { error: 'This office cannot be upgraded' };
  const level = officeLevel(g, key);
  if (level >= def.max) return { error: `The ${def.label} is already at the top level` };
  if (!g.spend(officeUpgradeCost(g, key))) return { error: 'Not enough resources' };
  (g.state.officeLevels ||= {})[key] = level + 1;
  g._courtTimers = {};
  g.log(`The ${def.label} office rises to level ${level + 1}: ${def.effect(level + 1)}.`, 'good');
  g.announce(`${def.label} level ${level + 1}!`);
  g.emit('change');
  return { ok: true, level: level + 1 };
}
