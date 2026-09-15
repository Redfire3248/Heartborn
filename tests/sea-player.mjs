// One captain for the Open Sea test. Run by tests/sea.mjs against the local emulator.
// Usage: node tests/sea-player.mjs A|B
globalThis.HB_EMULATOR = true;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.performance ??= { now: () => Date.now() };

const role = process.argv[2];
const { createAccount, signInWithEmail, rtdb } = await import('../src/net/firebase.js');
const { claimUsername, writeProfile } = await import('../src/net/save.js');
const { Multiplayer } = await import('../src/net/multiplayer.js');
const { Game } = await import('../src/game/game.js');
const { newState } = await import('../src/game/state.js');
const S = await import('../src/game/sailing.js');
const { TILE } = await import('../src/core/constants.js');
const { ref, get } = await import('firebase/database');

let fails = 0;
const say = (ok, msg) => { if (!ok) fails++; console.log(`${role} ${ok ? 'PASS' : 'FAIL'} ${msg}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(label, fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) { say(true, label); return v; } } catch {} await sleep(150); }
  say(false, `${label} (timed out after ${ms / 1000}s)`);
  return null;
}

const email = `captain${role.toLowerCase()}@hearthborn.test`;
let user;
try { user = await createAccount(email, 'test-password-123'); } catch { user = await signInWithEmail(email, 'test-password-123'); }
const name = `Captain${role}`;
await claimUsername(user.uid, name);
const state = newState({ uid: user.uid, name, villageName: role === 'A' ? 'Saltmarsh' : 'Tidewater' });
state.nextEventAt = Infinity;
state.era = 3;
Object.assign(state.resources, { gold: 100, bombs: 20 });
const game = new Game(state);
await writeProfile(user, game);
const mp = new Multiplayer(user, game);
mp.start();
game.seaNet = { publish: (s, boat) => mp.publishShip(s, boat), shot: b => mp.sendShot(b), sunk: (by, boat) => mp.reportSunk(by, boat), leave: () => mp.leaveSea() };

// a galleon at sea (the shipyard itself is tested in the browser suite)
state.fleet = [{ id: `ship${role}`, type: 'galleon', hull: S.BOATS.galleon.hull, name: `${role}'s Galleon` }];
game.sail = { boatId: `ship${role}`, type: 'galleon', x: 0, y: 0, angle: 0, speed: 0, reload: 0, shots: [], pirates: [], loot: [], nextPirateAt: 9e9, time: 0, sunk: 0, gold: 0, wake: [], others: new Map() };
S.enterOpenSea(game, 0);
mp.enterSea();
const s = game.sail;
s.nextPirateAt = 9e9;   // no pirates in this test
// the two captains meet in the middle of the ocean
s.x = (48 + (role === 'A' ? -3 : 3)) * TILE; s.y = 48 * TILE; s.angle = role === 'A' ? 0 : Math.PI;
const tick = setInterval(() => { if (game.sail) S.updateSailing(game, 0.05, {}); }, 50);

const otherUid = async () => [...(s.others?.keys() || [])][0];
const other = await waitFor('sees the other captain\'s ship on the Open Sea', otherUid, 20000);
say(!!(await get(ref(rtdb, `w/realm/sea/${user.uid}`))).val(), 'our ship is published for others to see');

if (role === 'A') {
  // aim at B and fire until they sink
  const gold0 = state.resources.gold;
  await waitFor('fires at the other ship until it sinks', async () => {
    const o = s.others.get(other);
    if (o) { s.angle = Math.atan2(o.y - s.y, o.x - s.x); s.reload = 0; S.fire(game); }
    return state.log.some(l => /You sank CaptainB/.test(l.text));
  }, 25000);
  say(state.resources.gold > gold0, `sinking a player pays gold (${gold0} → ${state.resources.gold})`);
} else {
  // a weak hull: one hit will sink us
  state.fleet[0].hull = 20;
  await waitFor('a bomb from the other captain hits our ship', () => s.lastHitBy === other || !game.sail, 25000);
  await waitFor('our ship sinks and is lost', () => !game.sail && !state.fleet.length, 10000);
  await waitFor('our ship is removed from the Open Sea', async () => !(await get(ref(rtdb, `w/realm/sea/${user.uid}`))).val(), 10000);
}
await sleep(1500);
clearInterval(tick);
if (game.sail) S.returnToPort(game);
mp.stop();
console.log(`${role} DONE ${fails ? 'with failures' : 'ok'}`);
process.exit(fails ? 1 : 0);
