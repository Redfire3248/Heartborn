import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit, runTransaction } from 'firebase/firestore';
import { themeOf, THEMES } from '../game/themeNames.js';
import { db } from './firebase.js';
import { serialize, deserialize } from '../game/state.js';
import { CREATURES } from '../data/objects.js';
import { villageSnapshot } from '../game/visit.js';
import { counterIntel } from '../game/intrigue.js';
import { BUILDINGS } from '../data/buildings.js';

const MAX_DOC_BYTES = 950_000;

// Which world is being played: 'realm' (the public world), 'solo', or a private world id.
let world = 'realm';
export const setWorld = w => { world = w || 'realm'; };
export const currentWorld = () => world;
export const isSolo = () => world === 'solo' || world.startsWith('solo_');

// Every world has its own save (like Minecraft): saves/{uid}/worlds/{world}. Old save slots are only read to bring an old village along once.
export const SLOT_COUNT = 3;
const LOCAL_KEY = (uid, w = world) => `hearthborn_world_${uid}_${w}`;
const saveDoc = (uid, w = world) => doc(db, 'saves', uid, 'worlds', w);
const slotDoc = (uid, n) => doc(db, 'saves', uid, 'slots', `s${n}`);
const SLOT_LOCAL = (uid, n) => `hearthborn_slot_${uid}_${n}`;
const LEGACY_LOCAL = uid => `hearthborn_save_${uid}`;
const legacyDoc = uid => doc(db, 'saves', uid);

async function readDoc(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() && snap.data().data ? snap.data() : null;
  } catch { return null; }
}

/** Your worlds with a save in them, newest first: { wid, name, seed, theme, kind, level, day, updatedAt }. */
export async function listWorldSaves(uid) {
  let docs = [];
  try { docs = (await getDocs(collection(db, 'saves', uid, 'worlds'))).docs.map(d => ({ wid: d.id, ...d.data() })); } catch { docs = []; }
  const out = docs.map(d => ({ wid: d.wid, updatedAt: d.updatedAt, ...(d.summary || {}) }));
  // worlds only saved on this device (offline) still show up
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k?.match(new RegExp(`^hearthborn_world_${uid}_(.+)$`));
      if (!m || out.some(o => o.wid === m[1])) continue;
      const st = deserialize(localStorage.getItem(k));
      out.push({ wid: m[1], name: st.worldName || st.owner.villageName, seed: st.seed, kind: m[1].startsWith('solo') ? 'solo' : 'server', updatedAt: st.updatedAt, level: st.rpg?.level || 1, day: Math.floor(st.time / 90) + 1 });
    }
  } catch { /* ignore */ }
  for (const o of out) { o.kind ||= o.wid.startsWith('solo') ? 'solo' : 'server'; o.theme ||= o.seed != null ? themeOf(o.seed) : 'meadow'; }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function deleteWorldSave(uid, wid) {
  await deleteDoc(saveDoc(uid, wid)).catch(() => {});
  try { localStorage.removeItem(LOCAL_KEY(uid, wid)); } catch { /* ignore */ }
}

/** A village from the old save slots (before worlds had their own saves), to carry into a first world. */
export async function oldVillage(uid) {
  for (let n = 1; n <= SLOT_COUNT; n++) {
    const d = (await readDoc(slotDoc(uid, n))) || (n === 1 ? await readDoc(legacyDoc(uid)) : null);
    let raw = d?.data || null;
    if (!raw) try { raw = localStorage.getItem(SLOT_LOCAL(uid, n)) || (n === 1 ? localStorage.getItem(LEGACY_LOCAL(uid)) : null); } catch { /* ignore */ }
    if (raw) try { return deserialize(raw); } catch { /* broken: try the next */ }
  }
  return null;
}

/** Summaries of all slots (the first slot falls back to a save from before slots existed). */
export async function listSlots(uid) {
  const out = [];
  for (let n = 1; n <= SLOT_COUNT; n++) {
    let d = await readDoc(slotDoc(uid, n));
    if (!d && n === 1) d = await readDoc(legacyDoc(uid));
    let local = null;
    try { local = localStorage.getItem(SLOT_LOCAL(uid, n)) || (n === 1 ? localStorage.getItem(LEGACY_LOCAL(uid)) : null); } catch { /* ignore */ }
    if (d?.summary) out.push({ slot: n, ...d.summary, updatedAt: d.updatedAt });
    else if (d || local) {
      try {
        const st = deserialize(d?.data || local);
        out.push({ slot: n, villageName: st.owner.villageName, pop: st.villagers.length, era: st.era, day: Math.floor(st.time / 90) + 1, updatedAt: st.updatedAt });
      } catch { out.push({ slot: n, empty: true }); }
    } else out.push({ slot: n, empty: true });
  }
  return out;
}

export async function deleteSlot(uid, n) {
  await deleteDoc(slotDoc(uid, n)).catch(() => {});
  if (n === 1) await deleteDoc(legacyDoc(uid)).catch(() => {});
  try { localStorage.removeItem(SLOT_LOCAL(uid, n)); if (n === 1) localStorage.removeItem(LEGACY_LOCAL(uid)); } catch { /* ignore */ }
}
const playersCol = () => (world === 'realm' ? collection(db, 'players') : collection(db, 'worldPlayers', world, 'players'));
const playerDoc = uid => (world === 'realm' ? doc(db, 'players', uid) : doc(db, 'worldPlayers', world, 'players', uid));

/** Load the newest of the cloud save and the local backup. */
export async function loadSave(uid) {
  let cloud = null;
  try {
    const d = await readDoc(saveDoc(uid));
    if (d) cloud = deserialize(d.data);
  } catch (e) {
    console.warn('Cloud load failed, using local backup', e);
  }
  let local = null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY(uid));
    if (raw) local = deserialize(raw);
  } catch { /* ignore */ }
  if (cloud && local) return (local.updatedAt || 0) > (cloud.updatedAt || 0) ? local : cloud;
  return cloud || local;
}

