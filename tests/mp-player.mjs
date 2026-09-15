// One simulated player for the multiplayer test. Run by tests/multiplayer.mjs against the local emulator.
// Usage: node tests/mp-player.mjs A|B
globalThis.HB_EMULATOR = true;
globalThis.HB_TIME_SCALE = 0.01;   // a 10-minute march takes 6 seconds
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const role = process.argv[2];
const OTHER = role === 'A' ? 'PlayerB' : 'PlayerA';

const { auth, createAccount, signInWithEmail } = await import('../src/net/firebase.js');
const { claimUsername, writeSave, writeProfile, writePrivate } = await import('../src/net/save.js');
const { Multiplayer } = await import('../src/net/multiplayer.js');
const { Game } = await import('../src/game/game.js');
const { newState } = await import('../src/game/state.js');
const { ref, get } = await import('firebase/database');
const { rtdb } = await import('../src/net/firebase.js');

const results = [];
const say = (ok, msg) => { results.push({ ok, msg }); console.log(`${role} ${ok ? 'PASS' : 'FAIL'} ${msg}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(label, fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) { say(true, label); return v; } } catch { /* retry */ }
    await sleep(200);
  }
  say(false, `${label} (timed out after ${ms / 1000}s)`);
  return null;
}
const logHas = (g, re) => g.state.log.some(l => re.test(l.text));

// ---------------------------------------------------------------- account + village
const email = `player${role.toLowerCase()}@hearthborn.test`;
let user;
try { user = await createAccount(email, 'test-password-123'); } catch { user = await signInWithEmail(email, 'test-password-123'); }
const name = `Player${role}`;
await claimUsername(user.uid, name);
await writePrivate(user);

const state = newState({ uid: user.uid, name, villageName: role === 'A' ? 'Ironhold' : 'Greenvale' });
state.shieldUntil = 0;
state.nextEventAt = Infinity;
Object.assign(state.resources, { food: 300, wood: 200, stone: 200, iron: 50, coal: 20, gold: 100, weapons: 20 });
const game = new Game(state);
game.recalc();
const build = type => { const p = game.findBuildSpot(type); const r = game.placeBuilding(type, p.tx, p.ty); game.finishBuilding(r.building); };
state.era = 2;
game.recalc();
for (const t of ['campfire', 'stockpile', 'market', 'barracks', 'hut', 'hut']) build(t);
for (let i = 0; i < 9; i++) game.addWanderer();
for (const v of state.villagers) v.age = 25;
const warriors = role === 'A' ? 5 : 3;
state.villagers.slice(0, warriors).forEach(v => { v.job = 'warrior'; v.trained = true; v.skills.combat = role === 'A' ? 6 : 3; });
game.recalc();
Object.assign(state.resources, { food: 300, wood: 200, stone: 200, iron: 50, coal: 20, gold: 100, weapons: 20 });
await writeSave(user.uid, state);
await writeProfile(user, game);

// the village keeps living while the test runs (3x speed so battles finish)
game.speed = 3;
setInterval(() => game.update(0.1), 100);

let mp = new Multiplayer(user, game);
mp.start();
const otherUid = () => mp.players.find(p => p.name === OTHER)?.uid;
const chatHas = text => mp.chat.some(m => m.text === text);

// ---------------------------------------------------------------- scenario
if (role === 'A') {
  await waitFor('sees PlayerB online in the realm', () => mp.players.some(p => p.name === OTHER && p.online));
  const B = otherUid();
  await mp.sendChat('hello from A');
  await waitFor('receives chat from B', () => chatHas('hello from B'));

  // trade with escrow: give 50 wood, want 20 stone
  const wood0 = state.resources.wood, stone0 = state.resources.stone;
  await mp.sendOffer({ uid: B, name: OTHER, villageName: 'Greenvale' }, 'trade', { wood: 50 }, { stone: 20 });
  say(state.resources.wood === wood0 - 50, `trade: 50 wood held in escrow (${wood0} → ${state.resources.wood})`);
  await waitFor('trade: receives 20 stone when B accepts', () => state.resources.stone >= stone0 + 20);

  // alliance proposed by B
  await waitFor('receives alliance proposal from B', () => mp.inbox.some(o => o.type === 'alliance'));
  await mp.respond(mp.inbox.find(o => o.type === 'alliance'), true);
  await waitFor('is allied with B', () => mp.allies.has(B));
  say(mp.raidCheck({ uid: B }) !== true, 'cannot march on an ally');
  await mp.breakAlliance(B);
  await waitFor('alliance broken', () => !mp.allies.has(B));

  // raid 1: B online → live battle in B's world
  await mp.sendChat('A:raid1');
  await sleep(1500);
  const armed = mp.availableWarriors().length;
  const r1 = await mp.launchAttack(B);
  say(!!r1, `raid 1 launched with ${armed} armed warriors`);
  say(state.villagers.filter(v => v.away).length === armed, 'warriors leave the village while marching');
  await waitFor('raid 1 result reaches the attacker', () => logHas(game, /Victory at|Defeat at/), 150000);
  await waitFor('surviving warriors march home (travel time)', () => !state.villagers.some(v => v.away), 40000);
  await waitFor('attack record cleaned up in the database', async () => !(await get(ref(rtdb, `w/realm/attacksSent/${user.uid}`))).exists(), 20000);

  // raid 2: B goes offline → decided by strength
  await mp.sendChat('A:raid2');
  await waitFor('sees B go offline', () => mp.players.some(p => p.name === OTHER && !p.online), 20000);
  state.lastRaidAt = 0;
  await mp.launchAttack(B);
  await waitFor('raid 2 (offline defender) resolved by strength', () => state.log.filter(l => /Victory at|Defeat at/.test(l.text)).length >= 2, 60000);

  // raid 3: B pays tribute while the army is still marching
  await waitFor('B back online', () => mp.players.some(p => p.name === OTHER && p.online), 30000);
  await waitFor('B shield cleared for the next test', () => mp.chat.some(m => m.text === 'B:ready3'), 30000);
  state.lastRaidAt = 0;
  // raids 1 and 2 cost lives: train fresh warriors for the last march
  state.resources.weapons += 10;
  state.villagers.filter(v => v.age >= 12 && v.job !== 'warrior' && !v.ruling).slice(0, 4).forEach(v => { v.job = 'warrior'; v.trained = true; v.hp = 100; });
  await waitFor('new warriors are armed', () => mp.availableWarriors().length > 0, 10000);
  const gold0 = state.resources.gold;
  await mp.sendChat('A:raid3');
  await mp.launchAttack(B);
  await waitFor('raid 3: B paid tribute, army returns with it', () => logHas(game, /paid tribute/), 60000);
  await waitFor('tribute gold delivered when the army gets home', () => state.resources.gold > gold0, 40000);

  await mp.sendChat('A:done');
} else {
  await waitFor('sees PlayerA online in the realm', () => mp.players.some(p => p.name === OTHER && p.online));
  const A = otherUid();
  await mp.sendChat('hello from B');
  await waitFor('receives chat from A', () => chatHas('hello from A'));

  // accept A's trade once the caravan arrives
  const offer = await waitFor('trade caravan from A arrives', () => mp.inbox.find(o => o.type === 'trade'));
  if (offer) {
    // leave room in storage: the village keeps chopping wood in the background and would hit its cap
    state.resources.wood = 100;
    const wood0 = state.resources.wood, stone0 = state.resources.stone;
    await mp.respond(offer, true);
    say(state.resources.wood >= wood0 + 50 && state.resources.stone <= stone0 - 20, `trade accepted: +50 wood, −20 stone (wood ${wood0}→${state.resources.wood}, stone ${stone0}→${state.resources.stone})`);
  }

  await mp.sendOffer({ uid: A, name: OTHER, villageName: 'Ironhold' }, 'alliance');
  await waitFor('alliance accepted by A', () => mp.allies.has(A));

  // raid 1: fight it live
  await waitFor('A announces raid 1', () => chatHas('A:raid1'));
  await waitFor('scouts / dust cloud warn of the incoming army', () => logHas(game, /Scouts report|Dust on the horizon/), 40000);
  await waitFor('army arrives: live battle starts in our village', () => Object.keys(state.battles || {}).length > 0, 40000);
  await waitFor('invaders appear in the world', () => state.creatures.some(c => c.attackId));
  await waitFor('live battle ends and result is recorded', () => logHas(game, /army is defeated|crushed|plundered us/), 150000);
  if (!logHas(game, /army is defeated|crushed|plundered us/)) console.log('B debug', JSON.stringify({ battles: state.battles, invaders: state.creatures.filter(c => c.attackId).map(c => [c.t, Math.round(c.hp), c.fleeing]), pop: state.villagers.length, log: state.log.slice(-8).map(l => l.text) }));

  // raid 2: go offline, then come back and read the report
  await waitFor('A announces raid 2', () => chatHas('A:raid2'));
  mp.stop();
  await waitFor('while offline, the attack is resolved in the database', async () => {
    const all = (await get(ref(rtdb, `w/realm/attacks/${user.uid}`))).val() || {};
    return Object.values(all).some(a => a.status === 'resolved');
  }, 60000);
  const logsBefore = state.log.length;
  mp = new Multiplayer(user, game);
  mp.start();
  await waitFor('on return, the raid report is applied to our village', () => state.log.slice(logsBefore).some(l => /While you were away|repelled/.test(l.text)), 20000);
  state.shieldUntil = 0;
  await writeProfile(user, game);
  await mp.sendChat('B:ready3');

  // raid 3: pay tribute before the army arrives
  await waitFor('A announces raid 3', () => chatHas('A:raid3'));
  const incoming = await waitFor('incoming army is visible while marching', () => Object.values(mp.incoming).find(a => a.status === 'marching'), 20000);
  if (incoming) {
    const gold0 = state.resources.gold;
    await mp.payTribute(incoming);
    say(state.resources.gold < gold0, `paid tribute (${gold0} → ${state.resources.gold} gold)`);
  }
  await waitFor('A finished', () => chatHas('A:done'), 90000);
}

const failed = results.filter(r => !r.ok).length;
console.log(`${role} DONE ${results.length - failed}/${results.length} passed`);
mp.stop();
await sleep(500);
process.exit(failed ? 1 : 0);
