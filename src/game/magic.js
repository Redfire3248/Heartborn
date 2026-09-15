import { TILE, DAY_LENGTH, ADULT_AGE } from '../core/constants.js';
import { clamp } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { damageCreature } from './creatures.js';

/*
 * Magic: people born with the Magic talent become Wizards. They study at a Mage Tower (slowly on their own),
 * build up mana, and cast spells: automatically when monsters come or someone is hurt, or when you ask.
 */

export const SPELLS = {
  heal: { label: 'Healing Light', mana: 30, minSkill: 0, icon: 'effects/plus_heal', desc: 'Heals the most hurt person nearby (+50 health) and cures sickness.' },
  fireball: { label: 'Fireball', mana: 25, minSkill: 1, icon: 'effects/flame', desc: 'Hurls fire at the nearest hostile creature.' },
  bless: { label: 'Bless the Harvest', mana: 50, minSkill: 3, icon: 'effects/magic_orb', desc: 'Food now, and everyone works faster for a day.' },
  ward: { label: 'Arcane Ward', mana: 60, minSkill: 4, icon: 'units/energy_shield', desc: '+15 defense for the village for a day.' },
  storm: { label: 'Lightning Storm', mana: 80, minSkill: 6, icon: 'effects/lightning', desc: 'Lightning strikes every hostile creature near the village.' },
};

export const isWizard = v => v.job === 'mage' && v.age >= ADULT_AGE && !v.away && !v.jailed;
const magicSkill = v => v.skills?.magic || 0;

const hostilesNear = (g, x, y, tiles) => g.state.creatures.filter(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - x, c.y - y) < tiles * TILE);

function beam(g, from, to, color) {
  if (g.offline) return;
  (g.fx.beams ||= []).push({ x1: from.x, y1: from.y - TILE * 0.6, x2: to.x, y2: to.y - TILE * 0.3, color, life: 0.45, max: 0.45 });
}

/** Can this wizard cast this spell right now? true, or the reason why not. */
export function canCast(g, v, id) {
  const sp = SPELLS[id];
  if (!sp) return 'Unknown spell';
  if (!isWizard(v)) return 'Only wizards at home can cast';
  if (magicSkill(v) < sp.minSkill) return `Needs magic ${sp.minSkill}`;
  if ((v.mana || 0) < sp.mana) return `Needs ${sp.mana} mana`;
  if (id === 'fireball' && !hostilesNear(g, v.x, v.y, 12).length) return 'No monsters in range';
  if (id === 'storm' && !hostilesNear(g, g.center.x, g.center.y, 16).length) return 'No monsters near the village';
  if (id === 'heal' && !woundedNear(g, v)) return 'Nobody needs healing';
  return true;
}

const woundedNear = (g, v) => g.state.villagers.filter(x => (x.hp < 90 || x.sick) && !x.away && Math.hypot(x.x - v.x, x.y - v.y) < TILE * 12)
  .sort((a, b) => a.hp - b.hp)[0] || null;

export function castSpell(g, v, id) {
  const ok = canCast(g, v, id);
  if (ok !== true) return { error: ok };
  const sp = SPELLS[id];
  const power = 1 + magicSkill(v) * 0.15;
  v.mana -= sp.mana;
  let text = '';
  switch (id) {
    case 'heal': {
      const x = woundedNear(g, v);
      x.hp = Math.min(Math.max(100, x.hp), x.hp + 50 * power);
      x.sick = 0;
      beam(g, v, x, '#9dff8a');
      g.puff(x, 'effects/plus_heal', 6, 16);
      text = x === v ? `${v.name} heals their own wounds` : `${v.name} heals ${x.name}`;
      break;
    }
    case 'fireball': {
      const c = hostilesNear(g, v.x, v.y, 12).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      beam(g, v, c, '#ff8a3a');
      g.puff(c, 'effects/flame', 8, 18);
      damageCreature(g, c, Math.round(30 * power), v);
      text = `${v.name} casts Fireball`;
      break;
    }
    case 'bless': {
      const food = Math.round(20 * power + g.state.villagers.length);
      g.addResource('food', food);
      g.state.modifiers.push({ id: 'blessed_harvest', work: 0.15, happy: 5, until: g.state.time + DAY_LENGTH });
      g.recalc();
      g.puff(g.center, 'effects/magic_orb', 14, 60);
      text = `${v.name} blesses the harvest: +${food} food, faster work for a day`;
      break;
    }
    case 'ward': {
      g.state.modifiers.push({ id: 'arcane_ward', defense: 15, until: g.state.time + DAY_LENGTH });
      g.recalc();
      g.puff(g.center, 'effects/ice_crystal', 16, 70);
      text = `${v.name} raises an Arcane Ward: +15 defense for a day`;
      break;
    }
    case 'storm': {
      const targets = hostilesNear(g, g.center.x, g.center.y, 16);
      for (const c of targets) { beam(g, { x: c.x, y: c.y - TILE * 6 }, c, '#bfe3ff'); g.puff(c, 'effects/lightning', 3, 6); damageCreature(g, c, Math.round(45 * power), v); }
      g.fx.shake = 1.5;
      text = `${v.name} calls down a Lightning Storm on ${targets.length} monster${targets.length === 1 ? '' : 's'}`;
      break;
    }
  }
  // casting is how wizards improve
  v.skills.magic = Math.min(10, magicSkill(v) + 0.08);
  g.float(v.x, v.y - TILE * 1.3, sp.label, '#b8a4ff');
  g.log(`${text}.`, 'good', v);
  g.emit('change');
  return { text };
}

/** Mana comes back over time; wizards defend and heal on their own. */
export function updateMagic(g, dt) {
  if (g.visiting) return;
  g._magicT = (g._magicT || 0) + dt;
  if (g._magicT < 0.5) return;
  const step = g._magicT;
  g._magicT = 0;
  for (const v of g.state.villagers) {
    if (v.job !== 'mage') continue;
    v.mana = clamp((v.mana || 0) + step * (0.6 + magicSkill(v) * 0.2) * (g.hasBuilding('mage_tower') ? 1.5 : 1), 0, 100);
    if (!isWizard(v) || g.offline) continue;
    if (magicSkill(v) >= 6 && v.mana >= 80 && hostilesNear(g, g.center.x, g.center.y, 16).length >= 3) castSpell(g, v, 'storm');
    else if (v.mana >= 25 && canCast(g, v, 'fireball') === true) castSpell(g, v, 'fireball');
    else if (v.mana >= 30) { const x = woundedNear(g, v); if (x && (x.hp < 50 || x.sick)) castSpell(g, v, 'heal'); }
  }
}
