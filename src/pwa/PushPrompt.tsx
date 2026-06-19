import { Bell } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { usePushNotifications, type PushNotifications } from "./usePushNotifications";

// Offer the nudge only when there's something useful to do: the browser can do
// push, the server has VAPID configured, and the human hasn't already
// subscribed or denied permission.
function canOfferPush(push: PushNotifications): boolean {
  if (!push.supported) return false;
  if (!push.configured) return false;
  if (push.subscribed) return false;
  if (push.permission === "denied") return false;
  return true;
}

// A one-line nudge to turn on web push.
export function PushPrompt() {
  const push = usePushNotifications();
  if (!canOfferPush(push)) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
      <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">
        Get notified when an agent needs you — even with the tab closed.
      </span>
      <Button size="sm" disabled={push.busy} onClick={push.enable} className="ml-auto shrink-0">
        {push.busy ? <Spinner /> : "Enable notifications"}
      </Button>
    </div>
  );
}
