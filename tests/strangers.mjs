// Strangers (people from other lands walking in yours) and in-person spy missions against the emulator: node tests/strangers.mjs
globalThis.HB_EMULATOR = true;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { createAccount, signInWithEmail, rtdb } = await import('../src/net/firebase.js');
const { ref, set, get, remove, onValue } = await import('firebase/database');
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const allowed = p => p.then(() => true, () => false);
const tag = Date.now().toString(36).slice(-5);
async function player(t) {
  const email = `str${t}${tag}@hearthborn.test`;
  try { return await createAccount(email, 'pw-123456'); } catch { return await signInWithEmail(email, 'pw-123456'); }
}
const W = 'w/realm/strangers';

const host = await player('host');
const spy = await player('spy');   // signed in as the spy's owner now
const me = { from: spy.uid, x: 100, y: 200, sex: 'm', name: 'Traveller', job: 'gather', ts: Date.now() };
check(await allowed(set(ref(rtdb, `${W}/${host.uid}/${spy.uid}_m1`), me)), 'a stranger can walk in someone else\'s land');
check(await allowed(set(ref(rtdb, `${W}/${host.uid}/${spy.uid}_m1`), { ...me, x: 140 })), 'and keep moving');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/fake`), { ...me, from: host.uid }))), 'nobody can walk in someone else\'s name');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/bad`), { from: spy.uid, x: 'left', y: 1, ts: 1 }))), 'positions must be numbers');
check(!(await allowed(get(ref(rtdb, `${W}/${host.uid}`)))), 'only the land\'s owner sees who walks there');

const other = await player('other');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${spy.uid}_m1`), { ...me, from: other.uid }))), 'a third player cannot move someone else\'s stranger');

await signInWithEmail(`strhost${tag}@hearthborn.test`, 'pw-123456');
const seen = await new Promise(res => { const off = onValue(ref(rtdb, `${W}/${host.uid}`), s => { off(); res(s.val() || {}); }); });
check(seen[`${spy.uid}_m1`]?.x === 140, 'the owner sees the stranger live');
check(await allowed(remove(ref(rtdb, `${W}/${host.uid}/${spy.uid}_m1`))), 'the owner can turn a stranger away');

// in-person spy mission: the spy acts on the spot and the defender gets the exact target
await signInWithEmail(`strspy${tag}@hearthborn.test`, 'pw-123456');
const { Multiplayer } = await import('../src/net/multiplayer.js');
const { Game } = await import('../src/game/game.js');
const { newState } = await import('../src/game/state.js');
const { setWorld } = await import('../src/net/save.js');
setWorld?.('realm');
const g = new Game(newState({ uid: spy.uid, name: 'Spy', villageName: 'Spyholm' }));
const mp = new Multiplayer({ uid: spy.uid }, g, 'realm');
const id = 'mInPerson' + tag;
const arrived = Date.now() - 1000;
await set(ref(rtdb, `w/realm/missions/${host.uid}/${id}`), { id, kind: 'spy', mission: 'infiltrate', from: spy.uid, fromName: 'Spy', fromVillage: 'Spyholm', to: host.uid, toVillage: 'Hostholm', stealth: 10, agent: 'Ada', launchedAt: arrived - 5000, arrivesAt: arrived, status: 'travelling' });
await set(ref(rtdb, `w/realm/missionsSent/${spy.uid}/${id}`), { id, to: host.uid, toVillage: 'Hostholm', mission: 'infiltrate', kind: 'spy', agent: 'Ada', launchedAt: arrived - 5000, arrivesAt: arrived });
mp.sentMissions = { [id]: { id, to: host.uid, mission: 'infiltrate', arrivesAt: arrived } };
await mp.resolveMissions();
check((await get(ref(rtdb, `w/realm/missions/${host.uid}/${id}`))).val()?.status === 'travelling', 'a spy sent in person waits for you instead of acting on their own');
const done = await mp.actInPerson({ id, to: host.uid }, 'sabotage', { type: 'stockpile', tx: 40, ty: 41 }, 0).catch(e => ({ error: e.message }));
check(done?.error === 'Sabotage needs 1 bomb' || done?.status === 'resolved', 'sabotage needs a bomb', JSON.stringify(done).slice(0, 80));
g.state.resources.bombs = 3;
const done2 = await mp.actInPerson({ id, to: host.uid }, 'sabotage', { type: 'stockpile', tx: 40, ty: 41 }, 0);
check(done2?.status === 'resolved' && done2.mission === 'sabotage' && done2.result.target?.tx === 40 && done2.result.inPerson, 'acting in person settles the mission with the exact target');
mp.stop?.();

console.log(fails ? `\nSTRANGERS TEST FAILED (${fails})` : '\nSTRANGERS TEST PASSED');
process.exit(fails ? 1 : 0);
