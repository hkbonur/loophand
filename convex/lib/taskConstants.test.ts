import { describe, expect, test } from "vitest";
import { TASK_TYPES, isTaskType } from "./taskConstants";

describe("task type vocabulary", () => {
  test("includes approval, visual_review, and doc_review", () => {
    expect(TASK_TYPES).toContain("approval");
    expect(TASK_TYPES).toContain("visual_review");
    expect(TASK_TYPES).toContain("doc_review");
  });

  test("isTaskType narrows the supported set", () => {
    expect(isTaskType("approval")).toBe(true);
    expect(isTaskType("visual_review")).toBe(true);
    expect(isTaskType("doc_review")).toBe(true);
    expect(isTaskType("input")).toBe(false);
    expect(isTaskType("")).toBe(false);
  });
});
