self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "NexusForge", body: "You have a new notification." };
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "NexusForge", {
      body: payload.body ?? "New activity in your community.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/notifications"));
});
