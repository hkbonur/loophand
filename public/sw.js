// loophand service worker. Installable PWA shell + Web Push handling.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A push carries IDs only (see convex/lib/pushPayload.ts). The notification text
// is generic — the real task is loaded behind auth when the human opens the card.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const url = data.taskId ? `/?task=${encodeURIComponent(data.taskId)}` : "/";
  event.waitUntil(
    self.registration.showNotification("A task needs your review", {
      body: "An agent is waiting on you in loophand.",
      tag: data.taskId || "loophand-task",
      data: { url },
      icon: "/logo192.png",
      badge: "/logo192.png",
    }),
  );
});

// Focus an open loophand tab (deep-linking it to the card) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          // Await navigate before focus so the deep-link lands even if the SW
          // is torn down right after the click.
          return ("navigate" in client ? client.navigate(url) : Promise.resolve()).then(() =>
            client.focus(),
          );
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
