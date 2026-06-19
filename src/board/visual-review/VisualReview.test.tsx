// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { TaskView } from "../types";

// Hoisted so the (hoisted) vi.mock factories below can reference them.
const { resolveSpy, toast } = vi.hoisted(() => ({
  resolveSpy: vi.fn(() => Promise.resolve()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
// useMutation(api.tasks.resolve) → our spy.
vi.mock("convex/react", () => ({ useMutation: () => resolveSpy }));
// Toaster is a side effect; capture it instead of rendering sonner.
vi.mock("../../ui/toaster", () => ({ toast }));

// Konva can't run in jsdom — stub the canvas with a button that emits a mark
// for the viewport it was handed, exactly like a real draw would.
vi.mock("./AnnotationCanvas", () => ({
  AnnotationCanvas: (props: {
    viewport: string;
    onAddMark: (m: { shape: string; points: number[]; viewport: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        props.onAddMark({ shape: "box", points: [10, 10, 40, 40], viewport: props.viewport })
      }
    >
      draw-box
    </button>
  ),
}));

import { VisualReview } from "./VisualReview";

function fakeTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    _id: "task1",
    revision: 0,
    screenshotUrl: "https://example.test/shot.png",
    toolPayload: { screenshotFileId: "file1", viewports: ["desktop", "mobile"] },
    ...overrides,
  } as unknown as TaskView;
}

beforeEach(() => {
  resolveSpy.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
});
afterEach(() => cleanup());

describe("VisualReview", () => {
  test("approve with no annotations resolves without an annotations payload", async () => {
    render(<VisualReview task={fakeTask()} onResolved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
    expect(resolveSpy).toHaveBeenCalledWith({
      taskId: "task1",
      action: "approve",
      comment: undefined,
      revision: 0,
      annotations: undefined,
    });
  });

  test("request changes with nothing to say is blocked", () => {
    render(<VisualReview task={fakeTask()} onResolved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Request changes/ }));
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  test("a drawn annotation and its comment flow into the resolve payload", async () => {
    const onResolved = vi.fn();
    render(<VisualReview task={fakeTask()} onResolved={onResolved} />);

    // Draw a box (stubbed canvas), then comment on it.
    fireEvent.click(await screen.findByRole("button", { name: "draw-box" }));
    fireEvent.change(screen.getByPlaceholderText("What needs to change here?"), {
      target: { value: "tighten this padding" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request changes/ }));

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task1",
        action: "request_changes",
        revision: 0,
        annotations: [
          {
            shape: "box",
            points: [10, 10, 40, 40],
            viewport: "desktop",
            severity: "blocker",
            comment: "tighten this padding",
          },
        ],
      }),
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
  });
});
