import React from "react";
import { useConvexConnectionState } from "convex/react";
import { WifiSlashIcon } from "@phosphor-icons/react";
import { bannerState, type BannerState } from "./connectionBanner";

// Presentational: a fixed top banner shown while offline or reconnecting, hidden
// when the connection is healthy.
export function OfflineBanner(props: { state: BannerState }) {
  if (props.state === "ok") return null;
  const offline = props.state === "offline";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-center text-sm font-medium text-warning"
    >
      <WifiSlashIcon className="h-4 w-4" />
      {offline
        ? "You're offline — changes can't be saved until you reconnect."
        : "Reconnecting…"}
    </div>
  );
}

// Tracks browser online/offline events alongside the Convex socket state.
export function useConnectionBanner(): BannerState {
  const conn = useConvexConnectionState();
  const [online, setOnline] = React.useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  React.useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return bannerState(online, conn);
}

// Container mounted at the app root (inside the Convex provider).
export function ConnectionBanner() {
  return <OfflineBanner state={useConnectionBanner()} />;
}
