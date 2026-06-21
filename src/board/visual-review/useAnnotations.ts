import React from "react";
import type { Annotation, AnnotationShape, Mark, Severity, Tool, Viewport } from "./types";

// Number the pins 1, 2, 3… within each viewport, in the order they were added.
// Derived (not stored) so deleting a pin renumbers the rest with no gaps or
// duplicates. Returns a map of mark id → display number.
export function pinNumbers(marks: Mark[]): Record<string, number> {
  const perViewport: Record<string, number> = {};
  const numbers: Record<string, number> = {};
  for (const mark of marks) {
    if (mark.shape !== "pin") continue;
    perViewport[mark.viewport] = (perViewport[mark.viewport] ?? 0) + 1;
    numbers[mark.id] = perViewport[mark.viewport];
  }
  return numbers;
}

// Strip the local editing id, tag the screenshot surface, and stamp each pin
// with its derived label — the backend contract carries the surface, geometry,
// viewport, severity, comment, and (for pins) the number.
export function marksToAnnotations(marks: Mark[]): Annotation[] {
  const numbers = pinNumbers(marks);
  return marks.map(({ id, ...mark }) => {
    const annotation: Annotation = { surface: "screenshot", ...mark };
    return annotation.shape === "pin" ? { ...annotation, label: numbers[id] } : annotation;
  });
}

export interface NewMark {
  shape: AnnotationShape;
  points: number[];
  viewport: Viewport;
}

export interface AnnotationsApi {
  marks: Mark[];
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  /** Add a completed mark; returns its id. Pins are auto-numbered in order. */
  addMark: (input: NewMark) => string;
  updateComment: (id: string, comment: string) => void;
  setSeverity: (id: string, severity: Severity) => void;
  removeMark: (id: string) => void;
  clear: () => void;
}

// Highest numeric suffix among hydrated mark ids (`m7` → 7), so new marks pick up
// after a restored draft instead of colliding with it.
function lastMarkNumber(marks: Mark[]): number {
  return marks.reduce((max, m) => Math.max(max, Number(m.id.slice(1)) || 0), 0);
}

// Headless state for the annotation surface: the marks the human has drawn plus
// the active tool. Geometry comes from the canvas; this owns severity/comment
// editing, pin numbering, and selection. No canvas or DOM dependency, so the
// structured-feedback logic is unit-testable on its own. `initialMarks` rehydrates
// a persisted draft.
export function useAnnotations(initialMarks: Mark[] = []): AnnotationsApi {
  const [marks, setMarks] = React.useState<Mark[]>(initialMarks);
  const [activeTool, setActiveTool] = React.useState<Tool>("box");
  const nextId = React.useRef(lastMarkNumber(initialMarks));

  const addMark = React.useCallback((input: NewMark): string => {
    const id = `m${++nextId.current}`;
    setMarks((prev) => [...prev, { id, severity: "blocker", comment: "", ...input }]);
    return id;
  }, []);

  const updateComment = React.useCallback((id: string, comment: string) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, comment } : m)));
  }, []);

  const setSeverity = React.useCallback((id: string, severity: Severity) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, severity } : m)));
  }, []);

  const removeMark = React.useCallback((id: string) => {
    setMarks((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clear = React.useCallback(() => setMarks([]), []);

  return {
    marks,
    activeTool,
    setActiveTool,
    addMark,
    updateComment,
    setSeverity,
    removeMark,
    clear,
  };
}
