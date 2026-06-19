import React from "react";

// Registers the no-op service worker so the app is installable as a PWA. Push
// subscription is wired in Phase 2.
export function ServiceWorker() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort; the app works without it.
    });
  }, []);
  return null;
}
