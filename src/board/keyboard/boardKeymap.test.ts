import { describe, it, expect } from "vitest";
import { keyToNavCommand, moveFocus, type Focus } from "./boardKeymap";

describe("keyToNavCommand", () => {
  it("maps vim keys and arrows", () => {
    expect(keyToNavCommand("j")).toBe("down");
    expect(keyToNavCommand("ArrowDown")).toBe("down");
    expect(keyToNavCommand("k")).toBe("up");
    expect(keyToNavCommand("h")).toBe("left");
    expect(keyToNavCommand("l")).toBe("right");
    expect(keyToNavCommand("o")).toBe("open");
    expect(keyToNavCommand("Enter")).toBe("open");
  });

  it("ignores unmapped keys", () => {
    expect(keyToNavCommand("x")).toBeNull();
  });
});

describe("moveFocus", () => {
  const cols = [2, 0, 3, 1]; // col 1 empty

  it("lands on the first non-empty column from no focus", () => {
    expect(moveFocus(cols, null, "down")).toEqual({ col: 0, row: 0 });
  });

  it("returns null when there are no cards at all", () => {
    expect(moveFocus([0, 0], null, "down")).toBeNull();
  });

  it("moves down within a column and clamps at the bottom", () => {
    expect(moveFocus(cols, { col: 0, row: 0 }, "down")).toEqual({ col: 0, row: 1 });
    expect(moveFocus(cols, { col: 0, row: 1 }, "down")).toEqual({ col: 0, row: 1 });
  });

  it("moves up within a column and clamps at the top", () => {
    expect(moveFocus(cols, { col: 2, row: 1 }, "up")).toEqual({ col: 2, row: 0 });
    expect(moveFocus(cols, { col: 2, row: 0 }, "up")).toEqual({ col: 2, row: 0 });
  });

  it("skips an empty column moving right and clamps the row", () => {
    // col 0 row 1 → right skips empty col 1 → col 2 (len 3), row stays 1
    expect(moveFocus(cols, { col: 0, row: 1 }, "right")).toEqual({ col: 2, row: 1 });
  });

  it("clamps the row to the shorter destination column", () => {
    // col 2 row 2 → right → col 3 has len 1 → row clamps to 0
    expect(moveFocus(cols, { col: 2, row: 2 }, "right")).toEqual({ col: 3, row: 0 });
  });

  it("stays put when there is no non-empty column in that direction", () => {
    expect(moveFocus(cols, { col: 3, row: 0 }, "right")).toEqual({ col: 3, row: 0 });
    expect(moveFocus(cols, { col: 0, row: 0 }, "left")).toEqual({ col: 0, row: 0 });
  });

  it("treats open/null as no-ops on focus", () => {
    const f: Focus = { col: 2, row: 1 };
    expect(moveFocus(cols, f, "open")).toBe(f);
    expect(moveFocus(cols, f, null)).toBe(f);
  });
});
