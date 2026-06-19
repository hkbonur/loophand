import type { AnnotationShape, Severity } from "./types";

export interface Point {
  x: number;
  y: number;
}

// Annotations are stored in the screenshot's natural pixel space so they stay
// correct at any display scale. These helpers convert between display px (what
// the pointer reports) and image px (what we store), and assemble the points[]
// array each shape expects.

// Scale that fits the natural image width into the available display width,
// never upscaling past 1:1.
export function fitScale(naturalWidth: number, displayWidth: number): number {
  if (naturalWidth <= 0) return 1;
  return Math.min(displayWidth / naturalWidth, 1);
}

export function displayToImage(pt: Point, scale: number): Point {
  return { x: pt.x / scale, y: pt.y / scale };
}

// Build the points[] for a finished box/arrow/pin gesture, in image space. Box
// is normalized so width/height are positive whatever the drag direction.
export function buildPoints(
  shape: Exclude<AnnotationShape, "pen">,
  start: Point,
  end: Point,
): number[] {
  switch (shape) {
    case "box":
      return [
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.abs(end.x - start.x),
        Math.abs(end.y - start.y),
      ];
    case "arrow":
      return [start.x, start.y, end.x, end.y];
    case "pin":
      return [end.x, end.y];
  }
}

// Flatten a freehand pen path (a list of points) into the [x1,y1,x2,y2,…] form
// Konva's Line and the wire contract both use.
export function flattenPen(path: Point[]): number[] {
  return path.flatMap((p) => [p.x, p.y]);
}

// A box/arrow gesture shorter than this (image px) is a stray click, not a
// drag — discard it rather than store a zero-size mark.
export const MIN_DRAG = 3;

export function isClick(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) < MIN_DRAG;
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  blocker: "#e5484d",
  nit: "#f5a623",
};
