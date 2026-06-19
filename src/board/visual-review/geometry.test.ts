import { describe, expect, test } from "vitest";
import { fitScale, displayToImage, buildPoints, flattenPen, isClick } from "./geometry";

describe("geometry", () => {
  test("fitScale shrinks to fit but never upscales", () => {
    expect(fitScale(1280, 640)).toBe(0.5);
    expect(fitScale(300, 640)).toBe(1); // smaller than the frame → stay 1:1
    expect(fitScale(0, 640)).toBe(1); // guard against divide-by-zero
  });

  test("displayToImage divides by the scale", () => {
    expect(displayToImage({ x: 100, y: 50 }, 0.5)).toEqual({ x: 200, y: 100 });
  });

  test("buildPoints normalizes a box dragged up-left", () => {
    // dragged from (100,100) to (40,30): origin is the top-left, size positive
    expect(buildPoints("box", { x: 100, y: 100 }, { x: 40, y: 30 })).toEqual([40, 30, 60, 70]);
  });

  test("buildPoints keeps arrow direction and reduces a pin to its point", () => {
    expect(buildPoints("arrow", { x: 1, y: 2 }, { x: 9, y: 9 })).toEqual([1, 2, 9, 9]);
    expect(buildPoints("pin", { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([5, 5]);
  });

  test("flattenPen interleaves x,y", () => {
    expect(flattenPen([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toEqual([1, 2, 3, 4]);
  });

  test("isClick distinguishes a tap from a drag", () => {
    expect(isClick({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
    expect(isClick({ x: 0, y: 0 }, { x: 40, y: 40 })).toBe(false);
  });
});
