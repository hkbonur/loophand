// loophand service worker — no-op shell for now. Web push lands in Phase 2.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
