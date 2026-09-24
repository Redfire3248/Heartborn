// Heartborn service worker: makes the game installable and opens it instantly after the first visit.
// Files are served from the cache at once and refreshed in the background.
// The page itself is fetched fresh when online, so updates arrive right away.
const CACHE = 'heartborn-v4';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Firebase, Google fonts etc. go straight to the network

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('.webmanifest');
  if (isPage) {
    // network first, cached copy when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  // sprites, scripts, styles, icons: answer instantly from the cache and refresh it in the background
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    if (hit) { fresh.catch(() => {}); return hit; }
    return fresh;   // a failed download reports a real error so the game retries it
  }));
});

// Tapping a notice brings the game to the front (or opens it if it is not running).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if (c.url.startsWith(self.location.origin)) return c.focus();
    return self.clients.openWindow(target);
  })());
});

// A push sent by a server (see src/core/notify.js). Nothing sends these yet; the handler is ready for when one does.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Heartborn', body: e.data ? e.data.text() : '' }; }
  const n = d.notification || d.data || d;   // Heartborn sends data-only, so the browser never draws a second copy
  e.waitUntil(self.registration.showNotification(n.title || 'Heartborn', {
    body: n.body || '',
    tag: n.tag || 'heartborn',
    icon: n.icon || 'icons/app-192.png',
    badge: 'icons/app-192.png',
    data: { url: n.url || '/' },
  }));
});
