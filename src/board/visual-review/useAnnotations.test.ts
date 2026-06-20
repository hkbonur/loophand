// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAnnotations, marksToAnnotations, pinNumbers } from "./useAnnotations";
import type { Mark } from "./types";

afterEach(() => cleanup());

function pin(id: string, viewport: "desktop" | "mobile"): Mark {
  return { id, shape: "pin", points: [0, 0], viewport, severity: "blocker", comment: "" };
}

describe("pinNumbers", () => {
  test("numbers pins per viewport in order", () => {
    const marks: Mark[] = [
      pin("a", "desktop"),
      pin("b", "mobile"),
      { id: "c", shape: "box", points: [0, 0, 1, 1], viewport: "desktop", severity: "nit", comment: "" },
      pin("d", "desktop"),
    ];
    expect(pinNumbers(marks)).toEqual({ a: 1, d: 2, b: 1 });
  });

  test("renumbers with no gaps or duplicates after a delete", () => {
    // p1,p2,p3 then p2 removed → the survivors are 1 and 2, never a duplicate 3.
    const survivors: Mark[] = [pin("p1", "desktop"), pin("p3", "desktop")];
    expect(pinNumbers(survivors)).toEqual({ p1: 1, p3: 2 });
  });
});

describe("marksToAnnotations", () => {
  test("strips the id and stamps derived pin labels", () => {
    const marks: Mark[] = [
      { id: "m1", shape: "box", points: [1, 2, 3, 4], viewport: "desktop", severity: "blocker", comment: "x" },
      pin("m2", "desktop"),
      pin("m3", "mobile"),
    ];
    expect(marksToAnnotations(marks)).toEqual([
      { surface: "screenshot", shape: "box", points: [1, 2, 3, 4], viewport: "desktop", severity: "blocker", comment: "x" },
      { surface: "screenshot", shape: "pin", points: [0, 0], viewport: "desktop", severity: "blocker", comment: "", label: 1 },
      { surface: "screenshot", shape: "pin", points: [0, 0], viewport: "mobile", severity: "blocker", comment: "", label: 1 },
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

  test("pin labels are derived, so deleting one never duplicates a number", () => {
    const { result } = renderHook(() => useAnnotations());
    const ids: string[] = [];
    act(() => {
      ids.push(result.current.addMark({ shape: "pin", points: [1, 1], viewport: "desktop" }));
      ids.push(result.current.addMark({ shape: "pin", points: [2, 2], viewport: "desktop" }));
      ids.push(result.current.addMark({ shape: "pin", points: [3, 3], viewport: "desktop" }));
    });
    act(() => result.current.removeMark(ids[1])); // delete the middle pin
    act(() => {
      result.current.addMark({ shape: "pin", points: [4, 4], viewport: "desktop" });
    });
    const labels = marksToAnnotations(result.current.marks)
      .filter((a) => a.shape === "pin")
      .map((a) => a.label);
    expect(labels).toEqual([1, 2, 3]); // no duplicate 3
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
