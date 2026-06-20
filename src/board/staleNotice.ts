import type { TaskView } from "./types";

// Whether a task went stale *under an open dialog*: it was actionable when the
// human opened the card, then slipped out of their hands without their doing —
// the TTL expired it, or the agent cancelled it. (A human resolve also leaves
// `open`, but that's the human's own action, so the dialog just swaps to the
// result — not a surprise worth a banner.) Returns the banner copy, or null.
export function staleNotice(firstStatus: TaskView["status"], task: TaskView): string | null {
  if (firstStatus !== "open") return null;
  if (task.status === "open") return null;
  if (task.outcome === "expired") {
    return "This task expired while you were reviewing it — your decision was not recorded.";
  }
  if (task.outcome === "cancelled") {
    return "The agent cancelled this task while you were reviewing it.";
  }
  return null;
}
