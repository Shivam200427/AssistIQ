/* Planly service worker: makes /planly work offline.
 * - Pages: network first, falling back to the cached copy when offline.
 * - Next.js build assets (/_next/static, content-hashed): cache first.
 * - API calls and other origins: never cached.
 */
const VERSION = "planly-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PRECACHE = ["/planly", "/manifest.webmanifest", "/planly-icon-192.png", "/planly-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Only the Planly page and its static files are kept for offline use.
  const isPlanlyPage = req.mode === "navigate" && url.pathname.startsWith("/planly");
  const isStaticFile = /\.(png|svg|jpg|webmanifest|ico|woff2?)$/.test(url.pathname);
  if (!isPlanlyPage && !isStaticFile) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(isPlanlyPage ? "/planly" : req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(isPlanlyPage ? "/planly" : req)) || Response.error())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const client = list.find((c) => new URL(c.url).pathname.startsWith("/planly"));
      return client ? client.focus() : self.clients.openWindow("/planly#timers");
    })
  );
});
