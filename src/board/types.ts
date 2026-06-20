import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

// Derive view models straight from the Convex function contracts so the board
// never drifts from the backend's declared return shapes.
export type TaskView = FunctionReturnType<typeof api.tasks.list>[number];
export type ProjectSummary = FunctionReturnType<typeof api.projects.list>[number];
export type TaskStatus = TaskView["status"];
export type TaskOutcome = NonNullable<TaskView["outcome"]>;

// Dependency neighbours for the card dialog's mini-view.
export type TaskDeps = FunctionReturnType<typeof api.deps.forTask>;
export type DepEntry = TaskDeps["blockedBy"][number];

export interface Column {
  status: TaskStatus;
  label: string;
  hint: string;
}

// The four live columns, left to right. `blocked` is intentionally absent — it
// shows in a collapsed lane once dependencies land (Phase 5).
export const COLUMNS: Column[] = [
  { status: "open", label: "Queue", hint: "Waiting on you" },
  { status: "awaiting_agent", label: "Awaiting agent", hint: "Resolved — result ready" },
  { status: "resumed", label: "Agent working", hint: "Agent picked up the result" },
  { status: "done", label: "Done", hint: "Closed out" },
];
