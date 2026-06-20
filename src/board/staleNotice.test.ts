// @vitest-environment node
import { describe, expect, test } from "vitest";
import { staleNotice } from "./staleNotice";
import type { TaskView } from "./types";

// Only status + outcome drive the notice; build minimal stand-ins.
function task(status: TaskView["status"], outcome: TaskView["outcome"] = null): TaskView {
  return { status, outcome } as TaskView;
}

describe("staleNotice", () => {
  test("an open task the human is still reviewing is not stale", () => {
    expect(staleNotice("open", task("open"))).toBeNull();
  });

  test("a TTL expiry under the open dialog is flagged", () => {
    expect(staleNotice("open", task("done", "expired"))).toMatch(/expired/i);
  });

  test("an agent cancel under the open dialog is flagged", () => {
    expect(staleNotice("open", task("done", "cancelled"))).toMatch(/cancelled/i);
  });

  test("the human's own resolve is not stale", () => {
    expect(staleNotice("open", task("awaiting_agent", "approved"))).toBeNull();
  });

  test("reopening an already-finished task is not stale", () => {
    expect(staleNotice("done", task("done", "expired"))).toBeNull();
  });
});
