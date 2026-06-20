import type { Id } from "../_generated/dataModel";
import type { TASK_STATUSES, TASK_OUTCOMES } from "../schema";

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskOutcome = (typeof TASK_OUTCOMES)[number];

// Agent-facing payload shape. Declared here (free of any `_generated/api`
// import) so tool handlers can annotate the runMutation result without pulling
// the function-reference type graph back into their own module — which would
// create a self-referential inference cycle.
export interface AgentTaskView {
  task_id: Id<"tasks">;
  project_id: Id<"projects">;
  type: string;
  title: string;
  status: TaskStatus;
  outcome: TaskOutcome | null;
  result: unknown;
  result_version: number;
  revision: number;
  // Present only on multi-item tasks (ADR-0002); null otherwise.
  item_count: number | null;
  items_done: number | null;
}
