/*
 * Install-as-app support. Chrome/Edge/Android fire `beforeinstallprompt`; we keep it and
 * show our own "Install app" buttons. iPhone Safari has no prompt, so we explain the steps.
 */

let deferred = null;
const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(); };

export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
export const canInstall = () => !isInstalled() && (!!deferred || isIOS());

export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
  // the service worker only runs on the real site (dev server keeps files fresh)
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

/** The browser can send its install offer a moment after the page loads: wait up to `ms` for it. */
export function waitForInstallOffer(ms = 2500) {
  if (deferred || isInstalled()) return Promise.resolve(!!deferred);
  return new Promise(res => {
    const done = () => { listeners.delete(done); clearTimeout(t); res(!!deferred); };
    const t = setTimeout(done, ms);
    listeners.add(done);
  });
}

/** Returns 'installed' | 'dismissed' | 'ios' (show instructions) | 'unavailable'. */
export async function installApp() {
  if (deferred) {
    const prompt = deferred;
    deferred = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    notify();
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  }
  if (isIOS() && !isInstalled()) return 'ios';
  return 'unavailable';
}
