import { TILE } from '../core/constants.js';
import { popResource, lucky, ORE_RESOURCE } from './loot.js';
import { gameTheme } from './worldTypes.js';
import { CREATURES } from '../data/objects.js';
import { dropPickup, chestsOf } from './treasure.js';

/*
 * The player's own progression, RPG style. You are your avatar: you level up from fights, bounties and quests,
 * spend points on Might, Vigor and Agility, and wear gear that drops from monsters in four rarities.
 * Progress belongs to you (state.rpg), so it stays when you choose a different villager to play as.
 */

export const RARITY = [
  { name: 'Common', color: '#d9d4c7', mult: 1 },
  { name: 'Rare', color: '#5aa9ff', mult: 1.25 },
  { name: 'Epic', color: '#c77dff', mult: 1.55 },
  { name: 'Legendary', color: '#ffb347', mult: 2 },
  { name: 'Mythic', color: '#ff4d6d', mult: 2.6 },   // a rare boss drop
  { name: 'Admin', color: '#ff3cf0', mult: 4 },      // admin weapons only: never dropped or crafted
];
export const MYTHIC = 4, ADMIN = 5;

/*
 * The gear catalog. To add a new weapon, shield, armour or trinket: add one line here and put its picture in
 * public/assets/gear/<icon>.png (the Arsenal sheet). It then drops as loot, can be given with the admin `gear`
 * command, shows in the Character sheet and is held and swung in your hands. Until its picture exists, the
 * `fallbackIcon` is shown.
 */

