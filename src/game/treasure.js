import { TILE } from '../core/constants.js';
import { rpgOf, rollGear, gainXp, RARITY } from './rpg.js';

/*
 * Things to find and grab while you roam:
 * - Treasure chests turn up around your land (a big boss chest where a boss or bounty falls).
 *   Walk up and strike one to open it: gold, sometimes gems, and a piece of gear.
 * - Hearts drop from beasts you slay and heal you when you walk over them.
 * - Health potions drop too; press E (or the potion button) to drink one.
 */

const MAX_CHESTS = 3;
export const POTION_HEAL = 0.45;   // share of your health a potion restores

export const chestsOf = g => (g.state.chests ||= []);
export const pickupsOf = g => (g.pickups ||= []);   // hearts and potions on the ground (short-lived, not saved)

/** Now and then a chest turns up somewhere around the village. */
export function updateTreasure(g, dt, hero) {
  const s = g.state;
  if (g.offline || g.visiting) return;
  s.nextChestAt ??= s.time + 40;
  if (s.time >= s.nextChestAt) {
    s.nextChestAt = s.time + 80 + Math.random() * 80;
    if (chestsOf(g).filter(c => !c.boss).length < MAX_CHESTS) {
      const p = g.randomLandTile(8, 22);
      if (p) {
        chestsOf(g).push({ id: `ch${Math.floor(s.time * 1000).toString(36)}`, x: p.x, y: p.y, tier: Math.random() < 0.15 ? 1 : 0 });
        g.log('A treasure chest has been spotted in the wilds!', 'event', p);
      }
    }
  }
  // pickups fade after a while
  const list = pickupsOf(g);
  for (const p of list) p.life -= dt;
  if (list.length) g.pickups = list.filter(p => p.life > 0);
  // walking over a pickup takes it
  if (hero) {
    for (const p of [...pickupsOf(g)]) {
      if (Math.hypot(p.x - hero.x, p.y - hero.y) > TILE * 0.75) continue;
      g.pickups = pickupsOf(g).filter(x => x !== p);
      if (p.kind === 'heart') {
        const max = g.hero?.maxHp || 100;
        const heal = Math.min(max - hero.hp, 20);
        hero.hp = Math.min(max, hero.hp + 20);
        g.float(hero.x, hero.y - TILE * 1.3, heal > 0 ? `+${Math.round(heal)} health` : 'Full health', '#ff6b6b');
      } else if (p.kind === 'potion') {
        rpgOf(g).potions = (rpgOf(g).potions || 0) + 1;
        g.float(hero.x, hero.y - TILE * 1.3, '+1 health potion', '#ff9f9f');
      }
      g.anim('combat/hit', p.x, p.y - 6, { size: 16, dur: 0.2 });
    }
  }
}

/** A chest within reach of a swing, if any. */
export function chestNear(g, x, y, reach = TILE * 1.4) {
  return chestsOf(g).find(c => Math.hypot(c.x - x, c.y - y) < reach) || null;
}

export function openChest(g, chest, hero) {
  const s = g.state;
  s.chests = chestsOf(g).filter(c => c !== chest);
  const big = chest.boss || chest.tier > 0;
  const gold = Math.round((20 + s.era * 25 + Math.random() * 30) * (chest.boss ? 4 : big ? 2 : 1));
  g.addResource('gold', gold);
  const gems = big ? 1 + Math.floor(Math.random() * (chest.boss ? 5 : 3)) : 0;
  if (gems) g.addResource('gems', gems);
  const gear = Math.random() < (big ? 1 : 0.55) ? rollGear(g, { boss: !!chest.boss }) : null;
  if (gear) (s.groundItems ||= []).push({ id: gear.id, gear, item: null, count: 1, x: chest.x + 12, y: chest.y + 6 });
  if (Math.random() < 0.35) dropPickup(g, 'potion', chest.x - 10, chest.y + 6);
  g.anim('combat/poof', chest.x, chest.y - 10, { size: TILE * 1.4, dur: 0.4 });
  (g.openedChests ||= []).push({ x: chest.x, y: chest.y, boss: !!chest.boss, life: 3 });
  g.float(chest.x, chest.y - TILE * 1.4, `+${gold} gold${gems ? `, +${gems} gems` : ''}${gear ? ` · ${RARITY[gear.rarity].name} ${gear.name.replace(/^(Rare|Epic|Legendary) /, '')}` : ''}`, '#ffd76a');
  gainXp(g, big ? 40 : 15, hero);
  s.stats.chests = (s.stats.chests || 0) + 1;
  g.emit('change');
}

export function dropPickup(g, kind, x, y) {
  pickupsOf(g).push({ kind, x, y, life: 30, born: g.state.time });
}

/** Drink a potion: back to health, fast. */
export function drinkPotion(g, hero) {
  const r = rpgOf(g);
  if (!hero || !(r.potions > 0)) return false;
  const max = g.hero?.maxHp || 100;
  if (hero.hp >= max) { g.float(hero.x, hero.y - TILE * 1.3, 'Already at full health', '#d9d4c7'); return false; }
  r.potions--;
  hero.hp = Math.min(max, hero.hp + max * POTION_HEAL);
  g.float(hero.x, hero.y - TILE * 1.3, 'Glug! Healed', '#ff6b6b');
  g.anim('combat/parry', hero.x, hero.y - 12, { size: 30, dur: 0.3 });
  g.emit('change');
  return true;
}
