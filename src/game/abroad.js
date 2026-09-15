import { TILE, ADULT_AGE } from '../core/constants.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';

/*
 * In person, in another land. When you visit someone your avatar walks their island; when your spy
 * infiltrates, you take control of the spy there. Either way the person you control is a real villager in
 * that land's view (a copy of yours, with their looks, body and pack), moved with the avatar controls.
 * A spy goes disguised as an ordinary gatherer. The land's owner sees you walking about as a stranger.
 */

export const ABROAD_PREFIX = 'abroad_';

/** Put a copy of `person` into the land being viewed, and make it the one you control. */
export function arriveAbroad(land, person, { role = 'visitor' } = {}) {
  const s = land.state;
  s.villagers = s.villagers.filter(v => !v.id.startsWith(ABROAD_PREFIX));
  const spot = arrivalSpot(land);
  const spy = role === 'spy';
  const copy = {
    id: `${ABROAD_PREFIX}${person.id}`, name: person.name, surname: person.surname, sex: person.sex, age: Math.max(ADULT_AGE, person.age),
    x: spot.x, y: spot.y, hp: Math.max(40, person.hp), hunger: 100, happy: person.happy ?? 60,
    skills: { ...person.skills }, traits: spy ? (person.traits || []).filter(t => t !== 'knighted') : [...(person.traits || [])],
    talents: [...(person.talents || [])], body: { ...(person.body || {}) }, size: person.size,
    inv: JSON.parse(JSON.stringify(person.inv || { pack: {}, coins: 0 })),
    // a spy dresses as a common gatherer; a visiting ruler keeps their crown
    job: spy ? 'gather' : person.job, profession: spy ? 'gather' : person.profession, role: null,
    ruling: !spy && !!person.ruling, armed: !spy && !!person.armed, parents: null, partner: null, gen: 1, sick: 0,
    abroad: { role, homeId: person.id }, disguised: spy,
  };
  s.villagers.push(copy);
  land.hero = { id: copy.id, cd: 0, actCd: 0, swing: 0, inspire: 0, kills: 0, finds: 0, chopped: 0, bountyAt: Infinity, abroad: role };
  return copy;
}

/** Arrive at the edge of the settled land, on open ground. */
function arrivalSpot(land) {
  return land.randomLandTile(9, 14) || land.randomLandTile(4, 20) || land.center;
}

export function leaveAbroad(land) {
  if (!land) return;
  land.hero = null;
  land.state.villagers = land.state.villagers.filter(v => !v.id.startsWith(ABROAD_PREFIX));
}

/** What is right next to you over there: the building, the person, and how many guards are watching. */
export function surroundings(land, v) {
  const s = land.state;
  let building = null, bd = Infinity;
  for (const b of s.buildings) {
    if (!b.built || !BUILDINGS[b.type]) continue;
    const c = land.buildingCenter(b);
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < (sizeOf(b) / 2 + 1.6) * TILE && d < bd) { bd = d; building = b; }
  }
  let person = null, pd = TILE * 1.6;
  for (const o of s.villagers) {
    if (o === v || o.id.startsWith(ABROAD_PREFIX) || o.age < ADULT_AGE) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < pd) { pd = d; person = o; }
  }
  const guards = s.villagers.filter(o => (o.job === 'warrior' || o.job === 'scout') && Math.hypot(o.x - v.x, o.y - v.y) < TILE * 6).length;
  return { building, person, guards };
}

const TREASURY = ['market', 'stockpile', 'warehouse', 'granary', 'town_hall', 'bank', 'castle', 'treasury'];

/** The spy actions possible right where you stand. */
export function spyActions(land, v) {
  const { building, person, guards } = surroundings(land, v);
  const out = [{ id: 'scout', label: 'Count their soldiers', desc: 'Report their army, gold and food, then slip away' }];
  if (building) {
    out.push({ id: 'sabotage', label: `Sabotage the ${BUILDINGS[building.type].name}`, desc: 'Burn it down (uses 1 bomb)', target: { type: building.type, tx: building.tx, ty: building.ty } });
    if (TREASURY.includes(building.type)) out.push({ id: 'steal', label: `Rob the ${BUILDINGS[building.type].name}`, desc: 'Take a quarter of their gold', target: { type: building.type, tx: building.tx, ty: building.ty } });
  }
  if (person) {
    const who = person.role || person.job || 'villager';
    out.push({ id: 'assassinate', label: `Assassinate this ${who}`, desc: 'Kill them', target: { x: Math.round(person.x), y: Math.round(person.y), job: person.job, role: person.role || null } });
    out.push({ id: 'incite', label: `Turn this ${who} against their ruler`, desc: 'Make them a traitor', target: { x: Math.round(person.x), y: Math.round(person.y), job: person.job } });
  }
  return { actions: out, guards };
}
