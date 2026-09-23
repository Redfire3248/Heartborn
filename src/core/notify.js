/*
 * Notices on your phone or your desktop, through the installed app.
 *
 * The browser only lets a page ask for this from a real tap, so Settings has a button for it. Once you have said
 * yes, Heartborn can reach you when the game is not the window you are looking at: a friend inviting you to their
 * world, somebody joining yours, a trade waiting, or a new version being out. While you are actually playing it
 * stays quiet — everything already shows on screen.
 *
 * These are notices the game raises itself; they arrive whenever the app is running, including in the background
 * on a phone that has it installed. Notices sent while the app is fully closed need a push server; when one is set
 * up (see PUSH below) this file hands it the key, and until then everything here still works.
 */

const OFF_KEY = 'hb-notices-off';
const supported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

export const noticesSupported = supported;
export const noticesAllowed = () => supported() && Notification.permission === 'granted';
export const noticesBlocked = () => supported() && Notification.permission === 'denied';
export const noticesOff = () => { try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; } };
export function setNoticesOff(off) { try { off ? localStorage.setItem(OFF_KEY, '1') : localStorage.removeItem(OFF_KEY); } catch { /* private window */ } }

/** Asks the browser. Must be called from a tap or click, or the browser refuses. Returns the new state. */
export async function askToNotify() {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'granted') { setNoticesOff(false); return 'granted'; }
  if (Notification.permission === 'denied') return 'denied';
  let res = 'default';
  try { res = await Notification.requestPermission(); } catch { return 'denied'; }
  if (res === 'granted') setNoticesOff(false);
  return res;
}

/**
 * Raises one notice. `whenAway` (the default) means it only shows when you are not looking at the game, so it
 * never talks over something you can already see. Repeats with the same `tag` replace each other rather than piling up.
 */
export async function sendNotice({ title, body = '', tag = 'heartborn', url = null, whenAway = true, silent = false } = {}) {
  if (!title || !noticesAllowed() || noticesOff()) return false;
  if (whenAway && document.visibilityState === 'visible' && document.hasFocus?.() !== false) return false;
  const opts = {
    body, tag, renotify: true, silent,
    icon: `${import.meta.env.BASE_URL}icons/app-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/app-192.png`,
    data: { url: url || (import.meta.env.BASE_URL || '/') },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) { await reg.showNotification(title, opts); return true; }   // works with the app in the background
    new Notification(title, opts);
    return true;
  } catch { return false; }
}

// ------------------------------------------------------------------ the things worth telling you about

/** A friend has asked you into their world. */
export const noticeInvite = inv => sendNotice({
  title: `${inv.fromName || 'A friend'} invited you`,
  body: `Join ${inv.name || 'their world'} in Heartborn`,
  tag: `invite-${inv.wid}`,
});

/** Someone walked into a world you are in. */
export const noticeJoined = name => sendNotice({ title: 'Heartborn', body: `${name || 'Someone'} joined your world`, tag: 'joined' });

/** Somebody said something while you were away. */
export const noticeChat = (name, text) => sendNotice({ title: name || 'Someone', body: text, tag: 'chat' });

/** A trade is waiting for an answer. */
export const noticeTrade = from => sendNotice({ title: 'Trade offer', body: `${from || 'A player'} wants to trade with you`, tag: 'trade' });

/** A new build is live. This one shows even while you are playing, because it is about the page you are on. */
export const noticeUpdate = version => sendNotice({ title: 'Heartborn updated', body: `Version ${version} is out — reload to play it`, tag: 'update', whenAway: false, silent: true });

/*
 * PUSH, for notices while the app is fully closed.
 * ------------------------------------------------
 * Everything above needs the app to be running (in the background counts). To reach a phone with the app closed,
 * Heartborn needs a Web Push key pair and something to send with it:
 *   1. Firebase console -> Project settings -> Cloud Messaging -> Web Push certificates -> Generate key pair.
 *   2. Put the public key in src/net/config.js as `vapidKey`.
 *   3. Add a Cloud Function that sends to the tokens saved under `pushTokens/<uid>`.
 * With those in place this registers the device and keeps its token fresh; without them it does nothing and the
 * notices above carry on working.
 */
export async function registerForPush(uid) {
  if (!uid || !noticesAllowed()) return null;
  let cfg = null;
  try { cfg = (await import('../net/config.js')).firebaseConfig; } catch { return null; }
  if (!cfg?.vapidKey) return null;   // no key set up yet: nothing to register with
  try {
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('../net/firebase.js');
    const reg = await navigator.serviceWorker.getRegistration();
    const token = await getToken(getMessaging(app), { vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
    if (!token) return null;
    const { getDatabase, ref, set } = await import('firebase/database');
    await set(ref(getDatabase(app), `pushTokens/${uid}/${token.slice(0, 40)}`), { token, at: Date.now() });
    return token;
  } catch { return null; }
}