// weapons: dmg per hit, range in tiles, speed = seconds between swings, arc = swing width, length = how long it is drawn
export const WEAPONS = {
  fists: { name: 'Fists', dmg: 6, range: 1.0, speed: 0.4, arc: 1.4, icon: null },
  pickaxe: { name: 'Pick', dmg: 13, range: 1.0, speed: 0.6, arc: 1.2, icon: 'items/pickaxe', noLoot: true },
  hoe: { name: 'Hoe', dmg: 9, range: 1.2, speed: 0.55, arc: 1.2, icon: 'items/hoe', noLoot: true },
  // swords
  sword: { name: 'Sword', dmg: 16, range: 1.3, speed: 0.48, arc: 1.9, icon: 'gear/sword_common' },
  short_sword: { name: 'Short Sword', dmg: 12, range: 1.1, speed: 0.36, arc: 1.6, icon: 'gear/short_sword', fallbackIcon: 'gear/sword_common', length: 0.8 },
  broadsword: { name: 'Broadsword', dmg: 20, range: 1.35, speed: 0.58, arc: 2.0, icon: 'gear/broadsword', fallbackIcon: 'gear/sword_common', length: 1.15 },
  rapier: { name: 'Rapier', dmg: 11, range: 1.4, speed: 0.34, arc: 1.0, crit: 0.08, icon: 'gear/rapier', fallbackIcon: 'gear/sword_common', length: 1.05 },
  katana: { name: 'Katana', dmg: 15, range: 1.35, speed: 0.4, arc: 1.7, crit: 0.12, icon: 'gear/katana', fallbackIcon: 'gear/sword_rare', length: 1.1 },
  scimitar: { name: 'Scimitar', dmg: 15, range: 1.25, speed: 0.44, arc: 2.2, icon: 'gear/scimitar', fallbackIcon: 'gear/sword_rare', length: 1.0 },
  cutlass: { name: 'Cutlass', dmg: 14, range: 1.15, speed: 0.4, arc: 2.0, icon: 'gear/cutlass', fallbackIcon: 'gear/sword_common', length: 0.9 },
  greatsword: { name: 'Claymore', dmg: 28, range: 1.65, speed: 0.82, arc: 2.3, icon: 'gear/claymore', fallbackIcon: 'gear/sword_epic', length: 1.35 },
  flame_sword: { name: 'Flame Sword', dmg: 22, range: 1.35, speed: 0.5, arc: 2.0, minRarity: 2, icon: 'gear/flame_sword', fallbackIcon: 'gear/sword_legendary', length: 1.1 },
  frost_sword: { name: 'Frost Sword', dmg: 20, range: 1.35, speed: 0.5, arc: 2.0, stun: 0.4, minRarity: 2, icon: 'gear/frost_sword', fallbackIcon: 'gear/sword_rare', length: 1.1 },
  thunder_sword: { name: 'Thunder Sword', dmg: 21, range: 1.4, speed: 0.46, arc: 2.1, crit: 0.1, minRarity: 2, icon: 'gear/thunder_sword', fallbackIcon: 'gear/sword_epic', length: 1.1 },
  shadow_blade: { name: 'Shadow Blade', dmg: 18, range: 1.3, speed: 0.36, arc: 1.6, crit: 0.18, minRarity: 2, icon: 'gear/shadow_blade', fallbackIcon: 'gear/sword_epic', length: 1.05 },
  holy_sword: { name: 'Holy Sword', dmg: 26, range: 1.45, speed: 0.52, arc: 2.2, minRarity: 3, icon: 'gear/holy_sword', fallbackIcon: 'gear/sword_legendary', length: 1.2 },
  dagger: { name: 'Dagger', dmg: 8, range: 0.9, speed: 0.24, arc: 1.2, crit: 0.15, icon: 'gear/dagger', fallbackIcon: 'gear/sword_common', length: 0.6 },
  twin_daggers: { name: 'Twin Daggers', dmg: 10, range: 0.95, speed: 0.22, arc: 1.5, crit: 0.12, icon: 'gear/twin_daggers', fallbackIcon: 'gear/sword_common', length: 0.65 },
  // axes, clubs and polearms
  hand_axe: { name: 'Hand Axe', dmg: 15, range: 1.05, speed: 0.5, arc: 1.7, icon: 'gear/hand_axe', fallbackIcon: 'gear/battle_axe', length: 0.85 },
  axe: { name: 'Battle Axe', dmg: 19, range: 1.15, speed: 0.7, arc: 1.8, icon: 'gear/battle_axe' },
  great_axe: { name: 'Great Axe', dmg: 30, range: 1.4, speed: 0.9, arc: 2.2, stun: 0.3, icon: 'gear/great_axe', fallbackIcon: 'gear/battle_axe', length: 1.3 },
  hammer: { name: 'War Hammer', dmg: 24, range: 1.05, speed: 0.85, arc: 1.5, stun: 0.5, icon: 'gear/war_hammer' },
  mace: { name: 'Mace', dmg: 18, range: 1.05, speed: 0.6, arc: 1.6, stun: 0.3, icon: 'gear/mace', fallbackIcon: 'gear/war_hammer', length: 0.9 },
  morning_star: { name: 'Morning Star', dmg: 21, range: 1.1, speed: 0.66, arc: 1.7, stun: 0.35, icon: 'gear/morning_star', fallbackIcon: 'gear/war_hammer', length: 0.95 },
  flail: { name: 'Flail', dmg: 20, range: 1.3, speed: 0.7, arc: 2.4, stun: 0.25, icon: 'gear/flail', fallbackIcon: 'gear/war_hammer', length: 1.0 },
  spear: { name: 'Spear', dmg: 13, range: 1.8, speed: 0.6, arc: 0.8, icon: 'gear/spear' },
  lance: { name: 'Lance', dmg: 22, range: 2.1, speed: 0.8, arc: 0.6, icon: 'gear/lance', fallbackIcon: 'gear/spear', length: 1.4 },
  halberd: { name: 'Halberd', dmg: 25, range: 1.9, speed: 0.78, arc: 1.6, icon: 'gear/halberd', fallbackIcon: 'gear/spear', length: 1.4 },
  scythe: { name: 'War Scythe', dmg: 23, range: 1.6, speed: 0.72, arc: 2.6, icon: 'gear/war_scythe', fallbackIcon: 'items/hoe', length: 1.35 },
  club: { name: 'Spiked Club', dmg: 14, range: 1.0, speed: 0.55, arc: 1.6, stun: 0.25, icon: 'gear/spiked_club', fallbackIcon: 'gear/war_hammer', length: 0.9 },
  trident: { name: 'Trident', dmg: 19, range: 1.8, speed: 0.62, arc: 1.0, crit: 0.06, icon: 'gear/trident', fallbackIcon: 'gear/spear', length: 1.3 },
  // ranged and magic
  bow: { name: 'Bow', dmg: 12, range: 8, speed: 0.75, ranged: true, icon: 'gear/bow_common' },
  longbow: { name: 'Longbow', dmg: 16, range: 10, speed: 0.9, ranged: true, icon: 'gear/longbow', fallbackIcon: 'gear/bow_rare' },
  crossbow: { name: 'Crossbow', dmg: 22, range: 9, speed: 1.1, ranged: true, crit: 0.08, icon: 'gear/crossbow', fallbackIcon: 'gear/bow_common' },
  magic_staff: { name: 'Magic Staff', dmg: 18, range: 7, speed: 0.8, ranged: true, minRarity: 1, icon: 'gear/magic_staff', fallbackIcon: 'gear/staff', length: 1.2, shot: { kind: 'magic_bolt', speed: 12 } },
  // ---- from the Armory sheet
  // guns and thrown weapons (shot: kind, speed in tiles/s, count, spread, pierce, explode radius, effects)
  flintlock_pistol: { name: 'Flintlock Pistol', dmg: 26, range: 7, speed: 0.9, ranged: true, shot: { kind: 'bullet', speed: 22 }, icon: 'armory/flintlock_pistol' },
  musket: { name: 'Musket', dmg: 38, range: 11, speed: 1.3, ranged: true, shot: { kind: 'bullet', speed: 26 }, icon: 'armory/musket' },
  blunderbuss: { name: 'Blunderbuss', dmg: 14, range: 5, speed: 1.2, ranged: true, shot: { kind: 'bullet', speed: 20, count: 5, spread: 0.35 }, icon: 'armory/blunderbuss' },
  revolver: { name: 'Revolver', dmg: 18, range: 8, speed: 0.45, ranged: true, shot: { kind: 'bullet', speed: 24 }, minRarity: 1, icon: 'armory/revolver' },
  hunting_rifle: { name: 'Hunting Rifle', dmg: 42, range: 13, speed: 1.2, ranged: true, crit: 0.1, shot: { kind: 'bullet', speed: 30, pierce: 1 }, minRarity: 1, icon: 'armory/hunting_rifle' },
  shotgun: { name: 'Shotgun', dmg: 16, range: 6, speed: 1.0, ranged: true, shot: { kind: 'bullet', speed: 22, count: 6, spread: 0.4 }, minRarity: 1, icon: 'armory/shotgun' },
  slingshot: { name: 'Slingshot', dmg: 8, range: 6, speed: 0.5, ranged: true, shot: { kind: 'rock', speed: 12 }, icon: 'armory/slingshot' },
  throwing_axe: { name: 'Throwing Axe', dmg: 20, range: 6, speed: 0.7, ranged: true, shot: { kind: 'thrown', speed: 12, sprite: 'armory/throwing_axe', spin: true }, icon: 'armory/throwing_axe' },
  boomerang: { name: 'Boomerang', dmg: 14, range: 7, speed: 0.8, ranged: true, shot: { kind: 'thrown', speed: 11, sprite: 'armory/boomerang', spin: true, returns: true, pierce: 9 }, icon: 'armory/boomerang' },
  shuriken: { name: 'Shuriken', dmg: 10, range: 7, speed: 0.3, ranged: true, crit: 0.1, shot: { kind: 'thrown', speed: 16, sprite: 'armory/shuriken', spin: true, count: 3, spread: 0.18 }, icon: 'armory/shuriken' },
  harpoon: { name: 'Harpoon', dmg: 28, range: 7, speed: 1.0, ranged: true, shot: { kind: 'thrown', speed: 14, sprite: 'armory/harpoon', pierce: 1 }, icon: 'armory/harpoon' },
  // swords
  longsword: { name: 'Longsword', dmg: 19, range: 1.35, speed: 0.5, arc: 1.9, icon: 'armory/longsword', length: 1.1 },
  bastard_sword: { name: 'Bastard Sword', dmg: 23, range: 1.45, speed: 0.62, arc: 2.0, icon: 'armory/bastard_sword', length: 1.2 },
  falchion: { name: 'Falchion', dmg: 18, range: 1.2, speed: 0.5, arc: 2.1, icon: 'armory/falchion', length: 1.0 },
  sabre: { name: 'Sabre', dmg: 16, range: 1.3, speed: 0.4, arc: 1.9, crit: 0.06, icon: 'armory/sabre', length: 1.0 },
  gladius: { name: 'Gladius', dmg: 14, range: 1.05, speed: 0.36, arc: 1.5, icon: 'armory/gladius', length: 0.8 },
  machete: { name: 'Machete', dmg: 15, range: 1.1, speed: 0.42, arc: 2.0, icon: 'armory/machete', length: 0.9 },
  wakizashi: { name: 'Wakizashi', dmg: 13, range: 1.05, speed: 0.32, arc: 1.6, crit: 0.1, icon: 'armory/wakizashi', length: 0.85 },
  zweihander: { name: 'Zweihander', dmg: 32, range: 1.8, speed: 0.92, arc: 2.4, minRarity: 1, icon: 'armory/zweihander', length: 1.45 },
  estoc: { name: 'Estoc', dmg: 15, range: 1.5, speed: 0.38, arc: 0.9, crit: 0.12, icon: 'armory/estoc', length: 1.15 },
  kukri: { name: 'Kukri', dmg: 12, range: 0.95, speed: 0.3, arc: 1.4, crit: 0.1, icon: 'armory/kukri', length: 0.7 },
  runic_blade: { name: 'Runic Blade', dmg: 24, range: 1.4, speed: 0.45, arc: 2.0, minRarity: 2, icon: 'armory/runic_blade', length: 1.1 },
  // axes, blunt and polearms
  tomahawk: { name: 'Tomahawk', dmg: 16, range: 1.05, speed: 0.5, arc: 1.7, icon: 'armory/tomahawk', length: 0.85 },
  double_axe: { name: 'Double Axe', dmg: 26, range: 1.3, speed: 0.8, arc: 2.2, stun: 0.2, icon: 'armory/double_axe', length: 1.15 },
  war_pick: { name: 'War Pick', dmg: 22, range: 1.1, speed: 0.7, arc: 1.4, crit: 0.08, icon: 'armory/war_pick', length: 1.0 },
  maul: { name: 'Maul', dmg: 34, range: 1.2, speed: 1.0, arc: 1.8, stun: 0.6, minRarity: 1, icon: 'armory/maul', length: 1.2 },
  quarterstaff: { name: 'Quarterstaff', dmg: 12, range: 1.6, speed: 0.45, arc: 2.0, stun: 0.15, icon: 'armory/quarterstaff', length: 1.4 },
  glaive: { name: 'Glaive', dmg: 22, range: 1.8, speed: 0.7, arc: 1.8, icon: 'armory/glaive', length: 1.45 },
  naginata: { name: 'Naginata', dmg: 20, range: 1.8, speed: 0.6, arc: 1.9, icon: 'armory/naginata', length: 1.45 },
  pike: { name: 'Pike', dmg: 20, range: 2.2, speed: 0.75, arc: 0.5, icon: 'armory/pike', length: 1.6 },
  bardiche: { name: 'Bardiche', dmg: 26, range: 1.7, speed: 0.8, arc: 1.9, icon: 'armory/bardiche', length: 1.45 },
  whip: { name: 'Whip', dmg: 11, range: 2.4, speed: 0.5, arc: 1.2, stun: 0.1, icon: 'armory/whip', length: 1.0 },
  // magic
  fire_staff: { name: 'Fire Staff', dmg: 22, range: 8, speed: 0.8, ranged: true, shot: { kind: 'fireball', speed: 10, burn: { dps: 5, secs: 3 } }, minRarity: 1, icon: 'armory/fire_staff' },
  ice_staff: { name: 'Ice Staff', dmg: 18, range: 8, speed: 0.75, ranged: true, shot: { kind: 'ice_shard', speed: 13, chill: 2.5 }, minRarity: 1, icon: 'armory/ice_staff' },
  lightning_wand: { name: 'Lightning Wand', dmg: 16, range: 9, speed: 0.5, ranged: true, shot: { kind: 'lightning_bolt', speed: 20, pierce: 2 }, minRarity: 1, icon: 'armory/lightning_wand' },
  necro_staff: { name: 'Necromancer Staff', dmg: 20, range: 8, speed: 0.8, ranged: true, shot: { kind: 'dark_orb', speed: 8, homing: 2.2, lifesteal: 0.2 }, minRarity: 2, icon: 'armory/necro_staff' },
  holy_scepter: { name: 'Holy Sceptre', dmg: 18, range: 8, speed: 0.7, ranged: true, shot: { kind: 'heal_orb', speed: 10, undead: 2.5, heal: 3 }, minRarity: 2, icon: 'armory/holy_scepter' },
  spellbook: { name: 'Spellbook', dmg: 14, range: 8, speed: 0.35, ranged: true, shot: { kind: 'magic_bolt', speed: 12, count: 3, spread: 0.25 }, minRarity: 1, icon: 'armory/spellbook' },
  crystal_orb: { name: 'Crystal Orb', dmg: 24, range: 9, speed: 0.8, ranged: true, shot: { kind: 'magic_bolt', speed: 9, homing: 2.5 }, minRarity: 2, icon: 'armory/crystal_orb' },
  bone_wand: { name: 'Bone Wand', dmg: 12, range: 7, speed: 0.45, ranged: true, shot: { kind: 'bone_arrow', speed: 16 }, icon: 'armory/bone_wand' },
  druid_staff: { name: 'Druid Staff', dmg: 16, range: 8, speed: 0.7, ranged: true, shot: { kind: 'poison_spit', speed: 11, poison: { dps: 4, secs: 4 } }, minRarity: 1, icon: 'armory/druid_staff' },
  // ---- ADMIN ONLY: never dropped or crafted, only given with the admin gear command
  minigun: { name: 'Minigun', dmg: 45, range: 12, speed: 0.05, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'bullet', speed: 30, spread: 0.08 }, icon: 'armory/minigun' },
  laser_rifle: { name: 'Laser Rifle', dmg: 160, range: 16, speed: 0.25, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'laser', speed: 60, pierce: 99, color: '#5ad8ff' }, icon: 'armory/laser_rifle' },
  plasma_cannon: { name: 'Plasma Cannon', dmg: 260, range: 12, speed: 0.6, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'plasma', speed: 14, explode: 2.5 }, icon: 'armory/plasma_cannon' },
  rocket_launcher: { name: 'Rocket Launcher', dmg: 500, range: 14, speed: 0.8, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'rocket', speed: 16, explode: 3.5, explodeAtEnd: true }, icon: 'armory/rocket_launcher' },
  railgun: { name: 'Railgun', dmg: 999, range: 20, speed: 0.7, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'laser', speed: 80, pierce: 99, color: '#e0f0ff' }, icon: 'armory/railgun' },
  flamethrower: { name: 'Flamethrower', dmg: 30, range: 5, speed: 0.04, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'fireball', speed: 12, count: 2, spread: 0.35, pierce: 3, burn: { dps: 20, secs: 3 } }, icon: 'armory/flamethrower' },
  freeze_ray: { name: 'Freeze Ray', dmg: 80, range: 10, speed: 0.1, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'ice_shard', speed: 24, pierce: 5, freeze: 3 }, icon: 'armory/freeze_ray' },
  black_hole_gun: { name: 'Black Hole Gun', dmg: 120, range: 10, speed: 0.9, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'dark_orb', speed: 8, explode: 4, pull: true, explodeAtEnd: true }, icon: 'armory/black_hole_gun' },
  banana_blaster: { name: 'Banana Blaster', dmg: 90, range: 9, speed: 0.12, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'banana', speed: 15, count: 2, spread: 0.2, kb: 4 }, icon: 'armory/banana_blaster' },
  ban_hammer: { name: 'BAN HAMMER', dmg: 9999, range: 3, speed: 0.5, arc: 6.3, stun: 3, admin: true, noLoot: true, minRarity: 3, icon: 'armory/ban_hammer', length: 1.5, iconRot: Math.PI / 2 },
  god_sword: { name: 'God Sword', dmg: 999, range: 3, speed: 0.25, arc: 6.3, crit: 0.5, admin: true, noLoot: true, minRarity: 3, icon: 'armory/god_sword', length: 1.5 },
  infinity_blade: { name: 'Infinity Blade', dmg: 700, range: 2.2, speed: 0.2, arc: 3, admin: true, noLoot: true, minRarity: 3, icon: 'armory/infinity_blade', length: 1.3 },
  energy_sword: { name: 'Energy Sword', dmg: 400, range: 1.8, speed: 0.15, arc: 2.4, admin: true, noLoot: true, minRarity: 3, icon: 'armory/energy_sword', length: 1.2 },
  cosmic_scythe: { name: 'Cosmic Scythe', dmg: 800, range: 3, speed: 0.35, arc: 6.3, admin: true, noLoot: true, minRarity: 3, icon: 'armory/cosmic_scythe', length: 1.5 },
  storm_god_hammer: { name: 'Storm God Hammer', dmg: 900, range: 2, speed: 0.45, arc: 3, stun: 2, admin: true, noLoot: true, minRarity: 3, icon: 'armory/storm_god_hammer', length: 1.2 },
  chaos_staff: { name: 'Chaos Staff', dmg: 300, range: 12, speed: 0.15, ranged: true, admin: true, noLoot: true, minRarity: 3, shot: { kind: 'chaos', speed: 14 }, icon: 'armory/chaos_staff' },
  dev_wrench: { name: 'Dev Wrench', dmg: 5000, range: 2, speed: 0.3, arc: 3, stun: 3, admin: true, noLoot: true, minRarity: 3, icon: 'armory/dev_wrench', length: 1.1 },
  golden_frying_pan: { name: 'Golden Frying Pan', dmg: 350, range: 1.5, speed: 0.3, arc: 2.5, stun: 2, kb: 3, admin: true, noLoot: true, minRarity: 3, icon: 'armory/golden_frying_pan', length: 1.0, iconRot: Math.PI },   // the picture has its handle top-right
  rubber_chicken: { name: 'Rubber Chicken', dmg: 1, range: 1.6, speed: 0.15, arc: 3, kb: 12, admin: true, noLoot: true, minRarity: 3, icon: 'armory/rubber_chicken', length: 1.0 },
  void_dagger: { name: 'Void Dagger', dmg: 900, range: 1.4, speed: 0.12, arc: 2, admin: true, noLoot: true, minRarity: 3, icon: 'armory/void_dagger', length: 0.8 },
};

