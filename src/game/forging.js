/*
 * The Forge (at a Crafting Table): put materials in, get a random weapon or piece of armour out. What you put in
 * decides what can come out, how strong it is, its rarity and its traits (like Roblox's The Forge):
 *
 *   - every material leans toward certain weapons (silver toward rapiers and holy blades, magmite toward flame swords...)
 *   - the power is the average of the materials' multipliers, weighted by how much of each you use
 *   - the rarity comes from the materials, and a great forging (the minigames) can raise it
 *   - a material that makes up a quarter or more of the mix gives its trait (Burn, Chill, Holy, Drain...)
 *
 * Bosses drop special materials that unlock their own weapons and the strongest traits.
 */
import { CATALOG, RARITY, makeGear, takeGear, rpgOf, questProgress } from './rpg.js';
import { luckOf } from './loot.js';
import { TOOLS, giveTool } from './tools.js';

/** Tools you can forge (tiered ones), by kind, weakest first. */
export const FORGE_TOOL_KINDS = ['pickaxe', 'axe', 'shovel', 'hoe', 'sickle', 'hammer', 'fishing_rod'];
const toolsOfKind = kind => Object.entries(TOOLS).filter(([, t]) => t.kind === kind && t.mat && !t.utility).sort((a, b) => a[1].power - b[1].power);

/** Forge materials. `mult`: power; `rarity`: 0 Common .. 4 Mythic; `trait`: given at 25%+; `pool`: weapons it leans to. */
export const MATERIALS = {
  copper:       { name: 'Copper', mult: 0.85, rarity: 0, trait: null, icon: 'items/icon_copper', pool: ['short_sword', 'dagger', 'hand_axe', 'spear', 'club'] },
  iron:         { name: 'Iron', mult: 1, rarity: 0, trait: null, icon: 'items/icon_iron', pool: ['sword', 'longsword', 'mace', 'axe', 'spear', 'halberd'] },
  coal:         { name: 'Coal', mult: 0.9, rarity: 0, trait: null, icon: 'items/icon_coal', pool: ['club', 'hammer', 'flail'], filler: true },
  silver:       { name: 'Silver', mult: 1.15, rarity: 1, trait: 'holy', icon: 'items/icon_silver', pool: ['rapier', 'estoc', 'sabre', 'holy_scepter', 'holy_sword'] },
  gold:         { name: 'Gold', mult: 1.1, rarity: 1, trait: 'luck', icon: 'items/icon_gold', pool: ['scimitar', 'cutlass', 'falchion'] },
  gems:         { name: 'Gems', mult: 1.2, rarity: 2, trait: 'magic', icon: 'items/icon_gem', pool: ['crystal_orb', 'lightning_wand', 'spellbook', 'magic_staff'] },
  obsidian:     { name: 'Obsidian', mult: 1.35, rarity: 2, trait: 'crit', icon: 'items/icon_obsidian', pool: ['katana', 'war_pick', 'double_axe', 'wakizashi'] },
  frostite:     { name: 'Frostite', mult: 1.45, rarity: 3, trait: 'chill', icon: 'items/icon_frostite', pool: ['frost_sword', 'ice_staff', 'glaive', 'runic_blade'] },
  magmite:      { name: 'Magmite', mult: 1.55, rarity: 3, trait: 'burn', icon: 'items/icon_magmite', pool: ['flame_sword', 'fire_staff', 'maul', 'bardiche'] },
  mythril:      { name: 'Mythril', mult: 1.6, rarity: 3, trait: 'swift', icon: 'items/icon_mythril', pool: ['runic_blade', 'thunder_sword', 'longbow', 'zweihander'] },
  jade:         { name: 'Jade', mult: 1.15, rarity: 1, trait: 'heal', icon: 'items/icon_jade', pool: ['machete', 'quarterstaff', 'druid_staff'] },
  cobalt:       { name: 'Cobalt', mult: 1.3, rarity: 2, trait: 'swift', icon: 'items/icon_cobalt', pool: ['sabre', 'estoc', 'twin_daggers', 'longbow'] },
  moonstone:    { name: 'Moonstone', mult: 1.35, rarity: 2, trait: 'drain', icon: 'items/icon_moonstone', pool: ['scythe', 'shadow_blade', 'bone_wand'] },
  titanium:     { name: 'Titanium', mult: 1.45, rarity: 3, trait: 'quake', icon: 'items/icon_titanium', pool: ['zweihander', 'great_axe', 'halberd', 'maul'] },
  sunstone:     { name: 'Sunstone', mult: 1.5, rarity: 3, trait: 'holy', icon: 'items/icon_sunstone', pool: ['holy_sword', 'holy_scepter', 'falchion'] },
  voidstone:    { name: 'Voidstone', mult: 1.95, rarity: 4, trait: 'magic', icon: 'items/icon_voidstone', pool: ['crystal_orb', 'thunder_sword', 'spellbook', 'runic_blade'] },
  // boss materials
  troll_hide:   { off: true, name: 'Troll Hide', mult: 1.5, rarity: 3, trait: 'quake', boss: 'cave_troll', icon: 'characters/cave_troll', pool: ['maul', 'great_axe', 'club', 'greatsword'] },
  slime_core:   { name: 'Slime Core', mult: 1.45, rarity: 3, trait: 'poison', boss: 'slime_king', icon: 'characters/slime', pool: ['whip', 'bone_wand', 'kukri'] },
  spider_silk:  { name: 'Spider Silk', mult: 1.5, rarity: 3, trait: 'poison', boss: 'spider_queen', icon: 'characters/giant_spider', pool: ['twin_daggers', 'crossbow', 'naginata'] },
  spirit_bark:  { name: 'Spirit Bark', mult: 1.65, rarity: 4, trait: 'heal', boss: 'forest_spirit', icon: 'characters/forest_spirit', pool: ['druid_staff', 'longbow', 'holy_sword', 'quarterstaff'] },
  golem_heart:  { name: 'Golem Heart', mult: 1.75, rarity: 4, trait: 'quake', boss: 'stone_golem', icon: 'characters/stone_golem', pool: ['greatsword', 'maul', 'zweihander'] },
  lich_soul:    { name: 'Lich Soul', mult: 1.85, rarity: 4, trait: 'drain', boss: 'lich', icon: 'characters/lich', pool: ['necro_staff', 'shadow_blade', 'scythe'] },
  dragon_scale: { name: 'Dragon Scale', mult: 2.1, rarity: 4, trait: 'burn', boss: 'dragon', icon: 'characters/dragon', pool: ['flame_sword', 'holy_sword', 'thunder_sword', 'greatsword'] },
};
export const BOSS_MATERIAL = Object.fromEntries(Object.entries(MATERIALS).filter(([, m]) => m.boss && !m.off).map(([k, m]) => [m.boss, k]));
export const MATERIAL_KEYS = Object.keys(MATERIALS).filter(k => !MATERIALS[k].off);

