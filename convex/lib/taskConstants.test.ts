import { describe, expect, test } from "vitest";
import { TASK_TYPES, isTaskType } from "./taskConstants";

describe("task type vocabulary", () => {
  test("includes approval and visual_review", () => {
    expect(TASK_TYPES).toContain("approval");
    expect(TASK_TYPES).toContain("visual_review");
  });

  test("isTaskType narrows the supported set", () => {
    expect(isTaskType("approval")).toBe(true);
    expect(isTaskType("visual_review")).toBe(true);
    expect(isTaskType("doc_review")).toBe(false);
    expect(isTaskType("")).toBe(false);
  });
});
