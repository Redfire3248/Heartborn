import { collection, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, push, set, remove, get } from 'firebase/database';
import { db, rtdb, auth } from './firebase.js';

// Everything here is also enforced server-side by the security rules (admins/ list in the database).

export async function fetchPlayers() {
  const [players, privates, bans, presence] = await Promise.all([
    getDocs(collection(db, 'players')),
    getDocs(collection(db, 'private')),
    getDocs(collection(db, 'bans')),
    get(ref(rtdb, 'w/realm/presence')),
  ]);
  const priv = Object.fromEntries(privates.docs.map(d => [d.id, d.data()]));
  const banned = Object.fromEntries(bans.docs.map(d => [d.id, d.data()]));
  const online = presence.val() || {};
  return players.docs.map(d => ({
    ...d.data(),
    uid: d.id,
    email: priv[d.id]?.email || '',
    lastLogin: priv[d.id]?.lastLogin || 0,
    ban: banned[d.id] || null,
    online: !!online[d.id]?.online,
  }));
}

export async function banPlayer(uid, reason) {
  await setDoc(doc(db, 'bans', uid), { reason: reason || 'No reason given', by: auth.currentUser?.email || '', ts: Date.now() });
  await sendCommand(uid, { type: 'message', text: `You have been banned: ${reason || 'No reason given'}` });
}

export const unbanPlayer = uid => deleteDoc(doc(db, 'bans', uid));

export const sendCommand = (uid, cmd) => push(ref(rtdb, `adminCommands/${uid}`), { ...cmd, ts: Date.now() });

export const broadcast = text => set(ref(rtdb, 'announcements'), { text, ts: Date.now(), by: 'Admin' });

export const triggerGlobalEvent = id => set(ref(rtdb, 'globalEvent'), { id, ts: Date.now() });

export const deleteChatMessage = id => remove(ref(rtdb, `w/realm/chat/${id}`));
export const clearChat = () => remove(ref(rtdb, 'w/realm/chat'));

export async function getSaveInfo(uid) {
  const snap = await getDoc(doc(db, 'saves', uid));
  if (!snap.exists()) return null;
  const { data, updatedAt, size } = snap.data();
  return { updatedAt, size, state: JSON.parse(data) };
}

export async function resetPlayer(uid) {
  await deleteDoc(doc(db, 'saves', uid));
  await sendCommand(uid, { type: 'reset' });
}
