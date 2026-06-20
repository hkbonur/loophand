import { describe, expect, test } from "vitest";
import { filterTasks, isFilterActive, EMPTY_FILTER, type BoardFilter } from "./filters";
import type { TaskView } from "./types";

function task(partial: Partial<TaskView>): TaskView {
  return {
    type: "approval",
    createdByTokenId: null,
    ...partial,
  } as TaskView;
}

const tasks: TaskView[] = [
  task({ type: "approval", createdByTokenId: "agent-a" as TaskView["createdByTokenId"] }),
  task({ type: "visual_review", createdByTokenId: "agent-b" as TaskView["createdByTokenId"] }),
  task({ type: "approval", createdByTokenId: "agent-b" as TaskView["createdByTokenId"] }),
];

describe("filterTasks", () => {
  test("returns everything for the empty filter", () => {
    expect(filterTasks(tasks, EMPTY_FILTER)).toHaveLength(3);
  });

  test("filters by type", () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTER, type: "approval" })).toHaveLength(2);
  });

  test("filters by raising agent", () => {
    const filter: BoardFilter = {
      ...EMPTY_FILTER,
      agentTokenId: "agent-b" as TaskView["createdByTokenId"],
    };
    expect(filterTasks(tasks, filter)).toHaveLength(2);
  });

  test("combines dimensions (AND)", () => {
    const filter: BoardFilter = {
      type: "approval",
      agentTokenId: "agent-b" as TaskView["createdByTokenId"],
    };
    expect(filterTasks(tasks, filter)).toHaveLength(1);
  });
});

describe("isFilterActive", () => {
  test("false for the empty filter, true once any dimension is set", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, type: "approval" })).toBe(true);
  });
});
