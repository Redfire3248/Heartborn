/*
 * An open game tab keeps running the code it loaded, so after an update it would show old bugs until a full reload.
 * Every few minutes (and whenever you come back to the tab) this asks the site for the newest build; if there is one,
 * a small bar offers to save and reload.
 */
import { checkLatest } from './version.js';

const EVERY = 3 * 60 * 1000;

export function watchForUpdates({ beforeReload = async () => {} } = {}) {
  if (import.meta.env.DEV) return;
  let shown = false, last = 0;
  const check = async () => {
    if (shown || Date.now() - last < 30000) return;
    last = Date.now();
    try {
      const { isLatest, live } = await checkLatest();
      if (!isLatest) show(live);
    } catch { /* offline: try again later */ }
  };
  const show = live => {
    shown = true;
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    const text = document.createElement('span');
    text.textContent = `New version ready (${live.version})`;
    const go = document.createElement('button');
    go.className = 'btn sm primary';
    go.textContent = 'Reload';
    go.onclick = async () => { go.disabled = true; go.textContent = 'Saving...'; try { await beforeReload(); } catch { /* reload anyway */ } location.reload(); };
    const later = document.createElement('button');
    later.className = 'btn sm ghost';
    later.textContent = 'Later';
    later.onclick = () => { bar.remove(); shown = false; last = Date.now() + EVERY * 3; };
    bar.append(text, go, later);
    document.body.append(bar);
  };
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 20000);
}
