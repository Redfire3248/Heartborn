import { ref, get, set, update, remove, onValue, push, serverTimestamp, onDisconnect } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { rtdb, db } from './firebase.js';

/*
 * Profiles, friends and worlds (all in the Realtime Database).
 *
 * profiles/{uid}                 public profile: name, joinedAt, stats
 * friends/{uid}/{other}          'out' (I asked) | 'in' (they asked) | 'friend'
 * worlds/{wid}                   { name, owner, ownerName, code, createdAt }
 * worldMembers/{wid}/{uid}       true
 * worldInvites/{uid}/{wid}       { name, from, fromName, ts }
 * worldCodes/{CODE}              wid
 */

export const PUBLIC_WORLD = 'realm';
export const SOLO_WORLD = 'solo';

export function worldLabel(w) {
  if (!w || w === PUBLIC_WORLD) return 'World';
  if (w === SOLO_WORLD) return 'Solo World';
  return typeof w === 'string' ? 'Private World' : w.name;
}

// ------------------------------------------------------------------ profiles

export async function ensureProfile(uid, name) {
  const r = ref(rtdb, `profiles/${uid}`);
  const snap = await get(r);
  if (!snap.exists()) await set(r, { name, joinedAt: Date.now(), stats: {} });
  else if (snap.val().name !== name) await update(r, { name });
}

export async function updateProfileStats(uid, stats) {
  await update(ref(rtdb, `profiles/${uid}/stats`), stats).catch(() => {});
}

export async function getPublicProfile(uid) {
  const snap = await get(ref(rtdb, `profiles/${uid}`));
  return snap.exists() ? { uid, ...snap.val() } : null;
}

export async function findUserByName(name) {
  const snap = await getDoc(doc(db, 'usernames', name.trim().toLowerCase()));
  return snap.exists() ? snap.data() : null;   // { uid, name }
}

// ------------------------------------------------------------------ friends

export function watchFriends(uid, cb) {
  return onValue(ref(rtdb, `friends/${uid}`), snap => cb(snap.val() || {}));
}

export async function getFriends(uid) {
  return (await get(ref(rtdb, `friends/${uid}`))).val() || {};
}

export async function sendFriendRequest(me, meName, otherUid) {
  if (otherUid === me) throw new Error("That's you!");
  const mine = (await get(ref(rtdb, `friends/${me}/${otherUid}`))).val();
  if (mine === 'friend') throw new Error('Already friends');
  if (mine === 'in') return acceptFriend(me, otherUid);
  await update(ref(rtdb), { [`friends/${me}/${otherUid}`]: 'out', [`friends/${otherUid}/${me}`]: 'in' });
}

export async function acceptFriend(me, otherUid) {
  await update(ref(rtdb), { [`friends/${me}/${otherUid}`]: 'friend', [`friends/${otherUid}/${me}`]: 'friend' });
}

export async function removeFriend(me, otherUid) {
  await update(ref(rtdb), { [`friends/${me}/${otherUid}`]: null, [`friends/${otherUid}/${me}`]: null });
}

// ------------------------------------------------------------------ worlds

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export async function createWorld(me, meName, name) {
  name = name.trim().slice(0, 28);
  if (name.length < 3) throw new Error('World name needs at least 3 letters');
  const wid = push(ref(rtdb, 'worlds')).key;
  const code = newCode();
  await set(ref(rtdb, `worlds/${wid}`), { name, owner: me, ownerName: meName, code, createdAt: Date.now(), status: 'lobby' });
  await update(ref(rtdb), {
    [`worldMembers/${wid}/${me}`]: true,
    [`worldCodes/${code}`]: wid,
  });
  return { wid, name, code, owner: me, status: 'lobby' };
}

export async function getWorld(wid) {
  const snap = await get(ref(rtdb, `worlds/${wid}`));
  return snap.exists() ? { wid, ...snap.val() } : null;
}

export function watchInvites(uid, cb) {
  return onValue(ref(rtdb, `worldInvites/${uid}`), snap => cb(Object.entries(snap.val() || {}).map(([wid, i]) => ({ wid, ...i }))));
}

export async function inviteToWorld(world, me, meName, friendUid) {
  await set(ref(rtdb, `worldInvites/${friendUid}/${world.wid}`), { name: world.name, from: me, fromName: meName, ts: Date.now() });
}

export async function joinWorld(me, wid, name) {
  await update(ref(rtdb), {
    [`worldMembers/${wid}/${me}`]: true,
    [`worldInvites/${me}/${wid}`]: null,
  });
}

export async function joinWorldByCode(me, code) {
  const wid = (await get(ref(rtdb, `worldCodes/${code.trim().toUpperCase()}`))).val();
  if (!wid) throw new Error('No world with that code');
  const world = await getWorld(wid);
  if (!world) throw new Error('That world no longer exists');
  await joinWorld(me, wid, world.name);
  return world;
}

export async function declineInvite(me, wid) {
  await remove(ref(rtdb, `worldInvites/${me}/${wid}`));
}

/** Leaving a world: the host closes it for good (worlds aren't kept); anyone else just leaves. */
export async function leaveOrCloseWorld(me, world) {
  if (!world?.wid || world.wid === SOLO_WORLD || world.wid === PUBLIC_WORLD) return;
  if (world.owner === me) {
    await update(ref(rtdb), { [`worldCodes/${world.code}`]: null, [`worldMembers/${world.wid}/${me}`]: null });
    await remove(ref(rtdb, `worlds/${world.wid}`));
  } else {
    await leaveWorld(me, world.wid);
  }
}

export async function leaveWorld(me, wid) {
  await update(ref(rtdb), { [`worldMembers/${wid}/${me}`]: null });
}

export function watchWorld(wid, cb) {
  return onValue(ref(rtdb, `worlds/${wid}`), snap => cb(snap.exists() ? { wid, ...snap.val() } : null));
}

export function watchMembers(wid, cb) {
  return onValue(ref(rtdb, `worldMembers/${wid}`), snap => cb(Object.keys(snap.val() || {})));
}

/** Who is sitting in the lobby right now (removed automatically on disconnect). */
export function enterLobby(wid, uid, name) {
  const r = ref(rtdb, `lobby/${wid}/${uid}`);
  onDisconnect(r).remove();
  set(r, { name, ts: Date.now() });
  return () => remove(r).catch(() => {});
}

export function watchLobby(wid, cb) {
  return onValue(ref(rtdb, `lobby/${wid}`), snap => cb(snap.val() || {}));
}

export async function startWorld(wid) {
  await update(ref(rtdb, `worlds/${wid}`), { status: 'started', startedAt: Date.now() });
}

export async function kickMember(wid, uid) {
  await update(ref(rtdb), { [`worldMembers/${wid}/${uid}`]: null });
}

export async function isMember(wid, uid) {
  try { return (await get(ref(rtdb, `worldMembers/${wid}/${uid}`))).exists(); } catch { return false; }
}

export async function worldMemberCount(wid) {
  return Object.keys((await get(ref(rtdb, `worldMembers/${wid}`))).val() || {}).length;
}

export const now = serverTimestamp;
