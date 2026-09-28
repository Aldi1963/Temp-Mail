const CACHE_NAME = "tempmail-v-bypass-all";

// Force immediate activation
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Clear ALL caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Network-first without caching to prevent stale assets
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "TempMail", {
      body: data.body || "Email baru masuk!",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "tempmail-push",
      data: data.url || "/",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data || "/");
    })
  );
});
