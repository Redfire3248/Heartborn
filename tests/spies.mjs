// Spy missions + save slots against the emulator: node tests/spies.mjs
globalThis.HB_EMULATOR = true;
globalThis.HB_TIME_SCALE = 0.01;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { createAccount, signInWithEmail } = await import('../src/net/firebase.js');
const save = await import('../src/net/save.js');
const { Multiplayer } = await import('../src/net/multiplayer.js');
const { Game } = await import('../src/game/game.js');
const { newState } = await import('../src/game/state.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };

async function player(tag) {
  const email = `spy${tag}@hearthborn.test`;
  let user; try { user = await createAccount(email, 'pw-123456'); } catch { user = await signInWithEmail(email, 'pw-123456'); }
  return user;
}
// both players in one process would share auth; so run defender profile writes first, then attacker
const def = await player('def');
await save.claimUsername(def.uid, 'Defender1');
const dState = newState({ uid: def.uid, name: 'Defender1', villageName: 'Targetton' });
Object.assign(dState.resources, { gold: 400 });
const dGame = new Game(dState);
save.setSlot(2);
await save.writeSave(def.uid, dState);
await save.writeProfile(def, dGame);
const slots = await save.listSlots(def.uid);
check(slots[1] && !slots[1].empty && slots[1].villageName === 'Targetton', `save slot 2 holds the village (${JSON.stringify(slots.map(s => s.empty ? 'empty' : s.villageName))})`);
check(slots[0].empty && slots[2].empty, 'other slots stay empty');

const atk = await player('atk');   // switches the signed-in account
await save.claimUsername(atk.uid, 'Attacker1');
const aState = newState({ uid: atk.uid, name: 'Attacker1', villageName: 'Shadowmoor' });
const aGame = new Game(aState);
aState.era = 2; aGame.recalc();
Object.assign(aState.resources, { wood: 200, stone: 200, gold: 100 });
const p = aGame.findBuildSpot('spy_den'); const r = aGame.placeBuilding('spy_den', p.tx, p.ty); aGame.finishBuilding(r.building);
const spy = aState.villagers.find(v => !v.ruling);
spy.job = 'spy';
for (let i = 0; i < 40 && spy.skills.stealth < 3; i++) aGame.simulate(10);
check(spy.skills.stealth >= 3, `villager trains into a spy at the Spy Den (stealth ${spy.skills.stealth.toFixed(1)})`);
const mp = new Multiplayer(atk, aGame, 'realm');
mp.start();
await sleep(1500);
await mp.launchMission(def.uid, 'steal');
check(spy.away?.missionId, 'spy leaves the village on the mission');
check(mp.missions().length === 1 || !!(await new Promise(r => setTimeout(() => r(mp.missions().length), 800))), 'mission is listed for following');
const end = Date.now() + 30000;
while (Date.now() < end && !aState.log.some(l => /Mission to|caught spying|failed the mission/.test(l.text))) { await sleep(300); }
const result = aState.log.find(l => /Mission to|caught spying|failed the mission/.test(l.text));
const dead = aState.log.find(l => /caught spying/.test(l.text));
check(!!result, `mission resolves: "${result?.text}"`);
mp.stop();
console.log(fails ? `\nSPY TEST FAILED (${fails})` : '\nSPY TEST PASSED');
await sleep(300);
process.exit(fails ? 1 : 0);
