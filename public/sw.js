const CACHE_NAME = "mutun-shell-v1";
const OFFLINE_URL = "/offline.html";

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNextStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isAppMetadata(url) {
  return (
    url.pathname === OFFLINE_URL ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icons/")
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_URL);

    return (
      offlineResponse ||
      new Response("لا يوجد اتصال بالإنترنت", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mutun-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Firebase Auth, Firestore, Storage, Google SDKs, and external media are
  // all cross-origin. Leaving them untouched prevents service-worker caching.
  if (!isSameOrigin(url)) {
    return;
  }

  // Keep dynamic Next.js data, RSC requests, and same-origin APIs out of the
  // cache as they may contain authenticated or mutable application data.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    request.headers.get("RSC") === "1" ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isNextStaticAsset(url) || isAppMetadata(url)) {
    event.respondWith(cacheFirst(request));
  }
});
