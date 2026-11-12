/* BTC Marine Conservation Hub — service worker (offline app shell) */
const CACHE_VERSION = "btc-hub-v1";
const ASSETS = [
  "./", "./index.html", "./styles.css?v=1", "./data.js?v=1",
  "./store.js?v=1", "./app.js?v=1", "./manifest.json?v=1",
  "./logo.png", "./app-icon.png", "./icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // network-first for same-origin navigation, cache-first for assets
  e.respondWith(
    caches.match(req).then(cached => cached ||
      fetch(req).then(res => {
        const copy = res.clone();
        if (res.ok && new URL(req.url).origin === location.origin)
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached))
  );
});
