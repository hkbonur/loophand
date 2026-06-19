import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { urlBase64ToUint8Array } from "./vapid";

export interface PushNotifications {
  /** The browser can do Web Push at all. */
  supported: boolean;
  /** The server has VAPID keys configured. */
  configured: boolean;
  subscribed: boolean;
  busy: boolean;
  permission: NotificationPermission;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Owns the browser side of Web Push: requesting permission, subscribing through
// the service worker's PushManager, and registering/clearing that subscription
// on the server. The VAPID public key comes from the backend (single source).
export function usePushNotifications(): PushNotifications {
  const vapidKey = useQuery(api.push.publicKey);
  const subscribeMut = useMutation(api.push.subscribe);
  const unsubscribeMut = useMutation(api.push.unsubscribe);

  const supported = pushSupported();
  const [subscribed, setSubscribed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Reflect any existing subscription so the prompt doesn't re-offer.
  React.useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(sub !== null))
      .catch(() => {});
  }, [supported]);

  const enable = React.useCallback(async () => {
    if (!supported || !vapidKey) return;
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const keys = sub.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) return;
      await subscribeMut({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }, [supported, vapidKey, subscribeMut]);

  const disable = React.useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMut({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported, unsubscribeMut]);

  return {
    supported,
    configured: vapidKey != null,
    subscribed,
    busy,
    permission: supported ? Notification.permission : "denied",
    enable,
    disable,
  };
}
