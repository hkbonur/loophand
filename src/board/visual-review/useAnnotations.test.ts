// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAnnotations, marksToAnnotations } from "./useAnnotations";
import type { Mark } from "./types";

afterEach(() => cleanup());

describe("marksToAnnotations", () => {
  test("drops the local id and keeps the wire fields", () => {
    const marks: Mark[] = [
      { id: "m1", shape: "box", points: [1, 2, 3, 4], viewport: "desktop", severity: "blocker", comment: "x" },
      { id: "m2", shape: "pin", points: [5, 6], label: 1, viewport: "mobile", severity: "nit", comment: "y" },
    ];
    expect(marksToAnnotations(marks)).toEqual([
      { shape: "box", points: [1, 2, 3, 4], viewport: "desktop", severity: "blocker", comment: "x" },
      { shape: "pin", points: [5, 6], label: 1, viewport: "mobile", severity: "nit", comment: "y" },
    ]);
  });
});

describe("useAnnotations", () => {
  test("adds a mark with default severity and empty comment", () => {
    const { result } = renderHook(() => useAnnotations());
    let id = "";
    act(() => {
      id = result.current.addMark({ shape: "box", points: [10, 10, 50, 50], viewport: "desktop" });
    });
    expect(result.current.marks).toHaveLength(1);
    expect(result.current.marks[0]).toMatchObject({
      id,
      shape: "box",
      points: [10, 10, 50, 50],
      viewport: "desktop",
      severity: "blocker",
      comment: "",
    });
  });

  test("auto-numbers pins in the order they are added", () => {
    const { result } = renderHook(() => useAnnotations());
    act(() => {
      result.current.addMark({ shape: "pin", points: [1, 1], viewport: "desktop" });
      result.current.addMark({ shape: "box", points: [0, 0, 1, 1], viewport: "desktop" });
      result.current.addMark({ shape: "pin", points: [2, 2], viewport: "desktop" });
    });
    const pins = result.current.marks.filter((m) => m.shape === "pin");
    expect(pins.map((p) => p.label)).toEqual([1, 2]);
    expect(result.current.marks.find((m) => m.shape === "box")?.label).toBeUndefined();
  });

  test("edits comment and severity, and removes a mark", () => {
    const { result } = renderHook(() => useAnnotations());
    let id = "";
    act(() => {
      id = result.current.addMark({ shape: "pen", points: [0, 0, 5, 5], viewport: "mobile" });
    });
    act(() => {
      result.current.updateComment(id, "fix the gradient");
      result.current.setSeverity(id, "nit");
    });
    expect(result.current.marks[0]).toMatchObject({ comment: "fix the gradient", severity: "nit" });

    act(() => result.current.removeMark(id));
    expect(result.current.marks).toHaveLength(0);
  });

  test("switches the active tool", () => {
    const { result } = renderHook(() => useAnnotations());
    expect(result.current.activeTool).toBe("box");
    act(() => result.current.setActiveTool("pen"));
    expect(result.current.activeTool).toBe("pen");
  });
});
