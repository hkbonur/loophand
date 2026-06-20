import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import { MAX_COMMENT_LENGTH, latestGuidance, normalizeCommentBody } from "./comments";

describe("normalizeCommentBody", () => {
  it("trims the body", () => {
    expect(normalizeCommentBody("  ship it  ")).toBe("ship it");
  });

  it("rejects an empty body", () => {
    expect(() => normalizeCommentBody("   ")).toThrow(ConvexError);
  });

  it("rejects a body over the length cap", () => {
    expect(() => normalizeCommentBody("x".repeat(MAX_COMMENT_LENGTH + 1))).toThrow(ConvexError);
  });
});

describe("latestGuidance", () => {
  it("returns the most recent comment body", () => {
    const guidance = latestGuidance([
      { body: "use the brand palette", created_at: 1 },
      { body: "actually, keep it neutral", created_at: 2 },
    ]);
    expect(guidance).toBe("actually, keep it neutral");
  });

  it("returns null for an empty thread", () => {
    expect(latestGuidance([])).toBeNull();
  });
});
