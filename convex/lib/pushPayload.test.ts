import { describe, expect, test } from "vitest";
import { buildPushPayload, isDeadPushError } from "./pushPayload";

describe("buildPushPayload", () => {
  test("carries ids only — no task content", () => {
    const payload = JSON.parse(buildPushPayload("task123", "proj456"));
    expect(payload).toEqual({ type: "task_created", taskId: "task123", projectId: "proj456" });
    // Guard against ever leaking content fields through the push service.
    expect(Object.keys(payload).sort()).toEqual(["projectId", "taskId", "type"]);
  });
});

describe("isDeadPushError", () => {
  test("treats 404/410 as dead, everything else as transient", () => {
    expect(isDeadPushError(404)).toBe(true);
    expect(isDeadPushError(410)).toBe(true);
    expect(isDeadPushError(429)).toBe(false);
    expect(isDeadPushError(500)).toBe(false);
    expect(isDeadPushError(undefined)).toBe(false);
  });
});
