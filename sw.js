/* Radar Route service worker — caches the app shell and the map library.
   Live weather data is always fetched from the network (never cached). */
const VERSION = 'rr-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './tracker.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isShell = url.origin === self.location.origin;
  const isLib = LIB_HOSTS.includes(url.host);
  if (!isShell && !isLib) return; // weather data, tiles, routing: straight to network
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fetchAndCache = fetch(e.request).then((res) => {
        if (res && res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      // shell: network-first so updates land; libraries: cache-first
      return isLib ? (hit || fetchAndCache) : fetchAndCache.then((r) => r || hit);
    })
  );
});
