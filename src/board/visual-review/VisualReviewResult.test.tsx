// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { isVisualReviewResult, VisualReviewResult } from "./VisualReviewResult";
import type { VisualReviewResultData } from "./types";

afterEach(() => cleanup());

describe("isVisualReviewResult", () => {
  test("recognizes the visual_review payload only", () => {
    expect(isVisualReviewResult({ tool: "visual_review", annotations: [] })).toBe(true);
    expect(isVisualReviewResult({ decision: "approved", comment: "x" })).toBe(false);
    expect(isVisualReviewResult(null)).toBe(false);
    expect(isVisualReviewResult(undefined)).toBe(false);
  });
});

describe("VisualReviewResult", () => {
  const result: VisualReviewResultData = {
    result_version: 1,
    tool: "visual_review",
    decision: "changes_requested",
    comment: "overall: tighten spacing",
    annotations: [
      { shape: "box", points: [0, 0, 10, 10], viewport: "desktop", severity: "blocker", comment: "header overlaps" },
      { shape: "pin", points: [5, 5], label: 1, viewport: "mobile", severity: "nit", comment: "icon a touch small" },
    ],
  };

  test("renders the overall comment and each annotation", () => {
    render(<VisualReviewResult result={result} screenshotUrl="https://example.test/s.png" />);
    expect(screen.getByText("overall: tighten spacing")).toBeTruthy();
    expect(screen.getByText("header overlaps")).toBeTruthy();
    expect(screen.getByText("icon a touch small")).toBeTruthy();
    expect(screen.getByAltText("Reviewed screenshot")).toBeTruthy();
  });

  test("handles a result with no annotations", () => {
    render(
      <VisualReviewResult
        result={{ ...result, annotations: [], comment: null }}
        screenshotUrl={null}
      />,
    );
    expect(screen.getByText("No annotations.")).toBeTruthy();
  });
});
