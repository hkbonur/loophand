import { describe, expect, test } from "vitest";
import {
  isTerminalFailure,
  isApprovedDep,
  initialTaskState,
  canUnblock,
} from "./deps";
import type { Doc } from "../_generated/dataModel";

type DepLike = Pick<Doc<"tasks">, "outcome">;
const dep = (outcome: DepLike["outcome"]): DepLike => ({ outcome });
const NOW = 1_000_000_000_000;

describe("isTerminalFailure", () => {
  test("true for cancelled / expired / dependency_failed", () => {
    expect(isTerminalFailure(dep("cancelled"))).toBe(true);
    expect(isTerminalFailure(dep("expired"))).toBe(true);
    expect(isTerminalFailure(dep("dependency_failed"))).toBe(true);
  });
  test("false for approved / changes_requested / undefined", () => {
    expect(isTerminalFailure(dep("approved"))).toBe(false);
    expect(isTerminalFailure(dep("changes_requested"))).toBe(false);
    expect(isTerminalFailure(dep(undefined))).toBe(false);
  });
});

describe("isApprovedDep", () => {
  test("only approved counts", () => {
    expect(isApprovedDep(dep("approved"))).toBe(true);
    expect(isApprovedDep(dep("changes_requested"))).toBe(false);
    expect(isApprovedDep(dep(undefined))).toBe(false);
  });
});

describe("initialTaskState", () => {
  test("no deps, no notBefore → open", () => {
    expect(initialTaskState([], undefined, NOW)).toEqual({ status: "open" });
  });
  test("a terminally-failed dep → born failed", () => {
    expect(initialTaskState([dep("approved"), dep("cancelled")], undefined, NOW)).toEqual({
      status: "done",
      outcome: "dependency_failed",
    });
  });
  test("a non-approved dep → blocked", () => {
    expect(initialTaskState([dep(undefined)], undefined, NOW)).toEqual({ status: "blocked" });
    expect(initialTaskState([dep("changes_requested")], undefined, NOW)).toEqual({
      status: "blocked",
    });
  });
  test("all deps approved but notBefore in the future → blocked", () => {
    expect(initialTaskState([dep("approved")], NOW + 10_000, NOW)).toEqual({ status: "blocked" });
  });
  test("all deps approved and notBefore passed → open", () => {
    expect(initialTaskState([dep("approved")], NOW - 10_000, NOW)).toEqual({ status: "open" });
  });
  test("terminal failure wins over a future notBefore", () => {
    expect(initialTaskState([dep("expired")], NOW + 10_000, NOW)).toEqual({
      status: "done",
      outcome: "dependency_failed",
    });
  });
});

describe("canUnblock", () => {
  test("true when every dep approved and notBefore passed", () => {
    expect(canUnblock([dep("approved"), dep("approved")], undefined, NOW)).toBe(true);
    expect(canUnblock([dep("approved")], NOW - 1, NOW)).toBe(true);
    expect(canUnblock([], undefined, NOW)).toBe(true);
  });
  test("false while any dep is unapproved or notBefore is future", () => {
    expect(canUnblock([dep("approved"), dep(undefined)], undefined, NOW)).toBe(false);
    expect(canUnblock([dep("approved")], NOW + 1, NOW)).toBe(false);
  });
  test("false when a dep terminally failed (cascade-fail handles it)", () => {
    expect(canUnblock([dep("cancelled")], undefined, NOW)).toBe(false);
  });
});
