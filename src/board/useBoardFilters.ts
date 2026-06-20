import React from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { filterTasks, EMPTY_FILTER, type BoardFilter } from "./filters";
import type { AgentOption } from "./BoardFilters";
import type { AgentDirectory } from "./useAgents";
import type { TaskView } from "./types";

export interface BoardFiltersState {
  filter: BoardFilter;
  setFilter: (filter: BoardFilter) => void;
  agentOptions: AgentOption[];
  visibleTasks: TaskView[] | undefined;
}

// Owns the board's filter concern: the agent/type dropdown sources, the
// selection state (reset per board), and the filtered task list. Keeps
// BoardInner focused on layout.
export function useBoardFilters(
  tasks: TaskView[] | undefined,
  agents: AgentDirectory,
  projectId: Id<"projects"> | null,
): BoardFiltersState {
  const [filter, setFilter] = React.useState<BoardFilter>(EMPTY_FILTER);

  // A filter set on one board shouldn't leak onto the next.
  React.useEffect(() => setFilter(EMPTY_FILTER), [projectId]);

  // Offer only agents that actually raised a card on this board, named via the
  // agent directory (a since-deleted token still shows, as "Unknown agent").
  const agentOptions = React.useMemo<AgentOption[]>(() => {
    const named = new Map<Id<"apiTokens">, string>();
    for (const task of tasks ?? []) {
      if (task.createdByTokenId && !named.has(task.createdByTokenId)) {
        named.set(task.createdByTokenId, agents.get(task.createdByTokenId)?.name ?? "Unknown agent");
      }
    }
    return [...named].map(([id, name]) => ({ id, name }));
  }, [tasks, agents]);

  const visibleTasks = React.useMemo(
    () => (tasks ? filterTasks(tasks, filter) : tasks),
    [tasks, filter],
  );

  return { filter, setFilter, agentOptions, visibleTasks };
}
