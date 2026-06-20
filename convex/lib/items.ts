import type { Doc } from "../_generated/dataModel";

// The stable output name an agent fetches an item's artifact by (fetch_file).
// Single source of truth shared by the rollup (backend) and the approve-time
// upload (frontend) so the two never disagree on the key. doc_review items
// render to a PDF; other kinds carry no canonical artifact extension.
export function itemOutputName(kind: string, order: number): string {
  const n = order + 1;
  return kind === "doc_review" ? `item-${n}.pdf` : `item-${n}`;
}

// An item is "settled" once the human has acted on it (anything but pending).
export function isItemSettled(status: Doc<"taskItems">["status"]): boolean {
  return status !== "pending";
}

// How many items the human has settled this pass.
export function countSettled(items: Doc<"taskItems">[]): number {
  return items.filter((i) => isItemSettled(i.status)).length;
}

// A task is fully passed when every item is settled and none was sent back. A
// `changes_requested` item keeps the task open for the agent's next round; a
// `skipped` item is terminal-but-not-approved and does not (ADR-0002).
export function isFullyApproved(items: Doc<"taskItems">[]): boolean {
  return items.every((i) => i.status === "approved" || i.status === "skipped");
}

// The agent-facing rollup: which items passed, which need another round.
export function buildRollup(kind: string, items: Doc<"taskItems">[]) {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  return {
    tool: kind,
    multi: true as const,
    items: ordered.map((i) => ({
      name: itemOutputName(kind, i.order),
      order: i.order,
      status: i.status,
      result: i.result ?? null,
    })),
    partial: ordered.some((i) => i.status === "changes_requested"),
  };
}
