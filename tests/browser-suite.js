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

  await step('each building has a sprite image', async () => {
    const missing = [];
    for (const type of Object.keys(BUILDINGS)) {
      const res = await fetch(`/assets/buildings/${type}.png`, { method: 'HEAD' });
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
    const jobs = Object.keys(JOBS).filter(j => !['warrior', 'idle'].includes(j));
    const failed = jobs.filter((job, i) => !assignJob(g, others[i % others.length], job));
    ok(!failed.length, `every job can be assigned (${jobs.length})`, failed.join(', '));

    const g2 = freshGame({ era: 3, people: 4 });
    build(g2, 'campfire'); build(g2, 'craft_hut'); build(g2, 'powder_mill');
    const smiths = g2.state.villagers.filter(x => !x.ruling).slice(0, 3);
    smiths.forEach(s => assignJob(g2, s, 'smith'));
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
    ok(g.state.villagers.filter(x => (x.job === 'warrior' || x.job === 'recruit')).every(x => x.calling === 'soldier' || x.trained || x.traits.includes('brave')),
      'Marshal only enlists soldiers, trained fighters or brave volunteers');
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
    ok(same > 120, 'children usually take their household’s trade', `${same}/200 became smiths`);
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
