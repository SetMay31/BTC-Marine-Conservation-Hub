/* BTC Marine Conservation Hub — service worker (offline app shell) */
const CACHE_VERSION = "btc-hub-v3";
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
  // Network-first for everything: always fresh when online, cache is the offline
  // fallback. This removes the need to bump asset versions on every change.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(c => c || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
