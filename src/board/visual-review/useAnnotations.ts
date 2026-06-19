import React from "react";
import type { Annotation, AnnotationShape, Mark, Severity, Tool, Viewport } from "./types";

// Strip the local editing id — the backend contract carries only geometry,
// viewport, severity, and comment.
export function marksToAnnotations(marks: Mark[]): Annotation[] {
  return marks.map(({ id: _id, ...annotation }) => annotation);
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

// Headless state for the annotation surface: the marks the human has drawn plus
// the active tool. Geometry comes from the canvas; this owns severity/comment
// editing, pin numbering, and selection. No canvas or DOM dependency, so the
// structured-feedback logic is unit-testable on its own.
export function useAnnotations(): AnnotationsApi {
  const [marks, setMarks] = React.useState<Mark[]>([]);
  const [activeTool, setActiveTool] = React.useState<Tool>("box");
  const nextId = React.useRef(0);

  const addMark = React.useCallback((input: NewMark): string => {
    const id = `m${++nextId.current}`;
    setMarks((prev) => {
      const label =
        input.shape === "pin" ? prev.filter((m) => m.shape === "pin").length + 1 : undefined;
      return [...prev, { id, severity: "blocker", comment: "", label, ...input }];
    });
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

  return { marks, activeTool, setActiveTool, addMark, updateComment, setSeverity, removeMark, clear };
}
