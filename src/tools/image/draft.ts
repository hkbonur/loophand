import type { Mark } from "../../board/visual-review/types";
import type { ImageOp } from "./transforms";

// What the human has done to an artifact but not yet sent back: the edit op-chain
// (replayed over the source to rebuild the edited bitmap), the annotation marks,
// and the overall note. Persisted to localStorage so closing the dialog or
// refreshing the browser never throws the work away — only resolving does.
export interface StudioDraft {
  ops: ImageOp[];
  marks: Mark[];
  note: string;
}

const key = (taskId: string) => `loophand:image-studio:${taskId}`;

function isEmpty(draft: StudioDraft): boolean {
  return draft.ops.length === 0 && draft.marks.length === 0 && draft.note.trim() === "";
}

export function loadDraft(taskId: string): StudioDraft | null {
  try {
    const raw = localStorage.getItem(key(taskId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudioDraft>;
    return {
      ops: Array.isArray(parsed.ops) ? parsed.ops : [],
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    // Corrupt JSON or storage disabled — treat as no draft.
    return null;
  }
}

export function saveDraft(taskId: string, draft: StudioDraft): void {
  try {
    // An untouched artifact keeps no draft (and clears any stale one).
    if (isEmpty(draft)) {
      localStorage.removeItem(key(taskId));
      return;
    }
    localStorage.setItem(key(taskId), JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage disabled — persistence is best-effort.
  }
}

export function clearDraft(taskId: string): void {
  try {
    localStorage.removeItem(key(taskId));
  } catch {
    // ignore
  }
}
