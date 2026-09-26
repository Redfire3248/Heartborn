/*
 * Everyone plays the newest version.
 *
 * An open tab keeps running the code it loaded, and a phone can keep an old copy for days, so people ended up
 * playing on builds with bugs that were long fixed - and saving over their worlds from them. Now:
 *   - before you can enter a world, the game asks the site for the newest build; if this one is older, a screen
 *     with a single Reload button stands in front of everything and the game does not start;
 *   - while you play it asks again every minute and whenever you come back to the tab; when a new build is out the
 *     game pauses behind the same screen. Reload saves first. There is no "Later".
 * Offline, you can still play (there is nothing to compare with). The reload asks for a fresh copy of the page with
 * the new build's id on the address, so a cached old page cannot come back; if the site is still handing out the old
 * page after two tries (a CDN catching up), the third try lets you in rather than locking you out.
 */
import { checkLatest } from './version.js';
import { noticeUpdate } from './notify.js';

const EVERY = 60 * 1000;
const TRIES_KEY = 'hb-update-tries';

let blocker = null;
let saveFirst = async () => {};

const tries = () => { try { return Number(sessionStorage.getItem(TRIES_KEY)) || 0; } catch { return 0; } };
const setTries = n => { try { sessionStorage.setItem(TRIES_KEY, String(n)); } catch { /* private window */ } };

/** Resolves true when this build may be played: it is the newest, or we cannot tell (offline), or reloading keeps failing. */
async function isPlayable() {
  if (import.meta.env.DEV) return true;
  try {
    const { isLatest, live } = await Promise.race([checkLatest(), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 5000))]);
    if (isLatest) { setTries(0); return true; }
    if (tries() >= 2) return true;   // the site keeps serving the old page: do not lock anyone out over it
    showBlocker(live);
    return false;
  } catch { return true; }
}

/** Shown by itself when a newer build is out; exported so it can be previewed. */
export function showBlocker(live) {
  if (blocker) return;
  noticeUpdate(live.version);
  const reload = document.createElement('button');
  reload.className = 'btn primary update-reload';
  reload.textContent = 'Reload';
  reload.onclick = async () => {
    reload.disabled = true;
    reload.textContent = 'Saving...';
    try { await saveFirst(); } catch { /* reload anyway */ }
    setTries(tries() + 1);
    // a new address the cache has never seen, so the fresh page comes back and not a stored copy of the old one
    const url = new URL(location.href);
    url.searchParams.set('v', live.commit || String(Date.now()));
    location.replace(url.toString());
  };
  const box = document.createElement('div');
  box.className = 'update-wall-box';
  const title = document.createElement('h2');
  title.textContent = 'Update required';
  const text = document.createElement('p');
  text.textContent = `A new version of Heartborn is out (${live.version}). Reload to keep playing: your world is saved first.`;
  box.append(title, text, reload);
  blocker = document.createElement('div');
  blocker.className = 'update-wall';
  blocker.append(box);
  document.body.append(blocker);
  window.__hbPaused = true;   // the game loop stops the world while this is up
}

/** Call before entering a world. Resolves only when this build may be played; otherwise the Reload screen is up and it never resolves. */
export async function requireLatest() {
  if (await isPlayable()) return;
  await new Promise(() => {});   // hold here: the only way on is Reload
}

/** While playing: check every minute and on returning to the tab; a new build pauses the game behind the Reload screen. */
export function watchForUpdates({ beforeReload = async () => {} } = {}) {
  saveFirst = beforeReload;
  if (import.meta.env.DEV) return;
  let last = 0;
  const check = async () => {
    if (blocker || Date.now() - last < 20000) return;
    last = Date.now();
    await isPlayable();
  };
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 15000);
}