/** Special abilities of some blades (shown in Analyze, used on every hit). */
export const BLADE_SPECIALS = {
  flame_sword:   { name: 'Burning Blade', desc: 'Sets foes on fire: 5 damage a second for 3 seconds', burn: { dps: 5, secs: 3 } },
  frost_sword:   { name: 'Frostbite', desc: 'Chills foes to half speed; 1 in 5 hits freezes them solid', chill: { k: 0.5, secs: 2.5, freeze: 0.2 } },
  thunder_sword: { name: 'Chain Lightning', desc: 'Lightning leaps to 2 more foes nearby for half damage', chain: { count: 2, range: 3.5, share: 0.5 } },
  shadow_blade:  { name: 'Life Drain', desc: 'Heals you for 12% of the damage you deal', lifesteal: 0.12 },
  holy_sword:    { name: 'Smite the Dead', desc: 'Double damage to skeletons, ghosts, zombies and the Lich; every hit heals you a little', undead: 2, heal: 3 },
  katana:        { name: 'Bleed', desc: 'A third of hits make foes bleed: 3 damage a second for 4 seconds', bleed: { chance: 0.35, dps: 3, secs: 4 } },
  rapier:        { name: 'Riposte', desc: 'After a perfect parry your next hit deals triple damage', riposte: 3 },
  greatsword:    { name: 'Shockwave', desc: 'The combo finisher sends out a shockwave that hits everything around you', shockwave: { radius: 2.4, share: 0.6 } },
  scythe:        { name: 'Reap', desc: 'Each foe you slay heals you for 8% of your health', reap: 0.08 },
  twin_daggers:  { name: 'Twin Strike', desc: 'Every hit strikes twice (the second for half)', twin: 0.5 },
  scimitar:      { name: 'Whirlwind', desc: 'The combo finisher spins all the way round you', whirl: true },
  cutlass:       { name: 'Plunder', desc: 'Foes you slay drop extra gold', plunder: [3, 9] },
  runic_blade:   { name: 'Rune Frost', desc: 'Runes chill every foe you hit', chill: { k: 0.6, secs: 2, freeze: 0.1 } },
  // admin weapons
  ban_hammer:       { name: 'BANNED', desc: 'Every swing is a shockwave that flattens everything around you', shockwave: { radius: 4, share: 1, always: true } },
  god_sword:        { name: 'Divine Wrath', desc: 'Lightning leaps to 8 foes', chain: { count: 8, range: 8, share: 1 } },
  infinity_blade:   { name: 'Infinite Edge', desc: 'Every hit strikes twice and chains to 5 foes', twin: 1, chain: { count: 5, range: 6, share: 0.6 } },
  energy_sword:     { name: 'Plasma Edge', desc: 'Sets everything on fire', burn: { dps: 60, secs: 3 } },
  cosmic_scythe:    { name: 'Harvest of Stars', desc: 'Each kill heals 30% of your health', reap: 0.3 },
  storm_god_hammer: { name: 'Thunderclap', desc: 'Lightning leaps to 6 foes for full damage, and a shockwave on every swing', chain: { count: 6, range: 6, share: 1 }, shockwave: { radius: 2.5, share: 0.5, always: true } },
  void_dagger:      { name: 'Void Hunger', desc: 'Heals you for 30% of the damage you deal', lifesteal: 0.3 },
  golden_frying_pan:{ name: 'BONK', desc: 'Sends foes flying and dazes them' },
  rubber_chicken:   { name: 'Squeak', desc: 'Does almost no damage but launches foes across the map' },
};
export const UNDEAD = new Set(['skeleton', 'skeleton_archer', 'ghost', 'zombie', 'lich']);

