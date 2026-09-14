import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit, runTransaction } from 'firebase/firestore';
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
export const isSolo = () => world === 'solo';

// Civilizations live in 3 save slots per account and can be taken into any world.
export const SLOT_COUNT = 3;
let slot = 1;
export const setSlot = n => { slot = n; };
export const currentSlot = () => slot;

const LOCAL_KEY = (uid, n = slot) => `hearthborn_slot_${uid}_${n}`;
const saveDoc = (uid, n = slot) => doc(db, 'saves', uid, 'slots', `s${n}`);
const LEGACY_LOCAL = uid => `hearthborn_save_${uid}`;
const legacyDoc = uid => doc(db, 'saves', uid);

async function readDoc(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() && snap.data().data ? snap.data() : null;
  } catch { return null; }
}

/** Summaries of all slots (the first slot falls back to a save from before slots existed). */
export async function listSlots(uid) {
  const out = [];
  for (let n = 1; n <= SLOT_COUNT; n++) {
    let d = await readDoc(saveDoc(uid, n));
    if (!d && n === 1) d = await readDoc(legacyDoc(uid));
    let local = null;
    try { local = localStorage.getItem(LOCAL_KEY(uid, n)) || (n === 1 ? localStorage.getItem(LEGACY_LOCAL(uid)) : null); } catch { /* ignore */ }
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
  await deleteDoc(saveDoc(uid, n)).catch(() => {});
  if (n === 1) await deleteDoc(legacyDoc(uid)).catch(() => {});
  try { localStorage.removeItem(LOCAL_KEY(uid, n)); if (n === 1) localStorage.removeItem(LEGACY_LOCAL(uid)); } catch { /* ignore */ }
}
const playersCol = () => (world === 'realm' ? collection(db, 'players') : collection(db, 'worldPlayers', world, 'players'));
const playerDoc = uid => (world === 'realm' ? doc(db, 'players', uid) : doc(db, 'worldPlayers', world, 'players', uid));

/** Load the newest of the cloud save and the local backup. */
export async function loadSave(uid) {
  let cloud = null;
  try {
    const d = (await readDoc(saveDoc(uid))) || (slot === 1 ? await readDoc(legacyDoc(uid)) : null);
    if (d) cloud = deserialize(d.data);
  } catch (e) {
    console.warn('Cloud load failed, using local backup', e);
  }
  let local = null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY(uid)) || (slot === 1 ? localStorage.getItem(LEGACY_LOCAL(uid)) : null);
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
    villageName: state.owner.villageName, pop: state.villagers.length, era: state.era,
    day: Math.floor(state.time / 90) + 1, dynasty: state.ruler?.dynasty || '', lastWorld: world,
  };
  await setDoc(saveDoc(uid), { data: json, updatedAt: state.updatedAt, size: json.length, summary });
}

export function clearLocalSave(uid) {
  try { localStorage.removeItem(LOCAL_KEY(uid)); if (slot === 1) localStorage.removeItem(LEGACY_LOCAL(uid)); } catch { /* ignore */ }
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
  if (world === 'solo') return;   // solo villages are invisible to everyone else
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

/** Reserve a unique username (case-insensitive) for this account. */
export async function claimUsername(uid, name) {
  name = name.trim();
  if (!USERNAME_RE.test(name)) throw new Error('3–16 letters, numbers or _');
  const key = name.toLowerCase();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'usernames', key);
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().uid !== uid) throw new Error('That username is taken');
    tx.set(ref, { uid, name });
    tx.set(doc(db, 'private', uid), { username: name }, { merge: true });
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