/** A drop worth a special look: boss materials and the rarest metals. Returns its rarity (0..4) or -1. */
export const specialDrop = res => (MATERIALS[res] && !MATERIALS[res].off && (MATERIALS[res].boss || MATERIALS[res].rarity >= 3) ? Math.max(3, MATERIALS[res].rarity) : -1);

/** What each trait does on your weapon. */
export const TRAITS = {
  holy:   { name: 'Holy', color: '#fff3b0', desc: 'Extra damage to the undead, and Holy Light (F)' },
  luck:   { name: 'Fortune', color: '#ffd76a', desc: 'Foes drop extra gold' },
  magic:  { name: 'Arcane', color: '#c08aff', desc: 'Hits arc to a nearby foe' },
  crit:   { name: 'Keen', color: '#ff8a7a', desc: '15% chance to strike for double' },
  chill:  { name: 'Frost', color: '#9fd4ff', desc: 'Chills foes, sometimes freezing them' },
  burn:   { name: 'Flame', color: '#ff9a3a', desc: 'Sets foes on fire' },
  swift:  { name: 'Swift', color: '#9fffe0', desc: 'Sometimes strikes twice' },
  quake:  { name: 'Quake', color: '#c8a070', desc: 'Combo finishers shake the ground around you' },
  poison: { name: 'Venom', color: '#8fe07a', desc: 'Poisons foes' },
  heal:   { name: 'Life', color: '#7aff9a', desc: 'Every hit heals you a little' },
  drain:  { name: 'Drain', color: '#b06aff', desc: 'Heals you for part of the damage you deal' },
};

/** Traits turned into the same effects blade specials use. */
export function traitEffects(traits = []) {
  const sp = {};
  for (const t of traits) {
    if (t === 'holy') sp.undead = Math.max(sp.undead || 1, 1.7);
    if (t === 'luck') sp.plunder = [1, 6];
    if (t === 'magic') sp.chain = { count: 1, range: 3, share: 0.45 };
    if (t === 'crit') sp.keen = 0.15;
    if (t === 'chill') sp.chill = { k: 0.6, secs: 2, freeze: 0.08 };
    if (t === 'burn') sp.burn = { dps: 4, secs: 3 };
    if (t === 'swift') sp.swift = 0.15;
    if (t === 'quake') sp.shockwave = { radius: 2.2, share: 0.45 };
    if (t === 'poison') sp.bleed = { chance: 0.4, dps: 3, secs: 4 };
    if (t === 'heal') sp.heal = 2;
    if (t === 'drain') sp.lifesteal = 0.1;
  }
  return sp;
}

