import { ref, push, get, query, limitToLast, remove } from 'firebase/database';
import { rtdb, auth } from './firebase.js';

/*
 * Chat safety: a word filter, muting players (saved on this device) and reporting messages to the admin.
 */

// common swear words and slurs; matched as whole words, ignoring repeated letters and simple symbol tricks
const BLOCKED = ['fuck', 'fucking', 'fucker', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'whore', 'slut', 'retard', 'nigger', 'nigga', 'faggot', 'fag', 'kys', 'motherfucker'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const normalize = w => w.toLowerCase().replace(/[013457@$!]/g, c => LEET[c]).replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1');

/** Replace blocked words with stars. */
export function cleanText(text) {
  // words only (letters, digits, @ and $ used as letters): punctuation around them is kept
  return String(text).replace(/[A-Za-z0-9@$]+/g, word => {
    const n = normalize(word);
    return n && BLOCKED.some(b => n === b || n === `${b}s` || n.replace(/(.)\1+/g, '$1') === b.replace(/(.)\1+/g, '$1')) ? '*'.repeat(Math.min(word.length, 8)) : word;
  });
}

const MUTE_KEY = 'hb_muted';
export function mutedPlayers() {
  try { return new Set(JSON.parse(localStorage.getItem(MUTE_KEY) || '[]')); } catch { return new Set(); }
}
export function setMuted(uid, muted) {
  const set = mutedPlayers();
  if (muted) set.add(uid); else set.delete(uid);
  try { localStorage.setItem(MUTE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
  return set;
}

export async function reportMessage(msg, reason = 'Inappropriate message') {
  if (!auth.currentUser) throw new Error('Sign in to report');
  await push(ref(rtdb, 'reports'), {
    from: auth.currentUser.uid, target: msg.uid, targetName: msg.name || '', text: String(msg.text || '').slice(0, 200),
    reason: String(reason).slice(0, 300), ts: Date.now(),
  });
}

export async function recentReports(n = 20) {
  const snap = await get(query(ref(rtdb, 'reports'), limitToLast(n)));
  return Object.entries(snap.val() || {}).map(([id, r]) => ({ id, ...r })).reverse();
}

export async function clearReports() { await remove(ref(rtdb, 'reports')); }
