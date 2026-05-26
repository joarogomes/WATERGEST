const CACHE_NAME = "agua-cristalina-cache-v13";
const PRECACHE_ASSETS = [
  "./manifest.webmanifest",
  "./assets/logo.png",
  "./assets/login-logo.png"
];
const NETWORK_FIRST_PATHS = ["/", "/index.html", "/app.js", "/styles.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isMutableAsset(url) {
  if (NETWORK_FIRST_PATHS.includes(url.pathname)) return true;
  if (url.pathname.endsWith(".html")) return true;
  if (url.pathname.endsWith(".js")) return true;
  if (url.pathname.endsWith(".css")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" || isMutableAsset(url)) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
