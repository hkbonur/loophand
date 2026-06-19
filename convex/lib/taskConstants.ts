// One source of truth for task-type vocabulary. `approval` ships first;
// `visual_review` (annotate a screenshot) lands in Phase 2. Later phases add
// doc_review / input / choice / sketch / image / diff.
export const TASK_TYPES = ["approval", "visual_review"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

// Human resolution actions and how each maps onto the status/outcome machine.
export const RESOLVE_ACTIONS = ["approve", "request_changes", "cancel"] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];
