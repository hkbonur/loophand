import type { TaskOutcome } from "./types";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

interface OutcomeBadge {
  label: string;
  tone: BadgeTone;
  icon: string;
}

const OUTCOME_BADGES: Record<TaskOutcome, OutcomeBadge> = {
  approved: { label: "Approved", tone: "success", icon: "✓" },
  changes_requested: { label: "Changes requested", tone: "warning", icon: "✎" },
  cancelled: { label: "Cancelled", tone: "neutral", icon: "⊘" },
  expired: { label: "Expired", tone: "danger", icon: "⏱" },
  dependency_failed: { label: "Dependency failed", tone: "danger", icon: "⚠" },
};

export function outcomeBadge(outcome: TaskOutcome): OutcomeBadge {
  return OUTCOME_BADGES[outcome];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Compact relative age, e.g. "just now", "5m", "3h", "2d".
export function relativeAge(createdAt: number, now: number): string {
  const delta = Math.max(0, now - createdAt);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  return `${Math.floor(delta / DAY)}d`;
}
