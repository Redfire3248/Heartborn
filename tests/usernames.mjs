// Unique usernames against the emulator: node tests/usernames.mjs
globalThis.HB_EMULATOR = true;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { createAccount, signInWithEmail } = await import('../src/net/firebase.js');
const { claimUsername, usernameKey } = await import('../src/net/save.js');
const { findUserByName } = await import('../src/net/social.js');
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const tag = Date.now().toString(36).slice(-5);
async function player(t) {
  const email = `name${t}${tag}@hearthborn.test`;
  try { return await createAccount(email, 'pw-123456'); } catch { return await signInWithEmail(email, 'pw-123456'); }
}
const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
const base = `Red${tag}`;   // fresh name each run

check(usernameKey('RedFire') === usernameKey('red_fire') && usernameKey('R3dF1re') === usernameKey('redfire'), 'lookalike names share one key');

const a = await player('a');
await claimUsername(a.uid, base);
check(true, `A claims ${base}`);
check(await claimUsername(a.uid, base.toUpperCase()).then(() => true, () => false), 'A can re-claim their own name in another case');

const b = await player('b');   // now signed in as B
check(await rejects(() => claimUsername(b.uid, base)), 'B cannot take the same name');
check(await rejects(() => claimUsername(b.uid, base.toLowerCase())), 'B cannot take it in other letter case');
check(await rejects(() => claimUsername(b.uid, base.replace('e', '3'))), 'B cannot take a lookalike (e -> 3)');
check(await rejects(() => claimUsername(b.uid, `${base.slice(0, 3)}_${base.slice(3)}`)), 'B cannot take it with an underscore');
check(await claimUsername(b.uid, `Blue${tag}`).then(() => true, () => false), 'B can take a different name');
check((await findUserByName(base.toLowerCase().replace('e', '3')))?.uid === a.uid, 'searching a lookalike finds the real owner');

// A renames: the old name is released and B can have it
await player('a');
await claimUsername(a.uid, `Ash${tag}`);
await player('b');
check(await claimUsername(b.uid, base).then(() => true, () => false), 'after A renames, their old name is free for B');
await player('a');
check(await rejects(() => claimUsername(a.uid, base)), 'and A cannot take it back from B');

console.log(fails ? `\nUSERNAME TEST FAILED (${fails})` : '\nUSERNAME TEST PASSED');
process.exit(fails ? 1 : 0);
