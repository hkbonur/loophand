import type { Id } from "../../convex/_generated/dataModel";
import type { TaskView } from "./types";

// Client-side board filter, applied across all status columns. Status itself is
// the column axis, so it isn't a filter dimension here.
export interface BoardFilter {
  agentTokenId: Id<"apiTokens"> | null;
  type: string | null;
}

export const EMPTY_FILTER: BoardFilter = { agentTokenId: null, type: null };

export function isFilterActive(filter: BoardFilter): boolean {
  return filter.agentTokenId !== null || filter.type !== null;
}

export function filterTasks(tasks: TaskView[], filter: BoardFilter): TaskView[] {
  if (!isFilterActive(filter)) return tasks;
  return tasks.filter(
    (task) =>
      (filter.agentTokenId === null || task.createdByTokenId === filter.agentTokenId) &&
      (filter.type === null || task.type === filter.type),
  );
}
