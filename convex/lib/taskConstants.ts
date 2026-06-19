// One source of truth for task-type vocabulary. v1 ships `approval`; later
// phases add visual_review / doc_review / input / choice / sketch / image / diff.
export const TASK_TYPES = ["approval"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

// Human resolution actions and how each maps onto the status/outcome machine.
export const RESOLVE_ACTIONS = ["approve", "request_changes", "cancel"] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];
