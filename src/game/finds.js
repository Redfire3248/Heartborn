import { TILE, DAY_LENGTH } from '../core/constants.js';

/*
 * Finds: little things that turn up around the village (a glinting treasure, a lost traveller,
 * a washed-up crate). Click one before it fades to collect it. Something to do while the village works.
 */

const MAX_FINDS = 3;
const LIFETIME = 150;                       // game seconds a find stays before it fades
const gap = () => 45 + Math.random() * 60;  // game seconds until the next one turns up

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const scaled = (g, n) => Math.round(n * (1 + g.state.era * 0.8));

export const FIND_KINDS = {
  treasure: {
    label: 'Glinting treasure', sprite: 'boats/treasure_chest', weight: 3,
    collect(g) { const gold = scaled(g, rand(15, 45)), gems = Math.random() < 0.35 ? rand(1, 3) : 0; add(g, { gold, gems }); return { text: `Treasure! +${gold} gold${gems ? `, +${gems} gems` : ''}`, color: '#ffcf5a' }; },
  },
  crate: {
    label: 'Supply crate', sprite: 'items/icon_wood', weight: 4,
    collect(g) { const wood = scaled(g, rand(20, 50)), stone = scaled(g, rand(10, 30)); add(g, { wood, stone }); return { text: `Supplies: +${wood} wood, +${stone} stone`, color: '#e6c79a' }; },
  },
  berries: {
    label: 'Wild harvest', sprite: 'items/icon_food', weight: 4,
    collect(g) { const food = scaled(g, rand(30, 70)); add(g, { food }); return { text: `A wild harvest: +${food} food`, color: '#8fe07a' }; },
  },
  traveller: {
    label: 'Lost traveller', sprite: 'people/explorer_m', weight: 2,
    collect(g) {
      if (g.state.villagers.length >= g.housing) { add(g, { influence: 10 }); return { text: 'The traveller has no home here, but tells of your village: +10 influence', color: '#9fd4ff' }; }
      const v = g.addWanderer();
      return { text: `${v.name} the traveller joins your people!`, color: '#9fd4ff' };
    },
  },
  relic: {
    label: 'Ancient relic', sprite: 'items/relic', weight: 1,
    collect(g) {
      g.state.modifiers.push({ id: 'found_relic', fate: 0.1, happy: 5, until: g.state.time + DAY_LENGTH * 2 });
      g.recalc();
      add(g, { influence: scaled(g, 15) });
      return { text: 'An ancient relic: +10% luck and happier people for two days', color: '#d9a8ff' };
    },
  },
};

function add(g, res) {
  for (const [k, n] of Object.entries(res)) if (n) g.addResource(k, n);
}

function pickKind() {
  const entries = Object.entries(FIND_KINDS);
  let r = Math.random() * entries.reduce((n, [, k]) => n + k.weight, 0);
  for (const [id, k] of entries) if ((r -= k.weight) < 0) return id;
  return 'crate';
}

export function updateFinds(g, dt) {
  const s = g.state;
  if (g.offline || g.visiting) return;
  s.finds ||= [];
  if (s.finds.length && s.finds.some(f => f.until <= s.time)) s.finds = s.finds.filter(f => f.until > s.time);
  s.nextFindAt ??= s.time + gap();
  if (s.time < s.nextFindAt) return;
  s.nextFindAt = s.time + gap();
  if (s.finds.length >= MAX_FINDS || !s.buildings.length) return;
  const p = g.randomLandTile(4, 14);
  if (!p) return;
  const kind = pickKind();
  const find = { id: `f${Math.floor(s.time * 1000).toString(36)}`, kind, x: p.x, y: p.y, until: s.time + LIFETIME, born: s.time };
  s.finds.push(find);
  g.log(`${FIND_KINDS[kind].label} spotted near the village. Click it to collect!`, 'event', { x: p.x, y: p.y });
}

/** The find under a world position (click), if any. */
export function findAt(g, x, y) {
  return (g.state.finds || []).find(f => Math.hypot(f.x - x, f.y - TILE * 0.3 - y) < TILE * 0.9) || null;
}

export function collectFind(g, find) {
  const s = g.state;
  if (!s.finds?.includes(find)) return null;
  s.finds = s.finds.filter(f => f !== find);
  const r = FIND_KINDS[find.kind].collect(g);
  s.stats.finds = (s.stats.finds || 0) + 1;
  g.float(find.x, find.y - TILE, r.text.split(':')[0].split('!')[0] + '!', r.color);
  g.puff({ x: find.x, y: find.y }, 'effects/spark', 10, 20);
  g.log(r.text, 'good', { x: find.x, y: find.y });
  g.emit('change');
  return r;
}
