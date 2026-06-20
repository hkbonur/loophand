import { describe, it, expect } from "vitest";
import { resizeDimensions, rotatedDimensions, extensionFor } from "./transforms";

describe("resizeDimensions", () => {
  it("preserves aspect ratio", () => {
    expect(resizeDimensions(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });
  it("rounds and clamps to at least 1px", () => {
    expect(resizeDimensions(3, 3, 1)).toEqual({ width: 1, height: 1 });
    expect(resizeDimensions(1000, 333, 100)).toEqual({ width: 100, height: 33 });
  });
});

describe("rotatedDimensions", () => {
  it("swaps for 90/270 and keeps for 180", () => {
    expect(rotatedDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 });
    expect(rotatedDimensions(800, 600, 270)).toEqual({ width: 600, height: 800 });
    expect(rotatedDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 });
  });
});

describe("extensionFor", () => {
  it("maps mime to a file extension", () => {
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});