export async function writeSave(uid, state) {
  state.updatedAt = Date.now();
  const json = serialize(state);
  try { localStorage.setItem(LOCAL_KEY(uid), json); } catch { /* storage full */ }
  if (json.length > MAX_DOC_BYTES) throw new Error(`Save is too large for the cloud (${Math.round(json.length / 1024)} KB)`);
  const summary = {
    name: state.worldName || state.owner.villageName, seed: state.seed, theme: themeOf(state.seed), kind: world.startsWith('solo') ? 'solo' : 'server',
    hero: state.owner.name, level: state.rpg?.level || 1, day: Math.floor(state.time / 90) + 1, villageName: state.owner.villageName,
  };
  await setDoc(saveDoc(uid), { data: json, updatedAt: state.updatedAt, size: json.length, summary });
}

export function clearLocalSave(uid) {
  try { localStorage.removeItem(LOCAL_KEY(uid)); } catch { /* ignore */ }
}

/** Public profile used by multiplayer, leaderboards and raids. No email here. */
export function profileFor(user, g) {
  const s = g.state;
  const r = s.resources;
  const warriors = s.villagers.filter(v => v.job === 'warrior');
  return {
    uid: user.uid,
    name: s.owner.name || 'Chieftain',
    villageName: s.owner.villageName,
    pop: s.villagers.length,
    karma: Math.round(s.karma),
    era: s.era,
    day: g.day + 1,
    wealth: Math.floor(r.gold + r.gems * 10 + r.iron * 2),
    res: { food: Math.floor(r.food), wood: Math.floor(r.wood), stone: Math.floor(r.stone), gold: Math.floor(r.gold) },
    defense: Math.round(g.defense),
    warriors: warriors.length,
    warriorPower: Math.round(warriors.reduce((sum, v) => sum + 5 + v.skills.combat, 0) * (1 + g.combatBonus)),
    hasBarracks: g.hasBuilding('barracks'),
    hasMarket: g.hasBuilding('market'),
    shieldUntil: s.shieldUntil || 0,
    lastActive: Date.now(),
    monstersNearby: s.creatures.filter(c => CREATURES[c.t]?.hostile).length,
    seed: s.seed,
    counterIntel: Math.round(counterIntel(g) * 100) / 100,
    missileShield: g.builtBuildings().some(b => BUILDINGS[b.type].missileShield),
    leaks: Math.round(s.leaks || 0),
    officials: Object.values(s.court || {}).filter(c => c?.id).length,
    snapshot: villageSnapshot(g),
  };
}

export async function writeProfile(user, g) {
  if (world === 'solo' || world.startsWith('solo_')) return;   // solo villages are invisible to everyone else
  await setDoc(playerDoc(user.uid), profileFor(user, g), { merge: true });
}

export async function writePrivate(user) {
  await setDoc(doc(db, 'private', user.uid), { email: user.email || '', lastLogin: Date.now() }, { merge: true });
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

export async function getUsername(uid) {
  try {
    const snap = await getDoc(doc(db, 'private', uid));
    return snap.exists() ? snap.data().username || null : null;
  } catch { return null; }
}

/**
 * The identity of a name: case, underscores and lookalike characters don't count,
 * so "RedFire", "red_fire" and "R3dF1re" are all the same name.
 */
const LOOKALIKE = { 0: 'o', 1: 'i', l: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };
export const usernameKey = name => name.trim().toLowerCase().replace(/_/g, '').replace(/[0134578l]/g, c => LOOKALIKE[c]);

/** Reserve a unique username for this account (see usernameKey), releasing the account's previous name. */
export async function claimUsername(uid, name) {
  name = name.trim();
  if (!USERNAME_RE.test(name)) throw new Error('3–16 letters, numbers or _');
  const key = usernameKey(name);
  if (key.length < 3) throw new Error('Use at least 3 letters or numbers');
  const legacyKey = name.toLowerCase();   // names claimed before lookalike checks were stored this way
  await runTransaction(db, async tx => {
    const ref = doc(db, 'usernames', key);
    const legacyRef = doc(db, 'usernames', legacyKey);
    const privRef = doc(db, 'private', uid);
    const [snap, legacy, priv] = await Promise.all([tx.get(ref), tx.get(legacyRef), tx.get(privRef)]);
    for (const s of [snap, legacy]) if (s.exists() && s.data().uid !== uid) throw new Error('That username is taken (or one that looks just like it)');
    // free the name this account used before, so nobody can hoard names
    const old = priv.exists() ? priv.data().username : null;
    const oldRefs = old ? [...new Set([usernameKey(old), old.toLowerCase()])].filter(k => k !== key && k !== legacyKey).map(k => doc(db, 'usernames', k)) : [];
    const oldSnaps = await Promise.all(oldRefs.map(r => tx.get(r)));   // every read before any write
    oldSnaps.forEach((o, i) => { if (o.exists() && o.data().uid === uid) tx.delete(oldRefs[i]); });
    tx.set(ref, { uid, name });
    tx.set(privRef, { username: name }, { merge: true });
  });
  return name;
}

export async function getBan(uid) {
  try {
    const snap = await getDoc(doc(db, 'bans', uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function leaderboard(field, dir = 'desc', n = 20) {
  const snap = await getDocs(query(playersCol(), orderBy(field, dir), limit(n)));
  return snap.docs.map(d => d.data());
}

export async function getProfile(uid) {
  const snap = await getDoc(playerDoc(uid));
  return snap.exists() ? snap.data() : null;
}