// shields: block = share of a blow stopped while guarding; parry = seconds a well-timed guard parries; slow = move speed while guarding
export const SHIELDS = {
  buckler: { name: 'Buckler', block: 0.6, parry: 0.35, slow: 0.7, icon: 'gear/buckler', fallbackIcon: 'gear/round_shield', size: 0.7 },
  round: { name: 'Round Shield', block: 0.75, parry: 0.25, slow: 0.5, icon: 'gear/round_shield', size: 0.85 },
  heater: { name: 'Heater Shield', block: 0.8, parry: 0.24, slow: 0.48, armor: 0.03, icon: 'gear/heater_shield', fallbackIcon: 'gear/kite_shield', size: 0.9 },
  kite: { name: 'Kite Shield', block: 0.85, parry: 0.22, slow: 0.42, armor: 0.05, icon: 'gear/kite_shield', size: 0.95 },
  tower: { name: 'Tower Shield', block: 0.95, parry: 0.18, slow: 0.3, armor: 0.1, icon: 'gear/tower_shield', fallbackIcon: 'gear/kite_shield', size: 1.15 },
  spiked: { name: 'Spiked Shield', block: 0.7, parry: 0.3, slow: 0.55, thorns: 8, icon: 'gear/spiked_shield', fallbackIcon: 'gear/round_shield', size: 0.85 },
  bone: { name: 'Bone Shield', block: 0.72, parry: 0.28, slow: 0.52, thorns: 4, icon: 'gear/bone_shield', fallbackIcon: 'gear/round_shield', size: 0.85 },
  crystal: { name: 'Crystal Shield', block: 0.88, parry: 0.3, slow: 0.5, minRarity: 2, icon: 'gear/crystal_shield', fallbackIcon: 'gear/kite_shield', size: 0.9 },
  holy: { name: 'Holy Shield', block: 0.92, parry: 0.32, slow: 0.45, armor: 0.08, minRarity: 3, icon: 'gear/holy_shield', fallbackIcon: 'gear/kite_shield', size: 0.95 },
  dragon: { name: 'Dragon Shield', block: 0.9, parry: 0.25, slow: 0.4, armor: 0.1, thorns: 12, minRarity: 3, icon: 'gear/dragon_shield', fallbackIcon: 'gear/kite_shield', size: 1.05 },
};

