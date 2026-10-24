/* PJ ENTERPRISES service worker: opens the app without signal, and picks up new versions automatically.
   Online: the newest index.html is fetched every time (so GitHub updates reach the phone).
   Weak or no signal: after 3.5 seconds (or at once when offline) the saved copy is used instead. */
const CACHE = 'pj-shell-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('pj-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.hostname.endsWith('script.google.com') || u.hostname.endsWith('googleusercontent.com')) return;  // data API: never cached
  if (u.origin === location.origin) { e.respondWith(networkFirst(e, r)); return; }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(cacheFirst(r));
});

async function networkFirst(e, r) {
  const cache = await caches.open(CACHE);
  const key = r.mode === 'navigate' ? 'index.html' : r;
  const net = fetch(r, { cache: 'no-store' }).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));
  const cached = await cache.match(key);
  const quick = await Promise.race([net.catch(() => null), new Promise(ok => setTimeout(() => ok(null), 3500))]);
  if (quick) return quick;
  if (cached) return cached;
  return net.catch(() => new Response('Offline, and this page was not saved yet. Open the app once with internet.', { status: 503 }));
}
async function cacheFirst(r) {
  const cache = await caches.open(CACHE), hit = await cache.match(r);
  if (hit) return hit;
  try { const res = await fetch(r); if (res.ok) cache.put(r, res.clone()); return res; } catch (err) { return new Response('', { status: 504 }); }
}
