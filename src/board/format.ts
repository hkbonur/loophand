import type { BadgeTone } from "../ui/badge";
import type { TaskOutcome, TaskView } from "./types";

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

// The leading mark on a card's status pill: a live dot while the task waits on
// the human, a lock while it's blocked, a glyph (✓ ✎ …) once it has an outcome.
export type CardStatusLead =
  | { kind: "pulse" }
  | { kind: "lock" }
  | { kind: "glyph"; glyph: string }
  | null;

export interface CardStatus {
  label: string;
  tone: BadgeTone;
  lead: CardStatusLead;
}

// The single state a kanban card leads with. A resolved task speaks through its
// outcome; an unresolved one through where it sits in the loop.
export function cardStatus(task: TaskView): CardStatus {
  if (task.outcome) {
    const badge = OUTCOME_BADGES[task.outcome];
    return { label: badge.label, tone: badge.tone, lead: { kind: "glyph", glyph: badge.icon } };
  }
  switch (task.status) {
    case "open":
      return { label: "In queue", tone: "success", lead: { kind: "pulse" } };
    case "blocked":
      return {
        label:
          task.depCount > 0
            ? `${task.depCount} ${task.depCount === 1 ? "dep" : "deps"}`
            : "Scheduled",
        tone: "neutral",
        lead: { kind: "lock" },
      };
    case "awaiting_agent":
      return { label: "Awaiting agent", tone: "neutral", lead: null };
    case "resumed":
      return { label: "Agent working", tone: "info", lead: null };
    case "done":
      return { label: "Done", tone: "neutral", lead: null };
  }
}
