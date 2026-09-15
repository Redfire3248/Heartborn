// Visit permission rules against the emulator: node tests/visits.mjs
globalThis.HB_EMULATOR = true;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { createAccount, signInWithEmail, rtdb } = await import('../src/net/firebase.js');
const { ref, set, get, remove } = await import('firebase/database');
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const allowed = p => p.then(() => true, () => false);
const tag = Date.now().toString(36).slice(-5);
async function player(t) {
  const email = `visit${t}${tag}@hearthborn.test`;
  try { return await createAccount(email, 'pw-123456'); } catch { return await signInWithEmail(email, 'pw-123456'); }
}
const W = 'w/realm/visits';

const host = await player('host');
const guest = await player('guest');   // signed in as guest now
const ask = { status: 'ask', name: 'Guest', villageName: 'Guestholm', ts: Date.now() };
check(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}`), ask)), 'guest can ask to visit');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}/status`), 'yes'))), 'guest cannot let themselves in');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}`), { ...ask, status: 'yes' }))), 'guest cannot write an allowed visit');
check(!(await allowed(get(ref(rtdb, `${W}/${host.uid}`)))), 'guest cannot read the host’s other visitors');

const intruder = await player('intruder');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}`), { ...ask, name: 'Fake' }))), 'nobody can ask in someone else’s name');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}/status`), 'yes'))), 'a third player cannot allow the visit');

await signInWithEmail(`visithost${tag}@hearthborn.test`, 'pw-123456');
const asks = (await get(ref(rtdb, `${W}/${host.uid}`))).val() || {};
check(asks[guest.uid]?.status === 'ask', 'host sees the request');
check(await allowed(set(ref(rtdb, `${W}/${host.uid}/${guest.uid}/status`), 'yes')), 'host can allow it');
check(!(await allowed(set(ref(rtdb, `${W}/${host.uid}/${intruder.uid}/status`), 'yes'))), 'host cannot invent a request that was never made');

await signInWithEmail(`visitguest${tag}@hearthborn.test`, 'pw-123456');
check((await get(ref(rtdb, `${W}/${host.uid}/${guest.uid}`))).val()?.status === 'yes', 'guest sees the answer');
check(await allowed(remove(ref(rtdb, `${W}/${host.uid}/${guest.uid}`))), 'guest can clear the request afterwards');

console.log(fails ? `\nVISIT TEST FAILED (${fails})` : '\nVISIT TEST PASSED');
process.exit(fails ? 1 : 0);
