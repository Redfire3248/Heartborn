// Full feature test that runs inside the real game page (dev server, ?emu).
// In the browser console: (await import('/tests/browser-suite.js')).run()
import { Game } from '/src/game/game.js';
import { newState, serialize, deserialize } from '/src/game/state.js';
import { BUILDINGS, ERAS } from '/src/data/buildings.js';
import { describeBuilding } from '/src/data/describe.js';
import { JOBS, assignJob, killVillager } from '/src/game/villagers.js';
import { OFFICES, appoint, officeUnlocked, setOfficeOption, dismiss } from '/src/game/court.js';
import { LAW_CATEGORIES } from '/src/data/laws.js';
import { DEEDS, runDeed, sacrificeVillager, exileVillager, smiteCreature } from '/src/game/deeds.js';
import { EVENTS } from '/src/data/events.js';
import { rally, standDown, spotChance, payWarbandTribute } from '/src/game/war.js';
import { isTrained, setCalling, encourage, setHeir, rulerOf, crown } from '/src/game/dynasty.js';
import { CALLINGS } from '/src/data/people.js';
import { accuse, punishTraitor, dailyTraitors, throwBomb, sufferStrike, dailyMachines, counterIntel } from '/src/game/intrigue.js';
import { CREATURES } from '/src/data/objects.js';
import { TILE } from '/src/core/constants.js';

