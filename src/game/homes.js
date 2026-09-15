import { ADULT_AGE, TILE } from '../core/constants.js';
import { BUILDINGS } from '../data/buildings.js';

/*
 * Homes: every household gets a house of its own, and the house is reserved for that family.
 * A household is a couple, their young children, grown children who have not married yet,
 * and families who arrived together. Big families take a house big enough for all of them
 * (or a second one next door); newlyweds move into a home of their own when one is free.
 * At night people walk to their own home; people without one sleep wherever there is room.
 */

const REFRESH = 6;   // game seconds between reshuffles

const capacity = b => BUILDINGS[b.type]?.housing || 0;
const isHome = b => b.built && capacity(b) > 0 && b.type !== 'campfire';
// big blocks (Castle, Tenement, Arcology) are split into flats: many families, each with rooms of their own
const shared = b => capacity(b) >= 20;

/** Group the village into households (union-find over partners, parents and arrival groups). */
export function households(g) {
  const people = g.state.villagers.filter(v => !v.away || v.ruling);
  const byId = new Map(people.map(v => [v.id, v]));
  const parent = new Map(people.map(v => [v.id, v.id]));
  const find = id => { let r = id; while (parent.get(r) !== r) r = parent.get(r); parent.set(id, r); return r; };
  const join = (a, b) => { if (!byId.has(a) || !byId.has(b)) return; const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const v of people) {
    if (v.partner) join(v.id, v.partner);
    const living = (v.parents || []).filter(id => byId.has(id));
    // children, and grown children who have not married, live with their parents
    if (living.length && (v.age < ADULT_AGE || !v.partner)) for (const p of living) join(v.id, p);
    // families who arrived together stay together until they marry or have their own
    else if (!living.length && !v.partner && v.arrivedWith) join(v.id, v.arrivedWith);
  }
  const groups = new Map();
  for (const v of people) {
    const r = find(v.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(v);
  }
  return [...groups.values()];
}

/** The family name shown on a house: the name of its eldest member. */
export const familyName = members => {
  const eldest = [...members].sort((a, b) => b.age - a.age)[0];
  return eldest?.surname || eldest?.name || 'nobody';
};

export function assignHomes(g) {
  const s = g.state;
  const houses = s.buildings.filter(isHome);
  const byId = new Map(houses.map(b => [b.id, b]));
  const taken = new Map();   // house id -> seats used
  const groups = households(g).sort((a, b) => b.length - a.length);
  for (const b of houses) { b.household = null; b.family = null; b.families = null; }
  const homeless = [];

  const claim = (house, key, members) => {
    if (shared(house)) { house.household = 'flats'; (house.families ||= []).includes(familyName(members)) || house.families.push(familyName(members)); house.family = null; }
    else { house.household = key; house.family = familyName(members); }
  };
  const settle = (members, house) => {
    const room = capacity(house) - (taken.get(house.id) || 0);
    const moving = members.slice(0, room);
    for (const v of moving) v.homeId = house.id;
    taken.set(house.id, (taken.get(house.id) || 0) + moving.length);
    return members.slice(moving.length);
  };
  const seatsLeft = b => capacity(b) - (taken.get(b.id) || 0);
  const free = b => (shared(b) ? seatsLeft(b) > 0 : !taken.has(b.id));

  // pass 1: families keep the homes they already live in
  const waiting = [];
  for (const members of groups) {
    const key = members[0].id;
    // when a home is too small, the couple and their little ones stay; grown children move out first
    const eldest = [...members].sort((a, b) => b.age - a.age)[0];
    const rank = v => (v === eldest || (v.partner && v.partner === eldest.id) ? 0 : v.age < ADULT_AGE ? 1 : 2);
    let left = [...members].sort((a, b) => rank(a) - rank(b) || b.age - a.age);
    const current = new Map();
    for (const v of members) { const h = byId.get(v.homeId); if (h) current.set(h.id, (current.get(h.id) || 0) + 1); }
    for (const [id] of [...current].sort((a, b) => b[1] - a[1])) {
      const house = byId.get(id);
      if (!free(house) || !left.length) continue;
      left = settle(left, house);
      claim(house, key, members);
    }
    waiting.push({ key, members, left });
  }

  // pass 2: everyone still without a home, biggest families first: the smallest free house that fits them all,
  // or the biggest free house and then another one near it
  for (const w of waiting) {
    let guard = 0;
    while (w.left.length && guard++ < 6) {
      const open = houses.filter(free);
      if (!open.length) break;
      const near = w.members.find(v => byId.get(v.homeId)) ? g.buildingCenter(byId.get(w.members.find(v => byId.get(v.homeId)).homeId)) : null;
      const fits = open.filter(b => seatsLeft(b) >= w.left.length).sort((a, b) => seatsLeft(a) - seatsLeft(b) || dist(g, a, near) - dist(g, b, near));
      const house = fits[0] || open.sort((a, b) => seatsLeft(b) - seatsLeft(a) || dist(g, a, near) - dist(g, b, near))[0];
      w.left = settle(w.left, house);
      claim(house, w.key, w.members);
    }
    for (const v of w.left) { v.homeId = null; homeless.push(v); }
  }
  g._homeless = homeless.length;
  return { households: groups.length, homeless: homeless.length };
}

const dist = (g, b, p) => (p ? Math.hypot(g.buildingCenter(b).x - p.x, g.buildingCenter(b).y - p.y) : 0);

export function updateHomes(g, dt) {
  g._homesTimer = (g._homesTimer ?? 0) - dt;
  if (g._homesTimer > 0) return;
  g._homesTimer = REFRESH;
  assignHomes(g);
}

/** This person's own home, if they have one. */
export function homeOf(g, v) {
  if (!v.homeId) return null;
  const b = g.state.buildings.find(x => x.id === v.homeId);
  return b && isHome(b) ? b : null;
}

/** Who lives in a house. */
export const residents = (g, b) => g.state.villagers.filter(v => v.homeId === b.id);

/** Where someone without a home of their own sleeps: a house with a spare bed that no family has taken, or the campfire. */
export function shelterFor(g, v) {
  let best = null, bd = TILE * 40;
  for (const b of g.state.buildings) {
    if (!b.built || !BUILDINGS[b.type]?.housing) continue;
    if (b.household && b.type !== 'campfire' && !(shared(b) && residents(g, b).length < capacity(b))) continue;
    const c = g.buildingCenter(b);
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
