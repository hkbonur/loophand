// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { loadDraft, saveDraft, clearDraft, type StudioDraft } from "./draft";
import type { Mark } from "../../board/visual-review/types";

afterEach(() => localStorage.clear());

const mark: Mark = {
  id: "m1",
  shape: "pin",
  points: [3, 4],
  viewport: "desktop",
  severity: "blocker",
  comment: "fix this",
};

const draft: StudioDraft = {
  ops: [{ kind: "grayscale" }, { kind: "rotate", deg: 90 }],
  marks: [mark],
  note: "looks off",
};

describe("studio draft store", () => {
  test("round-trips a draft for a task", () => {
    saveDraft("t1", draft);
    expect(loadDraft("t1")).toEqual(draft);
  });

  test("keeps drafts isolated per task", () => {
    saveDraft("t1", draft);
    expect(loadDraft("t2")).toBeNull();
  });

  test("an empty draft stores nothing and clears a stale one", () => {
    saveDraft("t1", draft);
    saveDraft("t1", { ops: [], marks: [], note: "   " });
    expect(loadDraft("t1")).toBeNull();
  });

  test("clearDraft removes the stored draft", () => {
    saveDraft("t1", draft);
    clearDraft("t1");
    expect(loadDraft("t1")).toBeNull();
  });

  test("corrupt JSON reads back as no draft", () => {
    localStorage.setItem("loophand:image-studio:t1", "{not json");
    expect(loadDraft("t1")).toBeNull();
  });

  test("missing fields fall back to empty", () => {
    localStorage.setItem("loophand:image-studio:t1", JSON.stringify({ note: "hi" }));
    expect(loadDraft("t1")).toEqual({ ops: [], marks: [], note: "hi" });
  });
});
