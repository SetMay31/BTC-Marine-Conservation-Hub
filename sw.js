/* BTC Marine Conservation Hub — service worker (offline app shell) */
const CACHE_VERSION = "btc-hub-v2";
const ASSETS = [
  "./", "./index.html", "./styles.css?v=2", "./data.js?v=2",
  "./store.js?v=2", "./app.js?v=2", "./manifest.json?v=2",
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
  // Network-first for page navigations (so a new version always wins when online);
  // cache-first for versioned assets (fast + offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match("./index.html")))
    );
    return;
  }
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
