import { ref, push, get, query, limitToLast, remove } from 'firebase/database';
import { rtdb, auth } from './firebase.js';

/*
 * Error reports: crashes on players' devices are sent to errors/ in the Realtime Database so the
 * admin can read them (admin command: errors). A few per session at most, and never while offline.
 */

const MAX_PER_SESSION = 8;
let sent = 0;
const seen = new Set();
let buildInfo = {};

export function setupErrorReporting(build) {
  buildInfo = build || {};
  if (typeof window === 'undefined') return;
  window.addEventListener('error', e => reportError(e.error || e.message, 'crash'));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, 'promise'));
}

export function reportError(err, where = 'error') {
  try {
    if (sent >= MAX_PER_SESSION || !auth.currentUser || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    const message = String(err?.message || err || 'unknown').slice(0, 300);
    if (/ResizeObserver|Script error\.?$|permission-denied|Missing or insufficient permissions/i.test(message) && where !== 'save') return;
    const key = `${where}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    push(ref(rtdb, 'errors'), {
      uid: auth.currentUser.uid,
      where, message,
      stack: String(err?.stack || '').split('\n').slice(0, 6).join('\n').slice(0, 900),
      version: buildInfo.version || 'dev', commit: buildInfo.commit || '',
      agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : '',
      url: typeof location !== 'undefined' ? location.pathname : '',
      ts: Date.now(),
    }).catch(() => {});
  } catch { /* reporting must never break the game */ }
}

/** Admin: the newest reports. */
export async function recentErrors(n = 20) {
  const snap = await get(query(ref(rtdb, 'errors'), limitToLast(n)));
  return Object.entries(snap.val() || {}).map(([id, e]) => ({ id, ...e })).reverse();
}

export async function clearErrors() {
  await remove(ref(rtdb, 'errors'));
}