// body armour
export const ARMORS = {
  padded: { name: 'Padded Armour', armor: 0.07, icon: 'gear/padded_armor', fallbackIcon: 'gear/leather_armor' },
  leather: { name: 'Leather Armour', armor: 0.12, icon: 'gear/leather_armor' },
  studded: { name: 'Studded Leather', armor: 0.17, icon: 'gear/studded_leather', fallbackIcon: 'gear/leather_armor' },
  chain: { name: 'Chain Mail', armor: 0.25, icon: 'gear/chain_mail' },
  scale: { name: 'Scale Mail', armor: 0.31, icon: 'gear/scale_mail', fallbackIcon: 'gear/chain_mail' },
  plate: { name: 'Plate Armour', armor: 0.38, icon: 'gear/plate_armor' },
  dragon_armor: { name: 'Dragon Armour', armor: 0.46, minRarity: 3, icon: 'gear/dragon_armor', fallbackIcon: 'gear/plate_armor' },
};

// helmets
export const HELMETS = {
  leather_cap: { name: 'Leather Cap', armor: 0.04, icon: 'gear/leather_cap', fallbackIcon: 'gear/leather_armor' },
  iron_helmet: { name: 'Iron Helmet', armor: 0.08, icon: 'gear/iron_helmet', fallbackIcon: 'gear/chain_mail' },
  horned_helmet: { name: 'Horned Helmet', armor: 0.1, bonus: { dmg: 0.05 }, icon: 'gear/horned_helmet', fallbackIcon: 'gear/chain_mail' },
  knight_helmet: { name: 'Knight Helmet', armor: 0.13, icon: 'gear/knight_helmet', fallbackIcon: 'gear/plate_armor' },
  wizard_hat: { name: 'Wizard Hat', armor: 0.02, bonus: { dmg: 0.1 }, icon: 'gear/wizard_hat', fallbackIcon: 'gear/magic_scroll' },
  crown: { name: 'Royal Crown', armor: 0.05, bonus: { hp: 25 }, minRarity: 3, icon: 'gear/royal_crown', fallbackIcon: 'items/crown_leader' },
};

