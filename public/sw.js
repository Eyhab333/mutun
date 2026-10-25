const CACHE_NAME = "mutun-shell-v1";
const OFFLINE_URL = "/offline.html";

function getReviewNotificationBody(dueCount) {
  return dueCount > 1
    ? `لديك ${dueCount} مجموعات جاهزة للمراجعة.`
    : "لديك مراجعة مستحقة الآن.";
}

function logFcmDevelopmentError(error) {
  if (self.__MUTUN_FCM_DEBUG__) {
    console.error("Unable to initialize Firebase Messaging in the service worker.", error);
  }
}

// This listener must be registered before Firebase Messaging is loaded so the
// app controls where review notifications navigate after a click.
self.addEventListener("notificationclick", (event) => {
  if (event.notification?.data?.type !== "REVIEW_DUE") {
    return;
  }

  event.notification.close();
  const targetUrl = new URL(
    event.notification.data.url || "/review",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      async (windowClients) => {
        const existingClient = windowClients.find(
          (client) => new URL(client.url).origin === self.location.origin
        );

        if (existingClient) {
          await existingClient.navigate(targetUrl);
          return existingClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }
    )
  );
});

// Reuse this PWA service worker for FCM instead of registering a competing
// firebase-messaging-sw.js with the same scope.
try {
  importScripts("/fcm-config");

  if (self.__MUTUN_FCM_CONFIG__) {
    importScripts(
      "https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js"
    );

    firebase.initializeApp(self.__MUTUN_FCM_CONFIG__);
    firebase.messaging().onBackgroundMessage((payload) => {
      if (payload?.data?.type !== "REVIEW_DUE") {
        return;
      }

      const dueCount = Number(payload.data.dueCount) || 1;

      return self.registration.showNotification("حان وقت المراجعة", {
        body: getReviewNotificationBody(dueCount),
        icon: "/icons/icon-192.png",
        tag: "mutun-review-due",
        renotify: true,
        data: {
          type: "REVIEW_DUE",
          url: payload.data.url || "/review",
        },
      });
    });
  }
} catch (error) {
  logFcmDevelopmentError(error);
}

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
