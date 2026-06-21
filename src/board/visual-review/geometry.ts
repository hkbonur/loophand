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

// Canvas marks carry full-strength status hue (the one place saturated status
// color is drawn directly, not as a tinted badge). Pulled toward the design
// system's destructive / warning family so a mark on the canvas matches its
// severity pill in the comment box.
export const SEVERITY_COLOR: Record<Severity, string> = {
  blocker: "#ef4444",
  nit: "#f59e0b",
};

// The mark's bounding rectangle in image space. Drives the click target that
// opens a comment in edit mode (where the Konva canvas itself is pass-through),
// so the whole marker is clickable, not just the chat bubble.
export function markBounds(
  shape: AnnotationShape,
  points: number[],
): { x: number; y: number; w: number; h: number } {
  switch (shape) {
    case "box":
      return { x: points[0], y: points[1], w: points[2], h: points[3] };
    case "arrow": {
      const [x1, y1, x2, y2] = points;
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
      };
    }
    case "pen": {
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case "pin":
      return { x: points[0], y: points[1], w: 0, h: 0 };
  }
}

// Where a mark's inline comment bubble docks, in image space: the box's
// top-right, the arrow's head, the pen's last point, the pin's center. Kept
// here so the canvas overlay and any read-only renderer agree on the anchor.
export function markAnchor(shape: AnnotationShape, points: number[]): Point {
  switch (shape) {
    case "box":
      return { x: points[0] + points[2], y: points[1] };
    case "arrow":
      return { x: points[2], y: points[3] };
    case "pen": {
      const n = points.length;
      return { x: points[n - 2], y: points[n - 1] };
    }
    case "pin":
      return { x: points[0], y: points[1] };
  }
}