const exists = base => !!CATALOG.weapon[base] && !CATALOG.weapon[base].admin;
const ARMOUR = () => [...Object.entries(CATALOG.armor), ...Object.entries(CATALOG.helmet), ...Object.entries(CATALOG.shield)]
  .filter(([, d]) => !d.admin && !d.noLoot && d.icon !== null).map(([k]) => k);

/**
 * What a mix of materials would make. `mix`: { material: count }; `kind`: 'weapon' | 'armour'.
 * Returns { ok, why, total, mult, rarity, traits, odds: [{ base, chance }] }.
 */
export function forgePreview(mix, kind = 'weapon', toolKind = 'pickaxe') {
  const entries = Object.entries(mix).filter(([k, n]) => MATERIALS[k] && n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (total < 3) return { ok: false, why: 'Put in at least 3 materials', total, odds: [], traits: [] };
  const share = k => (mix[k] || 0) / total;
  const mult = entries.reduce((a, [k, n]) => a + MATERIALS[k].mult * n, 0) / total * (1 + Math.min(0.25, (total - 3) * 0.02));   // more material, a little more power
  const rarity = Math.min(4, Math.round(entries.reduce((a, [k, n]) => a + MATERIALS[k].rarity * n, 0) / total));
  const traits = [...new Set(entries.filter(([k]) => MATERIALS[k].trait && share(k) >= 0.25).sort((a, b) => b[1] - a[1]).map(([k]) => MATERIALS[k].trait))].slice(0, 2);
  if (kind === 'tool') {   // the materials set a power to aim at; the dice land near it (a little worse or better)
    const aim = mult * 5;   // copper aims at bronze, iron at iron, mythril at diamond, dragon scale near lava
    const odds0 = toolsOfKind(toolKind).map(([k, t]) => ({ base: k, w: Math.exp(-((t.power - aim) ** 2) / 2.4) })).filter(o => o.w > 0.02);
    const tsum = odds0.reduce((a, o) => a + o.w, 0);
    if (!tsum) return { ok: false, why: 'No tool of that kind can be forged from this', total, odds: [], traits: [] };
    return { ok: true, total, mult, rarity, traits: [], aim, odds: odds0.map(o => ({ base: o.base, chance: o.w / tsum })).sort((a, b) => b.chance - a.chance) };
  }
  const weights = {};
  if (kind === 'weapon') {
    for (const [k, n] of entries) {
      const pool = MATERIALS[k].pool.filter(exists);
      for (const b of pool) weights[b] = (weights[b] || 0) + n / pool.length;
    }
  } else {
    const all = ARMOUR();
    for (const b of all) weights[b] = 1;
  }
  // pieces that only exist at a higher rarity need a strong enough mix
  for (const b of Object.keys(weights)) {
    const def = CATALOG.weapon[b] || CATALOG.armor[b] || CATALOG.helmet[b] || CATALOG.shield[b];
    if ((def?.minRarity || 0) > rarity + 1) delete weights[b];
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!sum) return { ok: false, why: 'Nothing can be forged from this', total, odds: [], traits };
  const odds = Object.entries(weights).map(([base, w]) => ({ base, chance: w / sum })).sort((a, b) => b.chance - a.chance);
  return { ok: true, total, mult, rarity, traits, odds };
}

/** Do you have the materials? */
export const canPay = (g, mix) => Object.entries(mix).every(([k, n]) => (g.state.resources[k] || 0) >= n);

/**
 * Forge it: use the materials and roll the result. `score` (0..1) is how well the minigames went:
 * it can raise the rarity and the power a little. Returns { ok, item, preview }.
 */
/** Rolls which piece a mix makes (from the preview's odds), so the forge can show it before it is done. */
export function rollForgeBase(p) {
  let x = Math.random();
  for (const o of p.odds) { x -= o.chance; if (x < 0) return o.base; }
  return p.odds[p.odds.length - 1].base;
}

export function forge(g, mix, kind = 'weapon', { score = 0.5, hero = null, base = null, toolKind = 'pickaxe' } = {}) {
  const p = forgePreview(mix, kind, toolKind);
  if (!p.ok) return { ok: false, why: p.why };
  if (!canPay(g, mix)) return { ok: false, why: 'You do not have those materials' };
  for (const [k, n] of Object.entries(mix)) g.state.resources[k] -= n;
  if (!base || !p.odds.some(o => o.base === base)) base = rollForgeBase(p);
  if (kind === 'tool') {
    let key = base, bump = 0;
    // a great forging (and luck) can lift it a tier; a lucky one makes two
    if (Math.random() < Math.max(0, score - 0.6) * 0.9 + luckOf(g) * 0.3) {
      const better = toolsOfKind(TOOLS[key].kind).find(([, t]) => t.power > TOOLS[key].power);
      if (better) { key = better[0]; bump = 1; }
    }
    const extra = Math.random() < 0.04 + score * 0.1 ? 1 : 0;
    giveTool(g, key, 1 + extra);
    const r = rpgOf(g);
    r.forged = (r.forged || 0) + 1;
    questProgress(g, 'forge', { v: hero });
    g.emit('change');
    return { ok: true, tool: key, name: TOOLS[key].name, icon: TOOLS[key].icon, fallbackIcon: TOOLS[key].fallbackIcon, preview: p, bump, extra };
  }
  const luck = luckOf(g);
  const bump = Math.random() < Math.max(0, score - 0.6) * 0.9 + luck * 0.3 ? 1 : 0;   // a great forging can lift the rarity
  const it = makeGear(g, base, Math.min(4, p.rarity + bump));
  const power = p.mult * (0.9 + score * 0.25);
  if (it.dmg) it.dmg = Math.max(1, Math.round(it.dmg * power));
  if (it.armor) it.armor = Math.min(0.85, Math.round(it.armor * power * 100) / 100);
  if (it.block) it.block = Math.min(0.98, Math.round(it.block * (1 + (power - 1) * 0.4) * 100) / 100);
  it.traits = p.traits;
  const main = Object.entries(mix).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0][0];
  it.material = main;
  const rar = RARITY[it.rarity].name;
  it.name = it.name.startsWith(rar + ' ') ? `${rar} ${MATERIALS[main].name} ${it.name.slice(rar.length + 1)}` : `${MATERIALS[main].name} ${it.name}`;
  it.forgeScore = Math.round(score * 100);
  takeGear(g, it, hero);
  const r = rpgOf(g);
  r.forged = (r.forged || 0) + 1;
  questProgress(g, 'forge', { v: hero });
  g.emit('change');
  return { ok: true, item: it, preview: p, bump };
}

