/* Static service worker for Next.js/Vercel. Bump CACHE when shell behavior changes. */
const CACHE = "arus-shell-v2";
const PRECACHE = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png"
];

async function isAppHtml(response) {
  if (!response.ok || response.redirected || !response.headers.get("content-type")?.includes("text/html")) return false;
  return (await response.clone().text()).includes('name="arus-app-shell"');
}

async function cacheShell() {
  try {
    const response = await fetch(new Request("/app", { credentials: "include", cache: "reload" }));
    if (await isAppHtml(response)) await (await caches.open(CACHE)).put("/app", response.clone());
  } catch { /* The static offline page remains available. */ }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const offline = await fetch("/offline.html", { cache: "reload", credentials: "include" });
    if (!offline.ok || offline.redirected || !(await offline.clone().text()).includes("Arus sedang offline")) {
      throw new Error("Offline page unavailable");
    }
    await cache.put("/offline.html", offline);
    await Promise.allSettled(PRECACHE.map(async path => {
      const response = await fetch(path, { cache: "reload", credentials: "include" });
      if (response.ok && !response.redirected) await cache.put(path, response);
    }));
    await cacheShell();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("arus-shell-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CACHE_SHELL") event.waitUntil(cacheShell());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") || url.pathname === "/sw.js" ||
      /(?:signin|signout|callback)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (url.pathname === "/app" && await isAppHtml(response)) {
          try { await (await caches.open(CACHE)).put("/app", response.clone()); } catch { /* Use the network response. */ }
        }
        return response;
      } catch {
        if (url.pathname === "/app") {
          const shell = await caches.match("/app");
          if (shell) return shell;
        }
        return (await caches.match("/offline.html")) || Response.error();
      }
    })());
    return;
  }

  if (/\.(?:js|css|svg|png|webp|ico|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        try { await (await caches.open(CACHE)).put(request, response.clone()); } catch { /* Use the network response. */ }
      }
      return response;
    })());
  }
});
