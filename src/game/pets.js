/*
 * Pets: eggs drop from bosses (and now and then from bonus chests) and hatch into a companion of a rolled rarity.
 * The pet you choose follows you, picks up loot for you, and depending on its kind fights beside you or heals you.
 */
import { TILE } from '../core/constants.js';
import { rpgOf, onHeroKill, RARITY, discover } from './rpg.js';
import { CREATURES } from '../data/objects.js';
import { damageCreature } from './creatures.js';
import { pickUp } from './groundItems.js';

/** Every pet: which picture it uses, its rarity and what it does. */
export const PETS = {
  chicken:       { name: 'Chicken',       sprite: 'pets/chicken',       rarity: 0, size: 0.45, role: 'collector', desc: 'Picks up loot around you' },
  rabbit:        { name: 'Rabbit',        sprite: 'pets/rabbit',        rarity: 0, size: 0.45, role: 'collector', desc: 'Picks up loot around you, a little further' },
  pig:           { name: 'Pig',           sprite: 'pets/pig',           rarity: 1, size: 0.55, role: 'collector', desc: 'Picks up loot from far away' },
  slime:         { name: 'Slime',         sprite: 'pets/slime',         rarity: 1, size: 0.5,  role: 'fighter', dmg: 6, desc: 'Bounces at monsters near you' },
  bat:           { name: 'Bat',           sprite: 'pets/bat',           rarity: 1, size: 0.45, role: 'fighter', dmg: 5, fly: true, desc: 'Swoops at monsters near you' },
  wolf:          { name: 'Wolf',          sprite: 'pets/wolf',          rarity: 2, size: 0.6,  role: 'fighter', dmg: 14, desc: 'Fights beside you' },
  forest_spirit: { name: 'Forest Spirit', sprite: 'pets/forest_spirit', rarity: 3, size: 0.6,  role: 'healer', heal: 4, fly: true, desc: 'Heals you over time and picks up loot' },
  dragon:        { name: 'Baby Dragon',   sprite: 'pets/dragon',        rarity: 4, size: 0.7,  role: 'fighter', dmg: 30, fly: true, fire: true, desc: 'Breathes fire at monsters and picks up loot' },
};

/** Your pets and eggs. */
export function petsOf(g) {
  const r = rpgOf(g);
  r.pets ||= [];
  r.eggs ||= 0;
  return r;
}
export const activePet = g => { const r = petsOf(g); return r.pets.find(p => p.id === r.pet) || null; };

/** Give an egg (from a boss or chest). */
export function giveEgg(g, n = 1) { petsOf(g).eggs += n; g.emit?.('petEgg', n); g.emit?.('change'); }

/** Hatch an egg: the rarity is rolled (luck helps a little). Returns the new pet. */
export function hatch(g) {
  const r = petsOf(g);
  if (r.eggs < 1) return null;
  r.eggs--;
  const x = Math.random();
  const rarity = x < 0.45 ? 0 : x < 0.75 ? 1 : x < 0.91 ? 2 : x < 0.985 ? 3 : 4;
  const options = Object.entries(PETS).filter(([, p]) => p.rarity === rarity);
  const [kind] = options[Math.floor(Math.random() * options.length)];
  const pet = { id: `pet${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, kind, name: PETS[kind].name };
  r.pets.push(pet);
  if (!r.pet) r.pet = pet.id;
  discover(g, 'pet', kind);
  g.emit('change');
  return pet;
}

export function choosePet(g, id) { const r = petsOf(g); r.pet = r.pet === id ? null : id; g.emit('change'); }
export function releasePet(g, id) { const r = petsOf(g); r.pets = r.pets.filter(p => p.id !== id); if (r.pet === id) r.pet = null; g.emit('change'); }

/** Moves the pet each frame: it follows you, fetches loot and fights or heals. The body lives on the game (not saved). */
export function updatePet(g, v, dt) {
  const pet = activePet(g);
  if (!pet || !v) { g.petBody = null; return; }
  const def = PETS[pet.kind];
  const b = (g.petBody ||= { x: v.x - 20, y: v.y + 8, cd: 0, heal: 0, flip: false, kind: pet.kind });
  if (b.kind !== pet.kind) Object.assign(b, { kind: pet.kind, x: v.x - 20, y: v.y + 8 });
  b.cd -= dt; b.heal -= dt;
  let tx = v.x - 22 * (v._flip ? -1 : 1), ty = v.y + 6, speed = 2.5;
  // loot first: every pet fetches, collectors from further away
  const reach = TILE * (def.role === 'collector' ? (def.rarity >= 1 ? 7 : 5) : 3.5);
  const loot = (g.state.groundItems || []).find(it => !(it.pickIn > 0) && !(it.noPickUntil && g.state.time < it.noPickUntil) && Math.hypot(it.x - v.x, it.y - v.y) < reach);
  if (loot) {
    tx = loot.x; ty = loot.y; speed = 5;
    if (Math.hypot(loot.x - b.x, loot.y - b.y) < TILE * 0.6) pickUp(g, v, loot);
  } else if (def.role === 'fighter') {
    const foe = g.state.creatures.filter(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - v.x, c.y - v.y) < TILE * 5).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
    if (foe) {
      tx = foe.x - 10; ty = foe.y; speed = 4;
      if (b.cd <= 0 && Math.hypot(foe.x - b.x, foe.y - b.y) < TILE * (def.fire ? 3 : 1.2)) {
        b.cd = def.fire ? 1.4 : 1.1;
        damageCreature(g, foe, def.dmg * (1 + (rpgOf(g).level || 1) * 0.04), v);
        g.puff?.({ x: foe.x, y: foe.y - 10 }, def.fire ? 'effects/flame' : 'effects/hit_star', def.fire ? 6 : 3, 10);
        if (!g.state.creatures.includes(foe)) onHeroKill(g, foe, v);   // a pet's kill counts as yours
      }
    }
  }
  if (def.role === 'healer' && b.heal <= 0) {
    b.heal = 3;
    const max = g.hero?.maxHp || 100;
    if (v.hp < max) { v.hp = Math.min(max, v.hp + def.heal); g.float?.(v.x, v.y - TILE * 1.3, `+${def.heal}`, '#7aff9a'); }
  }
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
  if (d > TILE * 12) { b.x = v.x - 20; b.y = v.y + 8; }   // left far behind: catch up at once
  else if (d > 4) { const k = Math.min(1, dt * speed); b.x += dx * k; b.y += dy * k; b.flip = dx < 0; }
  b.moving = d > 6;
}

