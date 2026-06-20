import { describe, it, expect } from "vitest";
import { resizeDimensions, rotatedDimensions, extensionFor, cropRect } from "./transforms";

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

describe("cropRect", () => {
  it("snaps to whole pixels", () => {
    expect(cropRect(200, 100, 10.4, 20.6, 50.5, 30.2)).toEqual({
      x: 10,
      y: 21,
      width: 51,
      height: 30,
    });
  });
  it("clamps the rectangle to the image bounds", () => {
    expect(cropRect(200, 100, -20, -10, 300, 200)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });
  it("rejects a degenerate selection (a tap or sliver)", () => {
    expect(cropRect(200, 100, 50, 50, 1, 40)).toBeNull();
    expect(cropRect(200, 100, 50, 50, 0, 0)).toBeNull();
  });
});