// trinkets and small armour pieces
export const TRINKETS = {
  ring: { name: 'Ring of Might', bonus: { dmg: 0.12 }, icon: 'gear/ring' },
  boots: { name: 'Swift Boots', bonus: { speed: 0.12 }, icon: 'gear/boots' },
  amulet: { name: 'Amulet of Vigor', bonus: { hp: 30 }, icon: 'gear/amulet' },
  iron_boots: { name: 'Iron Boots', bonus: { hp: 15, speed: -0.04 }, icon: 'gear/iron_boots', fallbackIcon: 'gear/boots' },
  gauntlets: { name: 'Iron Gauntlets', bonus: { dmg: 0.08, hp: 10 }, icon: 'gear/iron_gauntlets', fallbackIcon: 'gear/ring' },
  lucky_charm: { name: 'Lucky Charm', bonus: { dmg: 0.05, speed: 0.05, hp: 10 }, icon: 'gear/lucky_charm', fallbackIcon: 'gear/amulet' },
  royal_cape: { name: 'Royal Cape', bonus: { hp: 20, speed: 0.05 }, icon: 'gear/royal_cape', fallbackIcon: 'gear/amulet' },
};

/** Every kind of gear by its slot, for loot, the admin command and the Character sheet. */
export const CATALOG = { weapon: WEAPONS, shield: SHIELDS, armor: ARMORS, helmet: HELMETS, trinket: TRINKETS };
export const slotOf = base => Object.keys(CATALOG).find(slot => CATALOG[slot][base]) || null;
const START = { level: 1, xp: 0, points: 0, might: 0, vigor: 0, agility: 0, gear: { weapon: null, shield: null, helmet: null, armor: null, trinket: null }, bag: [], quests: [], questsDone: 0 };

export function rpgOf(g) {
  const s = g.state;
  if (!s.rpg) s.rpg = JSON.parse(JSON.stringify(START));
  for (const slot of ['shield', 'helmet']) if (!(slot in s.rpg.gear)) s.rpg.gear[slot] = null;   // slots that came later
  return s.rpg;
}

/** Swords and bows show their rarity: plain, glowing blue, runed purple, golden flame. */
export function weaponIcon(base, rarity) {
  if (base === 'sword') return `gear/sword_${['common', 'rare', 'epic', 'legendary'][Math.min(3, rarity)] || 'common'}`;
  if (base === 'bow') return rarity ? 'gear/bow_rare' : 'gear/bow_common';
  return WEAPONS[base]?.icon || null;
}

/** Shields show their rarity too (the plain round and kite shields keep their first art). */
export function shieldIcon(base, rarity) {
  return SHIELDS[base]?.icon || null;   // one picture per shield; rarity shows as the glow around it
}

export const xpToNext = level => Math.round(60 * Math.pow(level, 1.5));

/** Everything derived from level, points and gear. */
export function heroStats(g) {
  const r = rpgOf(g);
  const bonus = { dmg: 0, hp: 0, speed: 0 };
  for (const it of Object.values(r.gear)) for (const [k, n] of Object.entries(it?.bonus || {})) bonus[k] = (bonus[k] || 0) + n;
  const armor = (r.gear.armor?.armor || 0) + (r.gear.helmet?.armor || 0) + (r.gear.shield?.armor || 0);
  return {
    maxHp: Math.round(100 + (r.level - 1) * 10 + r.vigor * 12 + bonus.hp),
    maxStamina: Math.round(100 + r.agility * 8 + (r.level - 1) * 3),
    dmgMult: 1 + r.might * 0.08 + (r.level - 1) * 0.04 + bonus.dmg,
    speed: 1 + r.agility * 0.03 + bonus.speed,
    crit: 0.05 + r.agility * 0.012 + (r.gear.weapon ? WEAPONS[r.gear.weapon.base]?.crit || 0 : 0),
    armor: Math.min(0.7, armor),
  };
}

/** The weapon in your hand: your equipped gear, or whatever your villager carries. */
export function heroWeapon(g, v) {
  const w = rpgOf(g).gear.weapon;
  if (w) return { ...WEAPONS[w.base], ...w, dmg: w.dmg };
  const pack = v?.inv?.pack || {};
  const key = pack.sword ? 'sword' : pack.spear ? 'spear' : v?.armed ? 'spear' : pack.axe ? 'axe' : pack.hammer ? 'hammer' : pack.pickaxe ? 'pickaxe' : pack.bow ? 'bow' : 'fists';
  return { ...WEAPONS[key], base: key, rarity: 0 };
}

// ------------------------------------------------------------------ experience

export function gainXp(g, n, v = null) {
  const r = rpgOf(g);
  n = Math.max(1, Math.round(n));
  r.xp += n;
  if (v) g.float(v.x + 10, v.y - TILE * 1.5, `+${n} XP`, '#9fd4ff');
  let levels = 0;
  while (r.xp >= xpToNext(r.level)) {
    r.xp -= xpToNext(r.level);
    r.level++;
    r.points += 3;
    levels++;
  }
  if (levels) {
    const st = heroStats(g);
    if (v) { v.hp = st.maxHp; g.puff({ x: v.x, y: v.y - 10 }, 'effects/spark', 24, 30); }
    g.announce(`Level ${r.level}! +${3 * levels} points to spend`);
    g.log(`You reached level ${r.level}. Open your Character sheet to spend your points.`, 'good');
    g.emit('levelUp', r.level);
  }
  g.emit('change');
  return levels;
}

