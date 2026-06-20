import { BellIcon } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { usePushNotifications, type PushNotifications } from "./usePushNotifications";

// Push is usable at all: the browser supports it, the server has VAPID
// configured, and permission hasn't been denied.
function pushAvailable(push: PushNotifications): boolean {
  if (!push.supported) return false;
  if (!push.configured) return false;
  if (push.permission === "denied") return false;
  return true;
}

// When push is usable: a nudge to enable it, or — once on — a quiet way to turn
// it back off. Renders nothing when push can't be offered.
export function PushPrompt() {
  const push = usePushNotifications();
  if (!pushAvailable(push)) return null;

  if (push.subscribed) {
    return (
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <BellIcon className="h-3.5 w-3.5" />
        <span>Notifications on.</span>
        <button
          type="button"
          onClick={push.disable}
          disabled={push.busy}
          className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
      <BellIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">
        Get notified when an agent needs you — even with the tab closed.
      </span>
      <Button size="sm" disabled={push.busy} onClick={push.enable} className="ml-auto shrink-0">
        {push.busy ? <Spinner /> : "Enable notifications"}
      </Button>
    </div>
  );
}
