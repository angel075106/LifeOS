/*
 * LifeOS service worker.
 *
 * Scope is deliberately small: it makes the app installable and shows an offline notice when
 * a page cannot be loaded. It never caches pages, API responses or Supabase traffic, so no
 * private data is stored by the service worker (and nothing lingers after sign-out).
 */
const VERSION = "v1";
const STATIC_CACHE = `lifeos-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only page navigations are handled; everything else goes straight to the network.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response("LifeOS is offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out. Only the static offline page is ever cached, but clear anything else
  // defensively (e.g. caches from an older version of this worker).
  if (event.data && event.data.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))),
    );
  }
});
