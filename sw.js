// Keeps the game on the device after the first visit, so it starts quickly and can be driven with no connection.
const V = 'vqh-2026-11-22a';
const CORE = ['./', 'index.html', 'js/game.js', 'js/boot.js', 'js/sim/vehicle.js', 'js/world/terrain.js', 'assets/bay-dem.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  // the 3D engine comes from a CDN at a fixed version and never changes, and neither does the survey of the bay: saved copy first
  if (u.hostname === 'cdn.jsdelivr.net' || (u.origin === location.origin && u.pathname.includes('/assets/'))) {
    e.respondWith(caches.open(V).then(async c => (await c.match(r)) || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))); return; }
  if (u.origin !== location.origin) return;
  // the game's own pages and code: the network first, so a new version shows at once; the saved copy when there is no connection
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true })));
});
