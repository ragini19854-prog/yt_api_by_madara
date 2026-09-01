const CACHE_NAME = "madara-music-v3";
const APP_SHELL = [
  "/manifest.json",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

self.addEventListener("fetch", (event) => {
  // Never intercept JS/CSS — always fetch fresh so HMR and updates work
  const url = new URL(event.request.url);
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".ts") ||
    url.pathname.endsWith(".css") ||
    url.pathname.includes("/src/") ||
    url.pathname.includes("/node_modules/") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // let browser fetch normally
  }

  // Always prefer the latest HTML so a deploy cannot leave the app pointing
  // at an old hashed JavaScript bundle. Fall back to the cached shell only
  // when the browser is offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, response.clone()),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match("/"),
          ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });
      return cached || network;
    })
  );
});