export function spendPoint(g, stat) {
  const r = rpgOf(g);
  if (r.points <= 0 || !['might', 'vigor', 'agility'].includes(stat)) return false;
  r.points--;
  r[stat]++;
  g.emit('change');
  return true;
}

// ------------------------------------------------------------------ loot

const pickRarity = (g, boss) => {
  const lvl = rpgOf(g).level;
  const roll = Math.random() * 100 - Math.min(20, lvl) - g.state.era * 2 - (boss ? 45 : 0);
  if (boss && Math.random() < 0.04) return MYTHIC;
  return roll < 2 ? 3 : roll < 12 ? 2 : roll < 38 ? 1 : 0;
};

/** A piece of gear of a given kind (e.g. 'katana', 'tower', 'plate') and rarity (0 Common .. 4 Mythic; admin weapons are always 5 Admin). */
export function makeGear(g, base, rarity = 0) {
  const slot = slotOf(base);
  if (!slot) return null;
  const def = CATALOG[slot][base];
  rarity = def.admin ? ADMIN : Math.max(def.minRarity || 0, Math.min(MYTHIC, Math.round(rarity)));
  const R = RARITY[rarity];
  const it = { id: `gear${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`, slot, base, rarity, name: `${R.name === 'Common' || R.name === 'Admin' || def.minRarity >= rarity ? '' : R.name + ' '}${def.name}` };
  const era = 1 + (g?.state?.era || 0) * 0.08;
  if (slot === 'weapon') { it.dmg = Math.round(def.dmg * R.mult * era); it.icon = weaponIcon(base, rarity); }
  else if (slot === 'shield') { it.block = Math.min(0.98, Math.round((def.block + rarity * 0.03) * 100) / 100); it.armor = def.armor || 0; it.icon = def.icon; }
  else if (slot === 'armor' || slot === 'helmet') { it.armor = Math.round(def.armor * R.mult * 100) / 100; it.icon = def.icon; }
  if (def.bonus) it.bonus = Object.fromEntries(Object.entries(def.bonus).map(([k, n]) => [k, Math.round(n * R.mult * 100) / 100]));
  if (!it.icon) it.icon = def.icon;
  return it;
}

/** A random piece of loot, stronger with rarity (rare kinds only drop at their rarity or above). */
export function rollGear(g, { boss = false, slot = null, weapons = boss } = {}) {
  const rarity = pickRarity(g, boss);
  const roll = Math.random();
  // weapons are crafted: only bosses drop them; everything else drops shields, armour, helmets and trinkets
  const kind = slot || (weapons && roll < 0.42 ? 'weapon' : roll < 0.62 ? 'shield' : roll < 0.8 ? 'armor' : roll < 0.9 ? 'helmet' : 'trinket');
  const options = Object.entries(CATALOG[kind]).filter(([, d]) => !d.noLoot && !d.admin && d.icon !== null && (d.minRarity || 0) <= rarity);
  // each world has favourite weapons: a third of weapon drops come from them
  const fav = kind === 'weapon' && g?.state ? gameTheme(g).loot.filter(b => CATALOG.weapon[b] && !CATALOG.weapon[b].admin) : [];
  if (fav.length && Math.random() < 0.35) { const b = fav[Math.floor(Math.random() * fav.length)]; return makeGear(g, b, Math.max(rarity, CATALOG.weapon[b].minRarity || 0)); }
  const [base] = options[Math.floor(Math.random() * options.length)];
  return makeGear(g, base, rarity);
}
/** How good a piece of gear is, to compare with what you wear. */
export const gearScore = it => (it ? (it.dmg || 0) + (it.block || 0) * 40 + (it.armor || 0) * 60 + Object.values(it.bonus || {}).reduce((n, b) => n + b * (b < 1 ? 80 : 0.5), 0) + it.rarity * 3 : 0);

/** Picked up: better than what you wear goes straight on, anything else into your bag. */
export function takeGear(g, it, v = null) {
  const r = rpgOf(g);
  const worn = r.gear[it.slot];
  if (gearScore(it) > gearScore(worn)) {
    if (worn) r.bag.push(worn);
    r.gear[it.slot] = it;
    if (v) g.float(v.x, v.y - TILE * 1.4, `Equipped ${it.name}`, RARITY[it.rarity].color);
  } else {
    r.bag.push(it);
    if (r.bag.length > 24) r.bag.shift();
    if (v) g.float(v.x, v.y - TILE * 1.4, `+ ${it.name}`, RARITY[it.rarity].color);
  }
  g.emit('change');
}

/** Put on the best piece you own for every slot. Returns how many pieces changed. */
export function equipBest(g) {
  const r = rpgOf(g);
  let changed = 0;
  for (const slot of Object.keys(r.gear)) {
    const best = r.bag.filter(it => it.slot === slot).reduce((a, b) => (gearScore(b) > gearScore(a) ? b : a), null);
    if (best && gearScore(best) > gearScore(r.gear[slot])) { equip(g, best.id); changed++; }
  }
  return changed;
}

export function equip(g, id) {
  const r = rpgOf(g);
  const i = r.bag.findIndex(x => x.id === id);
  if (i < 0) return false;
  const [it] = r.bag.splice(i, 1);
  if (r.gear[it.slot]) r.bag.push(r.gear[it.slot]);
  r.gear[it.slot] = it;
  g.emit('change');
  return true;
}

export function unequip(g, slot) {
  const r = rpgOf(g);
  if (!r.gear[slot]) return false;
  r.bag.push(r.gear[slot]);
  r.gear[slot] = null;
  g.emit('change');
  return true;
}

export function scrapGear(g, id) {
  const r = rpgOf(g);
  const i = r.bag.findIndex(x => x.id === id);
  if (i < 0) return 0;
  const [it] = r.bag.splice(i, 1);
  const gold = 8 * (1 + it.rarity * it.rarity * 2);
  g.addResource('gold', gold);
  g.emit('change');
  return gold;
}

// ------------------------------------------------------------------ quests