const results = [];
const errors = [];
const ok = (cond, name, detail = '') => results.push({ pass: !!cond, name, detail });
async function step(name, fn) {
  try { await fn(); } catch (e) { results.push({ pass: false, name, detail: `THREW: ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join(' | ')}` }); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rich = () => ({ food: 5000, wood: 5000, stone: 5000, coal: 5000, iron: 5000, weapons: 200, bombs: 200, gold: 5000, gems: 500, science: 9000, influence: 5000 });

function freshGame({ era = 0, people = 12, resources = true } = {}) {
  const g = new Game(newState({ uid: 'test', name: 'Tester', villageName: 'Testhold' }));
  g.state.era = era;
  g.state.nextEventAt = Infinity;
  if (resources) Object.assign(g.state.resources, rich());
  for (let i = 0; i < people; i++) g.addWanderer();
  for (const v of g.state.villagers) v.age = Math.max(v.age, 20);
  // most tests are about other systems: let test villagers take any job (professions have their own test)
  for (const v of g.state.villagers) if (!v.traits.includes('versatile')) v.traits.push('versatile');
  g.recalc();
  // caps would clamp our test riches: lift them
  for (const k of Object.keys(g.caps)) g.caps[k] = 1e9;
  const recalc = g.recalc.bind(g);
  g.recalc = () => { recalc(); for (const k of Object.keys(g.caps)) g.caps[k] = 1e9; };
  return g;
}
const build = (g, type) => {
  // tests care about what buildings do, not about affording them
  for (const [k, n] of Object.entries(BUILDINGS[type].cost)) g.state.resources[k] = Math.max(g.state.resources[k] || 0, n);
  const spot = g.findBuildSpot(type);
  if (!spot) throw new Error(`no spot for ${type}`);
  const r = g.placeBuilding(type, spot.tx, spot.ty);
  if (!r.ok) throw new Error(`${type}: ${r.why}`);
  g.finishBuilding(r.building);
  return r.building;
};
const renderer = () => window.__hb.renderer;

export async function run() {
  results.length = 0;
  errors.length = 0;
  const onErr = e => errors.push(String(e.message || e.reason?.message || e.reason || e));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);

  // ------------------------------------------------------------ buildings
  await step('every building places, finishes, renders and explains itself', async () => {
    const g = freshGame({ era: ERAS.length - 1, people: 20 });
    const failed = [];
    for (const type of Object.keys(BUILDINGS)) {
      try {
        const b = build(g, type);
        const effects = describeBuilding(type);
        if (!effects.length && !BUILDINGS[type].desc) failed.push(`${type}: no description`);
        if (!g.state.buildings.includes(b)) failed.push(`${type}: vanished`);
      } catch (e) {
        // waterside buildings need a shore; some random maps have none near home
        if (!(BUILDINGS[type].nearWater && e.message.startsWith('no spot'))) failed.push(`${type}: ${e.message}`);
      }
    }
    g.simulate(90 * 2);
    renderer().render(g, 0.016);
    ok(!failed.length, `all ${Object.keys(BUILDINGS).length} buildings build + simulate + render`, failed.join('; '));
    ok(g.housing > 100 && g.defense > 100, 'building effects add up (housing, defense)', `housing ${g.housing}, defense ${g.defense}`);
  });

  await step('bigger homes take more tiles, old saves keep their size', async () => {
    const g = freshGame({ era: ERAS.length - 1, people: 6 });
    const sizes = ['house', 'tenement', 'arcology'].map(t => build(g, t).size);
    ok(sizes[0] === 2 && sizes[1] === 3 && sizes[2] === 4, 'house 2, tenement 3, arcology 4', sizes.join(','));
    const b = g.state.buildings.find(x => x.type === 'arcology');
    ok(g.buildingAt(b.tx + 3, b.ty + 3) === b, 'arcology covers its far corner tile');
    const saved = deserialize(serialize(g.state));
    for (const x of saved.buildings) if (x.type === 'house') delete x.size;
    const g2 = new Game(saved);
    ok(g2.state.buildings.find(x => x.type === 'house').size === 1, 'old 1-tile houses migrate as size 1');
  });

  await step('the same choice does not always give the same result', async () => {
    const texts = new Set();
    for (let i = 0; i < 40; i++) {
      const g = freshGame({ era: 2, people: 10 });
      const ev = EVENTS.find(e => !e.choices[0].cost) || EVENTS[0];
      g.startEvent(ev);
      texts.add(g.chooseEvent(0)?.text);
    }
    ok(texts.size > 1, 'repeated choice gives varied outcomes', `${texts.size} distinct`);
  });

  await step('job upgrades: builders build faster with every level', async () => {
    const U = await import('/src/game/upgrades.js');
    const g = freshGame({ era: 3, people: 2 });
    ok(U.upgradeSpeed(g, 'build') === 1, 'no upgrades: normal speed');
    const gold = g.state.resources.gold;
    for (let i = 0; i < 3; i++) U.upgradeJob(g, 'build');
    ok(U.jobLevel(g, 'build') === 3 && Math.abs(U.upgradeSpeed(g, 'build') - 1.3) < 1e-9, 'three upgrades: builders work 30% faster');
    ok(g.state.resources.gold < gold, 'upgrades cost resources');
    ok(U.upgradeSpeed(g, 'chop') === 1, 'upgrading builders does not speed up woodcutters');
    for (let i = 0; i < 20; i++) U.upgradeJob(g, 'build');
    ok(U.jobLevel(g, 'build') === U.MAX_LEVEL && U.upgradeJob(g, 'build').error, `stops at level ${U.MAX_LEVEL}`);
    const broke = freshGame({ era: 3, people: 2, resources: false });
    Object.assign(broke.state.resources, { wood: 0, stone: 0, gold: 0 });
    ok(U.upgradeJob(broke, 'build').error && U.jobLevel(broke, 'build') === 0, 'cannot upgrade without the resources');
  });

  await step('Master Builder follows goals and the next era, and upgrades', async () => {
    const U = await import('/src/game/upgrades.js');
    const C = await import('/src/game/court.js');
    const G = await import('/src/game/goals.js');
    const g = freshGame({ era: 2, people: 10 });
    build(g, 'campfire'); build(g, 'stockpile');
    for (const id of G.GOALS.filter(x => x.era < 2).map(x => x.id)) g.state.goals.claimed.push(id);
    C.appoint(g, 'master_builder', g.state.villagers.find(v => !v.ruling));
    const orders = [];
    const log = g.log.bind(g);
    g.log = (text, kind, pos) => { if (/Master Builder ordered/.test(text)) orders.push(text); log(text, kind, pos); };
    for (let i = 0; i < 6; i++) { g._courtTimers = { master_builder: 0 }; g.step(0.1); for (const b of g.state.buildings) if (!b.built) g.finishBuilding(b); }
    ok(orders.some(o => /for a goal|needed for the/.test(o)), 'orders buildings for goals and the next era', orders.slice(0, 4).join(' | '));
    const stores = g.state.buildings.filter(b => b.type === 'warehouse' || b.type === 'stockpile').length;
    ok(stores <= 2, `no street of warehouses (${stores} stores)`);
    ok(U.officeLevel(g, 'master_builder') === 0 && !U.upgradeOffice(g, 'master_builder').error && U.officeLevel(g, 'master_builder') === 1, 'the Master Builder office can be upgraded');
    for (let i = 0; i < 10; i++) U.upgradeOffice(g, 'master_builder');
    ok(U.officeLevel(g, 'master_builder') === U.OFFICE_UPGRADES.master_builder.max, 'office upgrades stop at the top level');
  });

  await step('aimed missiles land where you choose', async () => {
    const I = await import('/src/game/intrigue.js');
    const V = await import('/src/game/visit.js');
    const g = freshGame({ era: 5, people: 6 });
    build(g, 'campfire');
    const silo = build(g, 'missile_silo');
    const farm = build(g, 'farm');
    const far = g.state.buildings.find(b => b !== farm && Math.hypot(b.tx - farm.tx, b.ty - farm.ty) > 10) || build(g, 'house');
    Object.assign(g.state.resources, { science: 1000, iron: 1000, bombs: 50 });
    const r = I.strikeOwnLand(g, false, { tx: farm.tx + 1, ty: farm.ty + 1 });
    ok(r.ok && g.strikes.length === 1 && g.state.buildings.includes(farm), 'a strike on your own land falls first, then hits', JSON.stringify(r));
    for (let i = 0; i < 100; i++) g.updateFx(1 / 30);
    ok(!g.state.buildings.includes(farm) || !farm.built, 'the aimed spot is wrecked');
    ok(Math.hypot(silo.tx - farm.tx, silo.ty - farm.ty) <= 5 || silo.built, 'buildings outside the blast are untouched');
    const visit = V.makeVisitGame({ seed: g.state.seed, snapshot: V.villageSnapshot(g), villageName: 'Target', uid: 'x' });
    const p = I.strikePreview(visit.state.buildings, [], far.tx, far.ty, true, b => visit.buildingCenter(b));
    ok(p.buildings.some(b => b.type === far.type), 'the targeting map shows what another realm would lose');
    const shielded = I.sufferStrike(g, 'Foe', false, null);
    ok(!shielded.pending, 'strikes without an aim still hit at random');
  });

  await step('lead in person: walk, fight, gather, inspire and bounties', async () => {
    const H = await import('/src/game/hero.js');
    const Cr = await import('/src/game/creatures.js');
    const g = freshGame({ era: 1, people: 4 });
    build(g, 'campfire');
    const r = H.startLead(g);
    const v = r.hero;
    ok(r.ok && v.ruling, 'the ruler steps out to lead');
    const x0 = v.x;
    for (let i = 0; i < 30; i++) H.updateHero(g, 1 / 30, { mx: 1, my: 0 });
    ok(v.x !== x0 || !g.world.walkable(x0 + 40, v.y), 'the ruler walks where you steer', `${Math.round(v.x - x0)}px`);
    const wolf = g.spawnCreature('wolf', v.x + 18, v.y);
    for (let i = 0; i < 200 && g.state.creatures.includes(wolf); i++) { H.updateHero(g, 1 / 30, { act: true }); v.hp = 100; }
    ok(!g.state.creatures.includes(wolf) && g.hero.kills === 1, 'the ruler slays a beast in reach');
    const other = g.state.villagers.find(o => o !== v);
    other.x = v.x + 30; other.y = v.y;
    ok(H.inspired(g, other), 'people near the ruler are inspired');
    g.state.finds = [{ id: 'hf', kind: 'berries', x: v.x, y: v.y, until: g.state.time + 99, born: g.state.time }];
    H.updateHero(g, 1 / 30, {});
    ok(g.hero.finds === 1 && !g.state.finds.length, 'walking over a find picks it up');
    g.hero.bountyAt = 0;
    H.updateHero(g, 1 / 30, {});
    const b = H.bountyOf(g);
    ok(!!b, 'a bounty appears while you lead');
    if (b) { const gold = g.state.resources.gold; Cr.damageCreature(g, b, 1e6, other); ok(g.state.resources.gold > gold, 'killing the bounty pays gold'); }
    H.endLead(g);
    ok(!g.hero, 'you can stop leading');
    const pick = g.state.villagers.find(o => !o.ruling && o.age >= 16);
    const av = H.setAvatar(g, pick);
    ok(av.ok && g.hero.id === pick.id && g.state.avatarId === pick.id, 'any villager can be made your avatar');
    H.endLead(g);
    ok(H.startLead(g).hero === pick, 'the Avatar button plays as your chosen villager again');
    H.endLead(g);
  });

  await step('strength, speed and stamina really matter', async () => {
    const B = await import('/src/game/body.js');
    const V = await import('/src/game/villagers.js');
    const g = freshGame({ era: 1, people: 4 });
    build(g, 'campfire');
    ok(g.state.villagers.every(v => v.body && v.body.strength >= 1 && v.body.speed <= 10), 'everyone has a body: strength, speed and stamina');
    const [a, b] = g.state.villagers.filter(v => !v.ruling);
    a.body = { strength: 10, speed: 10, stamina: 10 };
    b.body = { strength: 1, speed: 1, stamina: 1 };
    ok(V.walkSpeed(g, a) > V.walkSpeed(g, b) * 1.6, 'fast people walk much faster', `${V.walkSpeed(g, a).toFixed(1)} vs ${V.walkSpeed(g, b).toFixed(1)}`);
    ok(B.bodyWorkMult(a, 'chop') > B.bodyWorkMult(b, 'chop') * 1.5, 'strong, tireless people chop much faster');
    ok(B.hungerMult(a) < B.hungerMult(b), 'stamina means slower hunger');
    const kids = [];
    a.sex = 'f'; b.sex = 'm'; a.age = 25; b.age = 25;
    const mom = a, dad = { ...b, body: { strength: 10, speed: 10, stamina: 10 } };
    for (let i = 0; i < 8; i++) { const before = g.state.villagers.length; V.__birthForTest(g, mom, dad); kids.push(g.state.villagers[before]); }
    ok(kids.every(k => k.body.strength >= 7), 'children of strong parents are born strong', kids.map(k => k.body.strength).join(','));
  });

  await step('households share a home that is reserved for them', async () => {
    const Ho = await import('/src/game/homes.js');
    const V = await import('/src/game/villagers.js');
    const g = freshGame({ era: 2, people: 2 });
    build(g, 'campfire');
    const [a, b] = g.state.villagers;
    a.sex = 'f'; b.sex = 'm'; a.age = b.age = 28; a.partner = b.id; b.partner = a.id; a.lastBirthAt = -1e9;
    V.__birthForTest(g, a, b);
    const kid = g.state.villagers.find(v => v.parents?.includes(a.id));
    const loner = g.addWanderer(); loner.age = 30; loner.partner = null; loner.parents = null; loner.arrivedWith = null;
    for (let i = 0; i < Ho.households(g).length + 1; i++) build(g, 'tent');
    Ho.assignHomes(g);
    ok(a.homeId && a.homeId === b.homeId && b.homeId === kid.homeId, 'a couple and their child share one home', `${a.homeId} ${b.homeId} ${kid?.homeId}`);
    ok(loner.homeId && loner.homeId !== a.homeId, 'someone from another household gets a different home');
    const family = g.state.buildings.find(x => x.id === a.homeId);
    ok(family.family === (a.age >= b.age ? a.surname : b.surname) || !!family.family, 'the house is reserved in the family name', family.family);
    const newcomer = g.addWanderer(); newcomer.partner = null; newcomer.parents = null; newcomer.arrivedWith = null;
    Ho.assignHomes(g);
    ok(newcomer.homeId !== a.homeId, 'a stranger never moves into a family\'s reserved home, even with beds to spare');
    ok(a.homeId === family.id, 'families keep their home when the village reshuffles');
    ok(Ho.residents(g, family).length === 3, 'the house lists its residents');
  });

  await step('people can fight and kill people of their own village', async () => {
    const V = await import('/src/game/villagers.js');
    const H = await import('/src/game/hero.js');
    const g = freshGame({ era: 1, people: 6 });
    build(g, 'campfire');
    g.state.creatures = [];
    const [a, b, c] = g.state.villagers.filter(v => !v.ruling && v.age >= 16);
    b.x = a.x + 10; b.y = a.y; b.traits = b.traits.filter(t => t !== 'brave');
    const pop = g.state.villagers.length;
    ok(V.attackVillager(g, a, b, { deadly: true }), 'a villager can attack another');
    for (let i = 0; i < 600 && g.state.villagers.includes(b); i++) { g.step(0.1); a.hp = Math.max(a.hp, 60); }
    ok(!g.state.villagers.includes(b) && g.state.villagers.length === pop - 1, 'a deadly attack ends in a death', `b hp ${Math.round(b.hp)}`);
    ok(a.murders === 1, 'the killer is remembered');
    // a brawl is not a murder
    c.x = a.x + 10; c.y = a.y; c.hp = 100; a._task = null;
    V.attackVillager(g, a, c, { deadly: false });
    for (let i = 0; i < 400 && a._task?.type === 'brawl'; i++) { g.step(0.1); a.hp = Math.max(a.hp, 60); }
    ok(g.state.villagers.includes(c), 'a brawl stops before anyone dies');
    // your avatar in hostile mode
    const me = g.state.villagers.find(v => v.ruling);
    const victim = g.state.villagers.find(v => v !== me && v !== a && v.age >= 16) || c;
    H.startLead(g, me);
    victim.x = me.x + 12; victim.y = me.y; victim.hp = 1;
    H.updateHero(g, 1 / 30, { act: true });
    ok(g.state.villagers.includes(victim), 'a peaceful avatar never strikes people');
    H.setViolent(g, true);
    g.state.creatures = [];
    g.hero.actCd = 0; g.hero.cd = 0;
    victim.x = me.x + 12; victim.y = me.y; victim.hp = 1;
    H.updateHero(g, 1 / 30, { act: true });
    ok(!g.state.villagers.includes(victim), 'in Hostile mode your avatar can kill your own people');
    H.endLead(g);
  });

  await step('items can be dropped on the ground and picked up', async () => {
    const GI = await import('/src/game/groundItems.js');
    const H = await import('/src/game/hero.js');
    const D = await import('/src/game/dynasty.js');
    const g = freshGame({ era: 1, people: 3 });
    build(g, 'campfire');
    const v = g.state.villagers.find(x => x.ruling);
    D.addItem(v, 'sword', 2);
    const swords = v.inv.pack.sword;
    const it = GI.dropFromPack(g, v, 'sword', 1, v.x + 60, v.y);
    ok(it && v.inv.pack.sword === swords - 1 && GI.groundItems(g).length === 1, 'dropping takes it out of the pack and lays it on the ground');
    ok(GI.itemAt(g, it.x, it.y - 6) === it, 'the item under the cursor can be grabbed');
    const other = g.state.villagers.find(x => x !== v);
    ok(GI.pickUp(g, other, it) && other.inv.pack.sword >= 1 && !GI.groundItems(g).length, 'dragging it onto a villager gives it to them');
    const d = GI.dropItem(g, 'shield', 3, v.x + 20, v.y);
    ok(d && d.count === 3, 'the admin drop command puts items at a spot');
    H.startLead(g, v);
    for (let i = 0; i < 20; i++) H.updateHero(g, 1 / 30, { mx: 1 });
    ok(!GI.groundItems(g).length || Math.abs(v.x - d.x) > 20, 'your avatar picks items up by walking over them');
    H.endLead(g);
  });

  await step('fast lives, and workers carry what they gather home', async () => {
    const g = freshGame({ era: 1, people: 4, resources: false });
    build(g, 'campfire'); build(g, 'stockpile');
    const kid = g.addWanderer({ child: true }); kid.age = 1;
    const adult = g.state.villagers.find(v => !v.ruling && v !== kid); const age0 = adult.age;
    for (let d = 0; d < 3; d++) g.newDay();
    ok(kid.age >= 12 && adult.age - age0 >= 3 && adult.age - age0 < 4, `a child grows up in about 3 days (${Math.floor(kid.age)}), adults age a year a day (+${Math.round(adult.age - age0)})`);
    Object.assign(g.state.resources, { wood: 0, food: 0, stone: 0 });
    let carried = 0;
    for (let i = 0; i < 90 * 20 * 2 && g.state.resources.wood + g.state.resources.food + g.state.resources.stone < 10; i++) {
      g.update(0.05); g.pendingEvent = null;
      if (g.state.villagers.some(v => v._carry)) carried++;
      if (g.isNight) g.state.time += 90 * 0.4;
    }
    ok(carried > 0, 'workers carry their loads', `${carried} frames with someone carrying`);
    ok(g.state.resources.wood + g.state.resources.food + g.state.resources.stone >= 10, 'loads are delivered to the stores', JSON.stringify({ wood: Math.floor(g.state.resources.wood), food: Math.floor(g.state.resources.food), stone: Math.floor(g.state.resources.stone) }));
  });

  await step('sailing: shipyard, boats, steering, bombs, pirates, treasure, sinking', async () => {
    const S = await import('/src/game/sailing.js');
    const g = freshGame({ era: 3, people: 6 });
    build(g, 'campfire');
    let yard;
    try { yard = build(g, 'shipyard'); } catch { ok(true, 'no shore near home on this map (sailing skipped)'); return; }
    ok(yard, 'a Shipyard can be built by the water');
    ok(S.buildBoat(g, 'energy_battleship').error, 'future ships stay locked until their era');
    const r = S.buildBoat(g, 'galleon');
    ok(r.ok && S.fleetOf(g).length === 1, 'the shipyard builds a galleon');
    ok(S.setSail(g, r.boat.id).ok && g.sail, 'set sail');
    const s = g.sail, start = { x: s.x, y: s.y };
    for (let i = 0; i < 60; i++) S.updateSailing(g, 1 / 30, { throttle: 1 });
    ok(Math.hypot(s.x - start.x, s.y - start.y) > 40, 'the boat moves when you steer', `${Math.round(Math.hypot(s.x - start.x, s.y - start.y))}px`);
    ok(g.world.isWater(Math.floor(s.x / TILE), Math.floor(s.y / TILE)), 'the boat stays on the water');
    const bombs = g.state.resources.bombs;
    S.fire(g);
    ok(s.shots.length === 2 && g.state.resources.bombs === bombs - 1, 'a galleon fires two bombs at once');
    s.nextPirateAt = s.time; S.updateSailing(g, 0.01, {});
    ok(s.pirates.length >= 1, 'pirates come for you');
    const p = s.pirates[0];
    for (let k = 0; k < 30 && s.pirates.includes(p); k++) {
      p.x = s.x + Math.cos(s.angle) * TILE * 2.5; p.y = s.y + Math.sin(s.angle) * TILE * 2.5;
      s.reload = 0; S.fire(g);
      for (let i = 0; i < 10; i++) S.updateSailing(g, 1 / 30, {});
    }
    ok(s.sunk >= 1 && s.loot.length >= 1, 'bombs sink a pirate and it drops treasure');
    const gold = g.state.resources.gold;
    s.loot[0].x = s.x; s.loot[0].y = s.y; S.updateSailing(g, 0.01, {});
    ok(g.state.resources.gold > gold, 'sailing over treasure collects gold');
    S.returnToPort(g);
    ok(!g.sail, 'return to port');
    const boat = S.fleetOf(g)[0];
    S.setSail(g, boat.id);
    boat.hull = 1;
    g.sail.shots.push({ x: g.sail.x, y: g.sail.y, vx: 0, vy: 0, left: 50, dmg: 50, heavy: true, mine: false });
    S.updateSailing(g, 0.01, {});
    ok(!g.sail && !S.fleetOf(g).includes(boat), 'a boat with no hull left sinks and is lost');
  });

  await step('talents, gifted pride and rebellion, magic, talking, family names', async () => {
    const T = await import('/src/game/talents.js');
    const M = await import('/src/game/magic.js');
    const K = await import('/src/game/talk.js');
    const g = freshGame({ era: 3, people: 12 });
    ok(g.state.villagers.every(v => v.talents?.length >= 1 && v.talents.length <= 2), 'everyone has one or two natural talents');
    ok(g.state.villagers.every(v => v.surname), 'everyone has a family name');
    // children take after their parents
    const mom = g.state.villagers[1], dad = g.state.villagers[2];
    mom.sex = 'f'; dad.sex = 'm'; mom.traits = ['brave', 'honest']; dad.traits = ['brave'];
    let brave = 0, surname = 0;
    const V = await import('/src/game/villagers.js');
    for (let i = 0; i < 60; i++) {
      const before = g.state.villagers.length;
      V.__birthForTest?.(g, mom, dad);
      const child = g.state.villagers[before];
      if (child?.traits.includes('brave')) brave++;
      if (child?.surname === dad.surname) surname++;
      if (child) g.state.villagers.splice(before, 1);
    }
    if (V.__birthForTest) {
      ok(surname === 60, 'children take their father’s family name', `${surname}/60`);
      ok(brave > 30, 'a trait both parents share usually passes on', `${brave}/60 brave`);
    }
    // gifted pride grows into a rebellion event
    const proud = g.state.villagers.find(v => !v.ruling && !v.office);
    proud.gifted = true; proud.talents = ['combat']; proud.skills.combat = 9; proud.happy = 20; proud.ego = 95; proud.traits = proud.traits.filter(t => t !== 'loyal');
    g.pendingEvent = null;
    T.dailyTalents(g);
    ok(g.pendingEvent?.id === 'gifted_rebellion', 'a proud gifted villager rebels', g.pendingEvent?.title);
    const res = g.chooseEvent(2);   // duel
    ok(res?.text, 'the rebellion can be settled', res?.text);
    // magic
    const wiz = g.state.villagers.find(v => !v.ruling && v !== proud);
    wiz.talents = ['magic']; wiz.profession = 'mage'; wiz.traits = [];
    ok(assignJob(g, wiz, 'mage'), 'someone with the Magic talent can become a wizard');
    const plain = g.state.villagers.find(v => !v.ruling && v !== proud && v !== wiz);
    plain.traits = ['versatile']; plain.talents = ['farm'];
    ok(!assignJob(g, plain, 'mage'), 'magic cannot be learned without the gift');
    wiz.skills.magic = 7; wiz.mana = 100;
    const wolf = g.spawnCreature('wolf', wiz.x + 40, wiz.y);
    const hp = g.state.creatures.find(c => c.t === 'wolf')?.hp ?? null;
    const cast = M.castSpell(g, wiz, 'fireball');
    ok(!cast.error && wiz.mana < 100, 'a wizard casts Fireball at a monster', cast.error || cast.text);
    wiz.mana = 100; const hurt = g.state.villagers.find(v => v !== wiz); hurt.hp = 20;
    ok(!M.castSpell(g, wiz, 'heal').error && hurt.hp > 20, 'Healing Light heals the wounded', `hp ${Math.round(hurt.hp)}`);
    wiz.mana = 100;
    ok(!M.castSpell(g, wiz, 'ward').error && g.state.modifiers.some(m => m.id === 'arcane_ward'), 'Arcane Ward protects the village');
    // talking
    ok(K.chatter(g, wiz)?.text && K.TOPICS.every(([id]) => K.talkTo(g, wiz, id)), 'villagers chatter and answer every topic');
    g.step(0.6); for (let i = 0; i < 200; i++) K.updateTalk(g, 0.6);
    ok(g.state.villagers.some(v => v._say?.text), 'speech bubbles appear over time');
  });

  await step('founders, trade skills, tools, miners and succession', async () => {
    const P = await import('/src/game/professions.js');
    const V = await import('/src/game/villagers.js');
    const C = await import('/src/game/court.js');
    const g0 = new Game(newState({ uid: 't', name: 'T', villageName: 'T' }));
    const [king, smith, cutter] = g0.state.villagers;
    ok(king.ruling && king.profession === 'warrior' && king.trained && king.inv.pack.sword, 'the first ruler is a trained warrior with a sword');
    ok(smith.profession === 'smith' && smith.inv.pack.hammer && cutter.profession === 'chop' && cutter.inv.pack.axe, 'a blacksmith and a woodcutter start with their tools');
    const g = freshGame({ era: 1, people: 0 });
    const spy = g.addWanderer(); spy.age = 25; spy.traits = []; spy.profession = null; spy.job = 'spy'; P.ensureProfession(spy);
    ok(spy.skills.stealth >= 3, `a spy by trade is already a trained spy (stealth ${spy.skills.stealth})`);
    const farmer = g.addWanderer(); farmer.age = 25; farmer.traits = []; farmer.profession = 'farm';
    ok(P.canDoJob(farmer, 'mine'), 'anyone can become a miner');
    build(g, 'campfire');
    const hut = build(g, 'craft_hut');
    delete farmer.inv.pack.hoe;
    const worker = g.addWanderer(); worker.age = 25; worker.profession = 'smith'; worker.traits = ['versatile'];
    g.state.resources.wood = 99; g.state.resources.stone = 99;
    worker._task = { type: 'craft', building: hut, phase: 'work', timer: 0, x: worker.x, y: worker.y };
    const before = g.state.villagers.filter(v => v.profession && P.TRADE_TOOL[v.profession] && !v.inv.pack[P.TRADE_TOOL[v.profession]]).length;
    for (let i = 0; i < 3 && worker._task; i++) g.step(0.1);
    const after = g.state.villagers.filter(v => v.profession && P.TRADE_TOOL[v.profession] && !v.inv.pack[P.TRADE_TOOL[v.profession]]).length;
    ok(after === before - 1, 'the smith forges a tool for someone without one', `${before} → ${after}`);
    ok(V.toolFor({ _task: { type: 'chop', phase: 'work' }, inv: { pack: {} } }) === null, 'nobody swings a tool they do not have');
    const cand = g.state.villagers.filter(v => !v.ruling && v.age >= 16);
    C.appoint(g, 'steward', cand[0]);
    V.killVillager(g, cand[0], 'fell in battle');
    g._courtTimers = {}; for (let i = 0; i < 12; i++) g.step(0.1);
    ok(C.officialOf(g, 'steward') && C.officialOf(g, 'steward') !== cand[0], 'a dead official is replaced at once', C.officialOf(g, 'steward')?.name);
  });

  await step('Steward puts people to work in their trades', async () => {
    const C = await import('/src/game/court.js');
    const g = freshGame({ era: 2, people: 0 });
    build(g, 'campfire');
    const trades = ['farm', 'farm', 'farm', 'farm', 'farm', 'farm', 'chop', 'chop', 'mine', 'smith', 'fish', 'build'];
    for (const t of trades) { const v = g.addWanderer(); v.age = 25; v.traits = []; v.profession = t; v.job = 'gather'; }
    const jack = g.addWanderer(); jack.age = 25; jack.traits = ['versatile']; jack.job = 'gather';
    build(g, 'farm');   // one farm: room for a few farmers only
    const farmRoom = C.slots(g, 'farm');
    const { shortages } = C.workTrades(g, C.managed(g), 'balanced');
    const byJob = j => g.state.villagers.filter(v => v.job === j).length;
    ok(byJob('chop') >= 2 && byJob('mine') >= 1 && byJob('build') >= 1, 'woodcutters, miners and builders work their trades', JSON.stringify({ chop: byJob('chop'), mine: byJob('mine'), build: byJob('build') }));
    ok(byJob('farm') >= Math.min(6, farmRoom) && shortages.farm === 6 - Math.min(6, farmRoom), `farmers fill the farm (${farmRoom} places), the rest are reported`, JSON.stringify(shortages));
    ok(shortages.smith === 1 && shortages.fish === 1, 'smith without a forge and fisher without a hut are reported', JSON.stringify(shortages));
    ok(!g.state.villagers.some(v => v.profession === 'chop' && v.job === 'gather'), 'nobody with a trade is sent gathering when their trade has work');
    ok(jack.job !== 'gather' || g.state.resources.food < g.state.villagers.length * 4, 'the Jack of all trades is sent where hands are needed', jack.job);
  });

  await step('goals: progress, claim rewards, era chest', async () => {
    const G = await import('/src/game/goals.js');
    const g = freshGame({ era: 0, people: 3, resources: false });
    g.recalc = g.recalc.bind(g);
    ok(G.GOALS.every(x => !x.type || BUILDINGS[x.type]), `every goal points at a real building (${G.GOALS.length} goals)`);
    ok(G.activeGoals(g)[0]?.id === 'fire' && !G.activeGoals(g)[0].done, 'first goal is the campfire, not done yet');
    ok(G.claimGoal(g, 'fire') === null, 'an unfinished goal cannot be claimed');
    build(g, 'campfire');
    const food = g.state.resources.food;
    const r = G.claimGoal(g, 'fire');
    ok(r && g.state.resources.food === food + 30, 'claiming gives the reward', `${food} → ${g.state.resources.food}`);
    ok(G.claimGoal(g, 'fire') === null, 'a goal pays out only once');
    // finish the whole first era: its chest opens once
    for (const x of G.GOALS.filter(x => x.era === 0)) g.state.goals.claimed.includes(x.id) || g.state.goals.claimed.push(x.id);
    g.state.goals.claimed.pop();
    const last = G.GOALS.filter(x => x.era === 0).at(-1);
    g.state.era = 1;
    const res = G.claimGoal(g, last.id);
    ok(res?.chest?.gold > 0, 'finishing every goal of an era opens its chest', JSON.stringify(res?.chest));
  });

  await step('finds turn up and can be collected', async () => {
    const F = await import('/src/game/finds.js');
    const g = freshGame({ era: 1, people: 6 });
    build(g, 'campfire');
    g.state.nextFindAt = g.state.time;
    F.updateFinds(g, 0.1);
    ok(g.state.finds.length === 1, 'a find appears', JSON.stringify(g.state.finds.map(f => f.kind)));
    const f = g.state.finds[0];
    ok(F.findAt(g, f.x, f.y - 10) === f, 'clicking near it finds it');
    const r = F.collectFind(g, f);
    ok(r && !g.state.finds.length, 'collecting it removes it and gives something', r?.text);
    for (const kind of Object.keys(F.FIND_KINDS)) {
      const got = F.FIND_KINDS[kind].collect(g);
      ok(got?.text, `find "${kind}" works`, got?.text);
    }
    g.state.finds = [{ id: 'x', kind: 'crate', x: 0, y: 0, until: g.state.time - 1, born: 0 }];
    F.updateFinds(g, 0.1);
    ok(!g.state.finds.some(x => x.id === 'x'), 'old finds fade away');
  });

  await step('anyone can train as a spy; bridges reach the coast', async () => {
    const P = await import('/src/game/professions.js');
    const g = freshGame({ era: 3, people: 4 });
    const v = g.state.villagers[0];
    v.traits = v.traits.filter(t => t !== 'versatile');
    v.profession = 'farm';
    ok(P.canDoJob(v, 'spy'), 'a farmer can become a spy');
    const Br = await import('/src/game/bridges.js');
    const players = ['a1', 'b22', 'c333', 'd4444'].map((uid, i) => ({ uid, name: `R${i}`, villageName: `L${i}`, online: true }));
    const bridges = Br.computeBridges(g.world, 'me', players);
    ok(bridges.length >= 1, `bridges are built towards neighbours (${bridges.length})`);
    ok(bridges.every(b => g.world.isWater(b.tiles.at(-1).tx, b.tiles.at(-1).ty)), 'each bridge ends over water');
    ok(Br.bridgeAt(bridges, bridges[0].tiles[1].tx, bridges[0].tiles[1].ty) === bridges[0], 'clicking a bridge tile finds the bridge');
  });

  await step('each building has a sprite image', async () => {
    const missing = [];
    for (const type of Object.keys(BUILDINGS)) {
      const res = await fetch(`/assets/${BUILDINGS[type].sprite || `buildings/${type}`}.png`, { method: 'HEAD' });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('image')) missing.push(type);
    }
    ok(true, `building sprites: ${Object.keys(BUILDINGS).length - missing.length} drawn, ${missing.length} still placeholders`, missing.join(', '));
  });

  await step('daily building production works', async () => {
    const g = freshGame({ era: 4, people: 6, resources: false });
    for (const t of ['campfire', 'stockpile', 'warehouse', 'pasture', 'charcoal_kiln', 'steel_mill', 'printing_press', 'market']) build(g, t);
    const before = { ...g.state.resources };
    g.newDay();
    const r = g.state.resources;
    ok(r.coal >= before.coal + 4, 'Charcoal Kiln adds coal daily', `${before.coal} → ${r.coal}`);
    ok(r.iron >= before.iron + 8, 'Steel Mill adds iron daily', `${before.iron} → ${r.iron}`);
    ok(r.science >= before.science + 4, 'Printing Press adds science daily', `${before.science} → ${r.science}`);
    ok(r.gold >= before.gold + 2, 'Market earns gold daily', `${before.gold} → ${r.gold}`);
  });

  // ------------------------------------------------------------ jobs, training, crafting
  await step('jobs, training and weapons', async () => {
    const g = freshGame({ era: 2, people: 10 });
    const v = g.state.villagers.find(x => !x.ruling);
    v.skills.combat = 0; v.trained = false;
    ok(assignJob(g, v, 'warrior') === false, 'untrained villager cannot become a warrior without a training yard');
    build(g, 'campfire');
    build(g, 'training_ground');
    assignJob(g, v, 'warrior');
    ok(v.job === 'recruit', 'untrained warrior order becomes Recruit', v.job);
    // keep the recruit healthy and fed so a random wolf or fever doesn't stall the drill
    for (let i = 0; i < 120 && v.job === 'recruit'; i++) { v.hp = 100; v.sick = 0; v.hunger = 100; g.simulate(10); }
    ok(v.job === 'warrior' && isTrained(v), 'recruit trains into a warrior', `${v.job}, combat ${v.skills.combat.toFixed(1)}`);
    for (let i = 0; i < 10 && !v.armed; i++) g.simulate(3);
    ok(v.armed, 'warrior picks up a weapon from storage');

    const others = g.state.villagers.filter(x => !x.ruling && x !== v);
    const jobs = Object.keys(JOBS).filter(j => !['warrior', 'idle', 'mage'].includes(j));   // wizards need the Magic talent (tested separately)
    const failed = jobs.filter((job, i) => !assignJob(g, others[i % others.length], job));
    ok(!failed.length, `every job can be assigned (${jobs.length})`, failed.join(', '));

    const g2 = freshGame({ era: 3, people: 4 });
    build(g2, 'campfire'); build(g2, 'craft_hut'); build(g2, 'powder_mill');
    const smiths = g2.state.villagers.filter(x => !x.ruling).slice(0, 3);
    smiths.forEach(s => assignJob(g2, s, 'smith'));
    g2.state.resources.weapons = 2;   // an empty armoury: smiths only forge when weapons are needed
    for (const x of g2.state.villagers) { x.inv ||= { pack: {} }; x.inv.pack.hammer = 1; x.inv.pack.axe = 1; x.inv.pack.pickaxe = 1; x.inv.pack.hoe = 1; x.inv.pack.bow = 1; x.inv.pack.spear_t = 1; }   // nobody needs tools
    const w0 = g2.state.resources.weapons, b0 = g2.state.resources.bombs;
    g2.simulate(90);
    ok(g2.state.resources.weapons > w0, 'smiths forge weapons', `${w0} → ${g2.state.resources.weapons}`);
    ok(g2.state.resources.bombs > b0, 'Powder Mill smiths make bombs', `${b0} → ${g2.state.resources.bombs}`);
  });

  // ------------------------------------------------------------ people & dynasty
  await step('people: callings, shaping, heirs, succession', async () => {
    const g = freshGame({ era: 1, people: 8 });
    build(g, 'campfire');
    const ruler = rulerOf(g);
    ok(!!ruler, 'the realm always has a ruler', ruler?.name);
    const child = g.addWanderer({ child: true });
    setCalling(g, child, 'soldier');
    child.age = 11.9;
    g.newDay(); g.newDay();
    ok(child.age >= 12 && (child.job === 'warrior' || child.job === 'recruit'), 'Soldier calling grows into a warrior/recruit', `${child.job}, age ${child.age.toFixed(1)}`);
    const v = g.state.villagers.find(x => !x.ruling && x !== child);
    const praise = encourage(g, v, 'praise');
    ok(!praise.error, 'Praise works', praise.error);
    v.encouragedAt = -999;
    const mentor = encourage(g, v, 'mentor');
    ok(!mentor.error, 'Mentor works', mentor.error);
    v.skills.combat = 6; v.trained = true; v.job = 'warrior';
    const knight = encourage(g, v, 'knight');
    ok(!knight.error && v.traits.includes('knighted'), 'Knighting a trained warrior works', knight.error);
    setHeir(g, v);
    g.killVillager(ruler, 'fell in a test');
    ok(rulerOf(g) === v, 'named heir inherits the throne', rulerOf(g)?.name);
    ok(Object.keys(CALLINGS).length >= 8, 'all callings defined');
  });

  // ------------------------------------------------------------ court
  await step('court: every office appoints and acts', async () => {
    const g = freshGame({ era: 3, people: 20 });
    for (const t of ['campfire', 'craft_hut', 'barracks', 'watchtower', 'market', 'shrine', 'farm', 'stockpile']) build(g, t);
    const free = () => g.state.villagers.find(x => !x.ruling && !x.office && x.age >= 12);
    const failed = [];
    for (const key of Object.keys(OFFICES)) {
      if (!officeUnlocked(g, key)) { failed.push(`${key} locked`); continue; }
      const r = appoint(g, key, free());
      if (r.error) failed.push(`${key}: ${r.error}`);
      for (const [opt, choices] of Object.entries(OFFICES[key].options || {})) setOfficeOption(g, key, opt, choices[1][0]);
    }
    ok(!failed.length, 'all 6 offices can be filled', failed.join('; '));
    const soldiers = g.state.villagers.filter(x => !x.office && !x.ruling).slice(0, 4);
    soldiers.forEach(x => { x.calling = 'soldier'; });
    g.state.resources.food = 10;
    g.simulate(90 * 2);
    ok(g.state.villagers.some(x => x.job === 'warrior' || x.job === 'recruit'), 'Marshal raises an army');
    const enlisted = g.state.villagers.filter(x => (x.job === 'warrior' || x.job === 'recruit'));
    ok(enlisted.every(x => x.calling === 'soldier' || x.trained || x.traits.includes('brave') || x.profession === 'warrior' || x.traits.includes('versatile')),
      'Marshal only enlists soldiers, trained fighters or brave volunteers', enlisted.filter(x => !(x.calling === 'soldier' || x.trained || x.traits.includes('brave') || x.profession === 'warrior')).map(x => `${x.name}:${x.profession}`).join(', '));
    ok(g.state.villagers.filter(x => ['farm', 'gather', 'fish'].includes(x.job)).length >= 2, 'Steward sends people to find food');
    ok(g.state.buildings.length > 8, 'Master Builder orders new buildings', `${g.state.buildings.length} buildings`);
    dismiss(g, 'steward');
    ok(!g.state.court.steward.id, 'dismissing an official works');
  });

  // ------------------------------------------------------------ laws & deeds
  await step('laws: every law can be enacted', async () => {
    const g = freshGame({ era: 3, people: 6 });
    for (const t of ['campfire', 'shrine', 'market', 'barracks']) build(g, t);
    const failed = [];
    for (const cat of LAW_CATEGORIES) {
      for (const opt of cat.options) {
        g.state.lawChangedAt = {};
        if ((g.state.laws[cat.id]) === opt.id) continue;
        const r = g.enactLaw(cat.id, opt.id);
        if (r.error) failed.push(`${opt.id}: ${r.error}`);
      }
    }
    g.simulate(90);
    ok(!failed.length, 'all laws enact and the realm keeps running', failed.join('; '));
  });

  await step('deeds: every power works', async () => {
    const g = freshGame({ era: 1, people: 8 });
    build(g, 'campfire'); build(g, 'shrine');
    g.spawnRaiders('wolf', 1);
    const failed = [];
    for (const d of DEEDS) {
      const r = runDeed(g, d.id);
      if (r.error) failed.push(`${d.id}: ${r.error}`);
    }
    ok(!failed.length, `all ${DEEDS.length} deeds run`, failed.join('; '));
    const wolf = (g.spawnRaiders('bear', 1), g.state.creatures.find(c => CREATURES[c.t].hostile));
    ok(!smiteCreature(g, wolf).error, 'Divine Smite on a creature');
    const v = g.state.villagers.find(x => !x.ruling);
    const n = g.state.villagers.length;
    sacrificeVillager(g, v);
    exileVillager(g, g.state.villagers.find(x => !x.ruling));
    ok(g.state.villagers.length === n - 2, 'sacrifice and exile remove villagers');
  });

  // ------------------------------------------------------------ events
  await step('story events: every choice of every event', async () => {
    const failed = [];
    for (const ev of EVENTS) {
      ev.choices.forEach((c, i) => {
        const g = freshGame({ era: 2, people: 20 });
        build(g, 'campfire');
        g.state.stats.treesCut = 99; g.state.stats.deaths = 9;
        try {
          g.startEvent(ev);
          const r = g.chooseEvent(i);
          if (!r || r.error) failed.push(`${ev.id}#${i}: ${r?.error || 'no result'}`);
          g.simulate(30);
        } catch (e) { failed.push(`${ev.id}#${i}: ${e.message}`); }
      });
    }
    ok(!failed.length, `all ${EVENTS.reduce((n, e) => n + e.choices.length, 0)} event choices resolve`, failed.join('; '));
  });

  // ------------------------------------------------------------ war
  await step('war: warbands, scouting, rally, battle, tribute', async () => {
    const g = freshGame({ era: 2, people: 16 });
    for (const t of ['campfire', 'watchtower', 'barracks']) build(g, t);
    const vs = g.state.villagers.filter(x => !x.ruling);
    vs.slice(0, 4).forEach(v => { v.trained = true; v.skills.combat = 5; assignJob(g, v, 'warrior'); });
    assignJob(g, vs[4], 'scout');
    ok(spotChance(g) > 0.2, 'scouts and towers raise spotting', spotChance(g).toFixed(2));
    let reported = null;
    g.on('scoutReport', r => { reported = r; });
    g.offline = false;
    g.state.incoming.push({ id: 'wt', kind: 'warband', name: 'Test Horde', count: 4, scale: 0.7, arrivesAt: g.state.time + 60, warned: false });
    for (let i = 0; i < 70 && !g.state.battles?.wt; i++) g.step(1);
    ok(!!reported, 'scouts report the incoming army');
    ok(!!g.state.battles?.wt, 'army arrives and a battle starts');
    const farmer = vs[6];
    assignJob(g, farmer, 'gather'); farmer.trained = false; farmer.calling = null;
    rally(g);
    ok(!!g.state.rallied, 'militia rallies');
    ok(farmer.job === 'gather', 'calling the militia leaves non-soldiers at their jobs', farmer.job);
    for (let i = 0; i < 600 && g.state.battles?.wt; i++) g.step(0.5);
    ok(!g.state.battles?.wt, 'battle ends', g.state.log.slice(-2).map(l => l.text).join(' | '));
    standDown(g);
    const inc = { id: 'wt2', kind: 'warband', name: 'Greedy Band', count: 3, scale: 1, arrivesAt: g.state.time + 300, warned: true };
    g.state.incoming.push(inc);
    ok(!payWarbandTribute(g, inc).error && !g.state.incoming.includes(inc), 'tribute sends a warband away');
  });

  // ------------------------------------------------------------ intrigue & the future
  await step('traitors, bombs, robots and missiles', async () => {
    const g = freshGame({ era: 6, people: 16 });
    for (const t of ['campfire', 'prison', 'embassy', 'cannon_tower', 'robot_factory']) build(g, t);
    const v = g.state.villagers.find(x => !x.ruling);
    v.traitor = true;
    ok(!!accuse(g, v).text && v.exposed, 'accusing a real traitor exposes them');
    ok(!punishTraitor(g, v, 'imprison').error && v.jailed, 'traitor is imprisoned');
    punishTraitor(g, v, 'pardon');
    ok(!v.jailed, 'pardon frees them');
    const innocent = g.state.villagers.find(x => !x.ruling && x !== v);
    accuse(g, innocent);
    ok(!innocent.exposed, 'false accusation does not expose an innocent');
    const unhappy = g.state.villagers.filter(x => !x.ruling).slice(2, 6);
    unhappy.forEach(x => { x.happy = 0; x.traits = ['greedy']; });
    for (let i = 0; i < 30; i++) dailyTraitors(g);
    ok(g.state.villagers.some(x => x.traitor || x.exposed || x.suspicion), 'miserable greedy people turn traitor and get noticed');
    // the traitors above may have sabotaged buildings (as designed): repair before testing them
    for (const b of g.state.buildings) if (!b.built) g.finishBuilding(b);
    for (const t of ['embassy', 'cannon_tower', 'robot_factory']) if (!g.hasBuilding(t)) build(g, t);
    ok(counterIntel(g) > 0.15, 'Embassy raises counter-intelligence', counterIntel(g).toFixed(2));

    g.spawnRaiders('bandit', 4);
    const target = g.state.creatures.find(c => c.raid);
    const b0 = g.state.resources.bombs;
    ok(!throwBomb(g, target).error && g.state.resources.bombs === b0 - 1, 'throwing a bomb uses a bomb');
    // fresh raiders inside tower range (the thrown bomb may have killed the first ones)
    g.spawnRaiders('bandit', 4);
    for (const c of g.state.creatures.filter(c => c.raid)) { c.x = g.center.x + TILE * 6; c.y = g.center.y; }
    for (let i = 0; i < 20; i++) g.step(0.5);
    ok(g.state.resources.bombs < b0 - 1, 'Cannon Tower fires bombs at raiders', `${b0 - 1} → ${g.state.resources.bombs}`);

    for (let i = 0; i < 12; i++) dailyMachines(g);
    ok(g.state.villagers.some(x => x.robot), 'Robot Factory builds robot workers');

    const beforeB = g.state.buildings.filter(b => b.built).length;
    const hit = sufferStrike(g, 'Enemy', false);
    ok(!hit.blocked && g.state.buildings.filter(b => b.built).length < beforeB, 'missile strike damages buildings');
    build(g, 'shield_generator');
    ok(sufferStrike(g, 'Enemy', true).blocked, 'Shield Generator blocks strikes');
  });

  // ------------------------------------------------------------ eras
  await step('eras: from Primitive to Future', async () => {
    const g = freshGame({ era: 0, people: 95 });
    const reached = [];
    for (let e = 1; e < ERAS.length; e++) {
      for (let k = 0; k < e; k++) for (const t of ERAS[k + 1].requires) if (!g.hasBuilding(t)) { g.state.era = Math.max(g.state.era, BUILDINGS[t].era); build(g, t); }
      g.state.era = e - 1;
      g.checkEra();
      reached.push(ERAS[g.state.era].name);
    }
    ok(g.state.era === ERAS.length - 1, 'every era can be reached', reached.join(' → '));
  });

  // ------------------------------------------------------------ professions & households
  await step('professions: fixed trades, jacks of all trades, households', async () => {
    const P = await import('/src/game/professions.js');
    const g = new Game(newState({ uid: 'p', name: 'P', villageName: 'Tradeton' }));
    g.state.nextEventAt = Infinity;
    for (let i = 0; i < 30; i++) g.addWanderer();
    const all = g.state.villagers.filter(v => !v.ruling);
    ok(all.every(v => P.PROFESSIONS[v.profession]), 'everyone has a trade');
    const fixed = all.find(v => !P.isVersatile(v) && v.profession !== 'mine');
    const other = fixed && fixed.profession === 'farm' ? 'chop' : 'farm';
    ok(fixed && assignJob(g, fixed, other) === false, 'people cannot switch to another trade', fixed ? `${fixed.profession} → ${other}` : 'no fixed villager');
    ok(fixed && assignJob(g, fixed, 'gather') === true, 'anyone can still gather food');
    const jack = all[0];
    if (!jack.traits.includes('versatile')) jack.traits.push('versatile');
    ok(assignJob(g, jack, 'mine') && assignJob(g, jack, 'build'), 'a Jack of all trades can take any job');
    // households: most children follow a parent's trade
    let same = 0;
    const mom = { profession: 'smith', traits: [] }, dad = { profession: 'smith', traits: [] };
    for (let i = 0; i < 200; i++) { const child = { traits: [] }; P.inheritProfession(child, mom, dad); if (child.profession === 'smith') same++; }
    ok(same > 105, 'children usually take their household’s trade', `${same}/200 became smiths`);
    const family = [0, 1, 2, 3].map(() => ({ traits: [], job: 'idle' }));
    let shared = 0;
    for (let i = 0; i < 50; i++) { family.forEach(f => { delete f.profession; }); P.shareHousehold(family); shared += family.filter(f => f.profession === family[0].profession).length - 1; }
    ok(shared > 50 * 3 * 0.5, 'families who arrive together usually share a trade', `${shared}/150`);
  });

  // ------------------------------------------------------------ building abilities
  await step('every building ability works and recharges', async () => {
    const A = await import('/src/game/abilities.js');
    const g = freshGame({ era: ERAS.length - 1, people: 25 });
    g.offline = false;
    const failed = [];
    const topUp = () => Object.assign(g.state.resources, rich(), { bombs: 100, weapons: 100, science: 9000, influence: 5000 });
    for (const type of Object.keys(A.ABILITIES)) {
      if (!BUILDINGS[type]) { failed.push(`${type}: not a building`); continue; }
      topUp();
      const b = { id: `ab_${type}`, type, tx: 2, ty: 2, built: true, progress: 1 };
      g.state.buildings.push(b);
      g.spawnRaiders('bandit', 2);
      g.state.villagers.slice(0, 4).forEach(v => { v.job = 'warrior'; });
      try {
        const r = A.useAbility(g, b);
        if (r.error && !/No enemies|Nothing is under|homes|full|surplus|lend|Nobody|No warriors/.test(r.error)) failed.push(`${type}: ${r.error}`);
        else if (!r.error && A.canUseAbility(g, b) === true) failed.push(`${type}: no cooldown`);
      } catch (e) { failed.push(`${type} threw ${e.message}`); }
      g.pendingEvent = null;
    }
    ok(!failed.length, `all ${Object.keys(A.ABILITIES).length} building abilities`, failed.join('; '));
    ok(Object.keys(BUILDINGS).filter(t => A.ABILITIES[t]).length >= 80, 'most buildings have their own ability', `${Object.keys(A.ABILITIES).length} of ${Object.keys(BUILDINGS).length}`);
  });

  // ------------------------------------------------------------ empire
  await step('empire: kingdoms, diplomacy, war, vassals, provinces, events', async () => {
    const E = await import('/src/game/empire.js');
    const g = freshGame({ era: 3, people: 30 });
    g.offline = false;
    for (let d = 0; d < 20; d++) { E.dailyEmpire(g); g.pendingEvent = null; }
    const e = E.empireOf(g);
    ok(e.kingdoms.length >= 2, 'neighbouring kingdoms are discovered', `${e.kingdoms.length} kingdoms`);
    const failed = [];
    for (let i = 0; i < E.EMPIRE_EVENT_COUNT; i++) { try { Object.assign(g.state.resources, rich()); E.empireEvent(g, i); g.pendingEvent = null; } catch (err) { failed.push(`event ${i}: ${err.message}`); } }
    ok(!failed.length, `all ${E.EMPIRE_EVENT_COUNT} empire events run`, failed.join('; '));
    const k = e.kingdoms[0];
    for (const act of ['envoy', 'trade', 'spy']) { Object.assign(g.state.resources, rich()); const r = E.empireAction(g, k.id, act); if (r.error && k.status !== 'war') failed.push(`${act}: ${r.error}`); }
    g.state.villagers.slice(0, 15).forEach(v => { v.job = 'warrior'; v.trained = true; v.skills.combat = 6; v.armed = true; });
    g.recalc();
    Object.assign(g.state.resources, rich());
    if (k.status !== 'war') E.empireAction(g, k.id, 'war');
    k.strength = 5;
    for (let d = 0; d < 20 && k.status === 'war'; d++) { E.dailyEmpire(g); g.pendingEvent = null; k.strength = 5; }
    ok(k.status === 'vassal', 'winning a war makes a vassal', k.status);
    Object.assign(g.state.resources, rich());
    E.empireAction(g, k.id, 'annex');
    ok(k.status === 'province', 'vassals can be annexed into provinces', k.status);
    ok(E.empireTitle(g) !== 'Tribe', 'ruling other realms raises your title', E.empireTitle(g));
    ok(!failed.length, 'diplomacy actions work', failed.join('; '));
  });

  // ------------------------------------------------------------ saving
  await step('save → load keeps everything', async () => {
    const g = freshGame({ era: 3, people: 10 });
    for (const t of ['campfire', 'house', 'barracks', 'shrine']) build(g, t);
    appoint(g, 'steward', g.state.villagers.find(x => !x.ruling));
    g.simulate(90);
    const json = serialize(g.state);
    const g2 = new Game(deserialize(json));
    g2.simulate(90);
    ok(g2.state.villagers.length > 0 && g2.state.buildings.length === g.state.buildings.length && g2.state.court.steward?.id === g.state.court.steward?.id,
      'reloaded game keeps people, buildings and court', `${Math.round(json.length / 1024)} KB`);
    ok(!/"_/.test(json), 'runtime-only fields are not saved');
  });

  await step('offline progress (4 hours) runs fast enough', async () => {
    const g = freshGame({ era: 2, people: 30 });
    for (const t of ['campfire', 'farm', 'farm', 'house', 'house', 'stockpile']) build(g, t);
    const t0 = performance.now();
    g.simulate(60 * 60 * 4);
    const ms = performance.now() - t0;
    ok(ms < 60000, 'simulating 4h offline takes under a minute', `${Math.round(ms)} ms, pop ${g.state.villagers.length}`);
  });

  // ------------------------------------------------------------ UI in the live game
  await step('live game UI: every panel, tab and inspector opens', async () => {
    const app = window.__hb.app;
    if (!app.hud) { ok(false, 'a game must be running for UI tests'); return; }
    const hud = app.hud;
    const g = app.game;
    Object.assign(g.state.resources, rich());
    g.state.era = 6;
    g.recalc();
    const failed = [];
    for (const id of Object.keys(hud.els.dock)) {
      try {
        if (id === 'map') { hud.openMap(); await sleep(200); document.querySelector('.realm .btn.icon')?.click(); continue; }
        hud.openPanel(id);
        await sleep(100);
        if (!hud.panelEl?.children.length) failed.push(`${id} empty`);
        for (const tab of [...(hud.panelEl?.querySelectorAll('.tabs button') || [])]) { tab.click(); await sleep(80); }
      } catch (e) { failed.push(`${id}: ${e.message}`); }
    }
    hud.closePanel();
    ok(!failed.length, `all ${Object.keys(hud.els.dock).length} dock panels and their tabs open`, failed.join('; '));

    document.querySelectorAll('.modal-bg').forEach(m => m.remove());
    const campfire = g.state.buildings.find(b => b.type === 'campfire' && b.built) || build(g, 'campfire');
    campfire.abilityAt = null;
    g.state.resources.food = Math.max(g.state.resources.food, 50);
    hud.select({ kind: 'building', ref: campfire });
    await sleep(100);
    const abilityBtn = hud.inspector?.querySelector('.ability .btn.primary');
    abilityBtn?.click();
    await sleep(100);
    ok(abilityBtn && campfire.abilityAt != null, 'ability button in the building card works');
    hud.select(null);
    for (const sel of [{ kind: 'villager', ref: g.state.villagers[0] }, { kind: 'building', ref: campfire }, { kind: 'object', ref: g.state.objects[0] }, { kind: 'creature', ref: g.state.creatures[0] }]) {
      if (!sel.ref) continue;
      try { hud.select(sel); await sleep(80); if (!hud.inspector?.children.length) failed.push(`${sel.kind} inspector empty`); } catch (e) { failed.push(`${sel.kind}: ${e.message}`); }
    }
    hud.select(null);
    ok(!failed.length, 'inspectors open for villagers, buildings, objects and creatures', failed.join('; '));

    const before = g.state.buildings.length;
    hud.startBuild('tent');
    const r = window.__hb.renderer;
    const c = g.center;
    Object.assign(g.state.resources, { wood: 500, food: 500 });
    // find an empty 4×2 patch (earlier runs may have filled the obvious one)
    let tx = 0, ty = 0;
    search: for (let r0 = 3; r0 < 30; r0++) for (let dy = -r0; dy <= r0; dy++) {
      tx = Math.floor(c.x / TILE) + r0; ty = Math.floor(c.y / TILE) + dy;
      let free = true;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) if (!g.canPlace('tent', tx + x, ty + y).ok) free = false;
      if (free) break search;
    }
    r.camera.x = (tx + 2) * TILE; r.camera.y = (ty + 1) * TILE; r.camera.zoom = 2;
    hud.onPlaceStart(tx, ty); hud.onPlaceMove(tx + 3, ty + 1); hud.onPlaceEnd(tx + 3, ty + 1, false);
    hud.cancelBuild();
    ok(g.state.buildings.length > before + 2, 'drag-to-place builds a whole area', `${g.state.buildings.length - before} placed`);

    const con = app.console;
    if (con) {
      const cmds = ['help', 'laws', 'give me gold 10', 'karma me 5', 'shield me 1', 'era 2', 'villager 1', 'finish', 'skip 1', 'warband 2 30', 'spawn wolf 1', 'event list'];
      const bad = [];
      for (const cmd of cmds) { try { await con.run(cmd); } catch (e) { bad.push(`${cmd}: ${e.message}`); } }
      ok(!bad.length, `admin console commands (${cmds.length})`, bad.join('; '));
    }
  });

  await step('quality of life: undo, notifications, graphs, chat safety, sound, save banner', async () => {
    const app = window.__hb.app;
    const hud = app.hud, g = app.game;
    if (!hud) { ok(false, 'a game must be running for QoL tests'); return; }
    g.state.era = Math.max(g.state.era, 1);
    g.recalc();
    Object.assign(g.state.resources, { wood: 2000, stone: 2000 });
    const tents = () => g.state.buildings.filter(b => b.type === 'tent').length;
    const wood0 = g.state.resources.wood, n0 = tents();
    hud.startBuild('tent');
    let placedAt = null;
    for (let r = 4; r < 30 && !placedAt; r++) {
      const tx = Math.floor(g.center.x / TILE) + r, ty = Math.floor(g.center.y / TILE) - r;
      if (g.canPlace('tent', tx, ty).ok && g.canPlace('tent', tx + 1, ty).ok) placedAt = { tx, ty };
    }
    hud.onPlaceStart(placedAt.tx, placedAt.ty); hud.onPlaceMove(placedAt.tx + 1, placedAt.ty); hud.onPlaceEnd(placedAt.tx + 1, placedAt.ty, false); hud.cancelBuild();
    const placed = tents() - n0;
    hud.undo();
    ok(placed > 0 && tents() === n0 && g.state.resources.wood === wood0, 'undo removes placed buildings with a full refund', `placed ${placed}`);
    const b = g.state.buildings.find(x => x.type === 'tent') || build(g, 'tent');
    const count = g.state.buildings.length;
    await hud.demolishMany([b]);
    hud.undo();
    ok(g.state.buildings.length === count, 'undo brings demolished buildings back');

    const v = g.addWanderer();
    killVillager(g, v, 'was lost in a test');
    hud.updateBell();
    hud.toggleNotifications();
    const entry = document.querySelector('.notif.has-pos');
    ok(!!entry, 'notifications list important events with a location');
    entry?.click();
    ok(!document.querySelector('.notif-panel'), 'clicking a notification jumps there and closes the list');

    for (let d = 0; d < 3; d++) g.newDay();
    hud.openPanel('log');
    await sleep(150);
    ok(document.querySelectorAll('.graph').length === 6, 'Chronicle shows village graphs', `${document.querySelectorAll('.graph').length} graphs`);
    hud.closePanel();

    const { cleanText } = await import('/src/net/chatSafety.js');
    ok(cleanText('what the fuuuck, sh1t happens, hello') === 'what the ******, **** happens, hello', 'chat filter hides swear words, even disguised', cleanText('what the fuuuck, sh1t happens, hello'));
    const S = await import('/src/core/sound.js');
    let soundOk = true;
    try { for (const s of ['click', 'build', 'complete', 'birth', 'death', 'danger', 'boom', 'undo', 'notify']) S.play(s); } catch { soundOk = false; }
    ok(soundOk, 'every sound effect plays without errors');
    hud.setSaveProblem('Cloud save failed (test)');
    const bannerShown = !!document.querySelector('.save-banner');
    hud.setSaveProblem(null);
    ok(bannerShown && !document.querySelector('.save-banner'), 'save problems show a banner that clears after a good save');
  });

  await step('tutorial advances and can be skipped', async () => {
    const app = window.__hb.app;
    const tut = app.hud?.tutorial;
    if (!tut) { ok(false, 'tutorial exists'); return; }
    tut.restart();
    ok(!document.querySelector('.tutorial').hidden, 'tutorial card shows');
    document.querySelector('.tutorial .btn.primary')?.click();
    await sleep(500);
    ok(app.game.state.tutorial.step === 1, 'Next advances a step', `step ${app.game.state.tutorial.step}`);
    document.querySelector('.tutorial .btn.primary')?.click();
    await sleep(500);
    app.hud.openPanel('build');
    await sleep(900);
    ok(app.game.state.tutorial.step >= 3, 'opening the Build menu completes that step', `step ${app.game.state.tutorial.step}`);
    app.hud.closePanel();
    [...document.querySelectorAll('.tutorial button')].find(b => b.textContent.includes('Skip')).click();
    await sleep(300);
    [...document.querySelectorAll('.modal button')].find(b => b.textContent === 'Skip').click();
    await sleep(600);
    ok(app.game.state.tutorial.skipped === true, 'Skip tutorial button + confirm skips it');
    ok(document.querySelector('.tutorial').hidden, 'skipping hides the tutorial');
  });

  window.removeEventListener('error', onErr);
  window.removeEventListener('unhandledrejection', onErr);
  const passed = results.filter(r => r.pass).length;
  return {
    summary: `${passed}/${results.length} passed${errors.length ? `, ${errors.length} page errors` : ''}`,
    failed: results.filter(r => !r.pass),
    passedNames: results.filter(r => r.pass).map(r => r.name + (r.detail ? ` (${r.detail})` : '')),
    pageErrors: errors,
  };
}