// ------------------------------------------------------------------ active abilities (F)

/** Abilities: by weapon, or from a weapon's first trait. `cd` seconds. */
export const ABILITIES = {
  holy_light:   { name: 'Holy Light', cd: 12, color: '#fff3b0', desc: 'A burst of light: heals you, burns and dazes foes around you (double against the undead)' },
  flame_wave:   { name: 'Flame Wave', cd: 8, color: '#ff9a3a', desc: 'A wave of fire in front of you that sets foes ablaze' },
  frost_nova:   { name: 'Frost Nova', cd: 10, color: '#9fd4ff', desc: 'Freezes every foe around you' },
  thunderstorm: { name: 'Thunderstorm', cd: 10, color: '#fff27a', desc: 'Lightning strikes up to 4 foes near you' },
  shadow_step:  { name: 'Shadow Step', cd: 7, color: '#b06aff', desc: 'Vanish and strike the nearest foe from behind for triple damage' },
  soul_reap:    { name: 'Soul Reap', cd: 9, color: '#8aff9a', desc: 'A sweeping spin that heals you for each foe it hits' },
  iaido:        { name: 'Iaido Dash', cd: 7, color: '#ff8a7a', desc: 'Dash forward, cutting everything in your path' },
  regrowth:     { name: 'Regrowth', cd: 16, color: '#7aff9a', desc: 'Heals 40% of your health over a few seconds' },
  earthsplitter:{ name: 'Earthsplitter', cd: 10, color: '#c8a070', desc: 'Slam the ground: a shockwave hits and dazes everything near you' },
};
const BY_BASE = {
  holy_sword: 'holy_light', holy_scepter: 'holy_light', flame_sword: 'flame_wave', fire_staff: 'flame_wave', frost_sword: 'frost_nova', ice_staff: 'frost_nova',
  thunder_sword: 'thunderstorm', lightning_wand: 'thunderstorm', shadow_blade: 'shadow_step', necro_staff: 'shadow_step', scythe: 'soul_reap',
  katana: 'iaido', wakizashi: 'iaido', druid_staff: 'regrowth', greatsword: 'earthsplitter', maul: 'earthsplitter', zweihander: 'earthsplitter',
  god_sword: 'thunderstorm', infinity_blade: 'shadow_step', ban_hammer: 'earthsplitter', cosmic_scythe: 'soul_reap', energy_sword: 'flame_wave', storm_god_hammer: 'thunderstorm', void_dagger: 'shadow_step',
};
const BY_TRAIT = { holy: 'holy_light', burn: 'flame_wave', chill: 'frost_nova', magic: 'thunderstorm', drain: 'shadow_step', heal: 'regrowth', quake: 'earthsplitter' };

/** The ability a weapon (gear item or base) gives, if any. */
export function abilityOf(item) {
  if (!item) return null;
  const id = BY_BASE[item.base] || BY_TRAIT[item.traits?.[0]];
  return id ? { id, ...ABILITIES[id] } : null;
}