const QUEST_KILLS = [['wolf', 'wolves'], ['boar', 'boars'], ['bandit', 'bandits'], ['goblin', 'goblins'], ['skeleton', 'skeletons'], ['giant_spider', 'giant spiders'], ['slime', 'slimes']];

function newQuest(g) {
  const r = rpgOf(g);
  const lvl = r.level;
  const roll = Math.random();
  const id = `q${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  if (roll < 0.5) {
    const n = 3 + Math.floor(Math.random() * 3) + Math.floor(lvl / 3);
    return { id, kind: 'slay', need: n, have: 0, text: `Slay ${n} beasts or raiders`, xp: 40 + lvl * 15, gold: 20 + lvl * 8 };
  }
  if (roll < 0.7) {
    const [type, plural] = QUEST_KILLS[Math.floor(Math.random() * QUEST_KILLS.length)];
    const n = 2 + Math.floor(Math.random() * 2);
    return { id, kind: 'slayType', type, need: n, have: 0, text: `Hunt down ${n} ${plural}`, xp: 60 + lvl * 18, gold: 30 + lvl * 10, spawn: true };
  }
  if (roll < 0.85) return { id, kind: 'bounty', need: 1, have: 0, text: 'Claim a bounty', xp: 120 + lvl * 25, gold: 40 + lvl * 12 };
  const n = 4 + Math.floor(Math.random() * 4);
  return { id, kind: 'gather', need: n, have: 0, text: `Chop or mine ${n} times`, xp: 30 + lvl * 10, gold: 15 + lvl * 5 };
}

/** Keep three quests on the board; quests that ask for a certain beast make sure some are out there. */
export function updateQuests(g) {
  const r = rpgOf(g);
  for (let tries = 0; r.quests.length < 3 && tries < 12; tries++) {
    const q = newQuest(g);
    if (r.quests.some(x => x.kind === q.kind && x.type === q.type)) continue;   // no two of the same
    r.quests.push(q);
    if (q.spawn && CREATURES[q.type]) {
      for (let i = 0; i < q.need; i++) {
        const p = g.randomLandTile(8, 18);
        if (p) g.spawnCreature(q.type, p.x, p.y, { questId: q.id });
      }
    }
  }
}

export function questProgress(g, kind, detail = {}) {
  const r = rpgOf(g);
  let finished = false;
  for (const q of r.quests) {
    if (q.have >= q.need) continue;
    // any kill counts for "slay beasts"; a hunt needs that very beast
    const hit = (q.kind === kind && (q.kind !== 'slayType' || detail.type === q.type)) || (q.kind === 'slay' && kind === 'slayType');
    if (!hit) continue;
    q.have++;
    if (q.have >= q.need) finished = true;
  }
  if (finished) completeQuests(g, detail.v);
}

function completeQuests(g, v) {
  const r = rpgOf(g);
  for (const q of r.quests.filter(x => x.have >= x.need)) {
    r.questsDone++;
    g.addResource('gold', q.gold);
    g.log(`Quest complete: ${q.text}. +${q.xp} XP, +${q.gold} gold`, 'good');
    g.announce(`Quest complete: ${q.text}`);
    gainXp(g, q.xp, v);
    if (Math.random() < 0.5) takeGear(g, rollGear(g), v);
  }
  r.quests = r.quests.filter(x => x.have < x.need);
  updateQuests(g);
}

// ------------------------------------------------------------------ kills

/** You killed something: experience, maybe loot on the ground, and quest progress. */
export function onHeroKill(g, c, v) {
  const def = CREATURES[c.t];
  if (!def) return;
  const boss = !!def.boss || !!c.bounty;
  gainXp(g, (def.hp * (c.scale || 1)) / 3 * (boss ? 2 : 1) * (c.elite ? 2.5 : 1) + (def.hostile ? 5 : 1), v);
  if (def.hostile) {
    // Zelda-style drops: hearts when you are hurt, now and then a potion
    if (v && v.hp < (g.hero?.maxHp || 100) && Math.random() < 0.3) dropPickup(g, 'heart', c.x - 8, c.y);
    if (Math.random() < (c.elite || boss ? 0.45 : 0.07)) dropPickup(g, 'potion', c.x + 8, c.y);
    if (boss) chestsOf(g).push({ id: `boss${Date.now().toString(36)}`, x: c.x, y: c.y + 10, boss: true });
  }
  if (def.hostile) {
    // monsters carry bits of the land they live in: the local ores, and now and then a lucky pile
    const ores = gameTheme(g).ores || [];
    if (ores.length && lucky(g, boss ? 1 : c.elite ? 0.8 : 0.35)) {
      const res = ORE_RESOURCE[ores[Math.floor(Math.random() * ores.length)]];
      const big = lucky(g, 0.03);
      const n = (1 + Math.floor(Math.random() * 3)) * (boss ? 5 : c.elite ? 2 : 1) * (big ? 3 : 1);
      if (res) for (let i = 0; i < Math.min(n, 5); i++) popResource(g, res, i === Math.min(n, 5) - 1 ? n - Math.min(n, 5) + 1 : 1, c.x, c.y);
      if (big) g.float(c.x, c.y - TILE * 1.6, 'LUCKY DROP! x3', '#ffd76a');
    }
    if (lucky(g, boss ? 0.6 : 0.02)) popResource(g, 'gold', 5 + Math.floor(Math.random() * (boss ? 60 : 10)), c.x, c.y);
    questProgress(g, 'slayType', { type: c.t, v });
  }
  if (c.bounty) questProgress(g, 'bounty', { v });
  const chance = boss || c.elite ? 1 : def.hostile ? 0.2 : 0.03;
  if (Math.random() < chance) {
    const it = rollGear(g, { boss: boss || !!c.elite, weapons: !!def.boss });
    (g.state.groundItems ||= []).push({ id: it.id, gear: it, item: null, count: 1, x: c.x + (Math.random() - 0.5) * 10, y: c.y + (Math.random() - 0.5) * 10 });
    g.float(c.x, c.y - TILE * 1.2, `${RARITY[it.rarity].name} loot!`, RARITY[it.rarity].color);
  }
}
