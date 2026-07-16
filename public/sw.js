/**
 * Deliberately minimal service worker. Its only jobs are PWA installability
 * and shell resilience on flaky wifi. It must NEVER touch data flows:
 *  - never intercepts /api/*, POSTs, or cross-origin requests (blob uploads)
 *  - precaches only the offline page and icons — no build manifest, so a
 *    stale SW can't pin an old app version
 * Offline correctness lives in the IndexedDB outbox, not here. A broken or
 * absent SW degrades to a plain website whose uploads still work.
 */
const VERSION = "v1";
const PAGE_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline";
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== PAGE_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function networkFirstWithTimeout(request, cacheName) {
  return (async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS),
        ),
      ]);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
      throw new Error("offline and nothing cached");
    }
  })();
}

function cacheFirst(request, cacheName) {
  return (async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithTimeout(request, PAGE_CACHE));
    return;
  }

  // Content-hashed build assets and icons are safe to cache forever.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
