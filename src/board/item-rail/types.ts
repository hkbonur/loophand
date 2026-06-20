// The per-item state the backend tracks (convex/schema.ts TASK_ITEM_STATUSES).
export type ItemStatus = "pending" | "approved" | "changes_requested" | "skipped";

// The minimal shape the rail renders. Surface-agnostic: a doc item and (later) an
// image item are both just an order, a label, and a status here.
export interface RailItem {
  order: number;
  title: string | null;
  status: ItemStatus;
}
