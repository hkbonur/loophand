// Frontend mirror of the visual_review annotation contract the backend stores
// and returns to the agent (convex/tasks.ts `annotationValidator`). Kept in sync
// by hand — the backend is the source of truth.

export type AnnotationShape = "box" | "arrow" | "pen" | "pin";
export type Severity = "blocker" | "nit";
export type Viewport = "desktop" | "mobile";

// The wire shape sent in `tasks.resolve({ annotations })`. `points` is
// interpreted per shape: box [x,y,w,h], arrow [x1,y1,x2,y2],
// pen [x1,y1,x2,y2,…] (a freehand sketch), pin [x,y]. All coordinates are in
// the screenshot's natural pixel space, independent of display scale.
export interface Annotation {
  shape: AnnotationShape;
  points: number[];
  label?: number;
  viewport: Viewport;
  severity: Severity;
  comment: string;
}

// A mark while it lives on the canvas: an annotation plus a local id used only
// for editing/selection (stripped before submit).
export interface Mark extends Annotation {
  id: string;
}

// The active drawing tool. "select" edits existing marks without drawing.
export type Tool = "select" | AnnotationShape;

// The result a resolved visual_review task returns to the agent (and that the
// board renders read-only). Mirror of the payload tasks.resolve stores.
export interface VisualReviewResultData {
  result_version: number;
  tool: "visual_review";
  decision: string;
  annotations: Annotation[];
  comment: string | null;
}
