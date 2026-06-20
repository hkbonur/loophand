import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MAX_COMMENT_LENGTH,
  commentAuthor,
  latestGuidance,
  normalizeCommentBody,
} from "./comments";

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

describe("commentAuthor", () => {
  it("classifies a token-authored comment as agent", () => {
    expect(commentAuthor({ tokenId: "tok1" })).toBe("agent");
  });

  it("classifies a user-authored comment as human", () => {
    expect(commentAuthor({ userId: "user1" })).toBe("human");
  });
});

describe("latestGuidance", () => {
  it("returns the most recent human comment body", () => {
    const guidance = latestGuidance([
      { author: "human", body: "use the brand palette", created_at: 1 },
      { author: "agent", body: "noted", created_at: 2 },
      { author: "human", body: "actually, keep it neutral", created_at: 3 },
    ]);
    expect(guidance).toBe("actually, keep it neutral");
  });

  it("returns null when there is no human comment", () => {
    expect(latestGuidance([{ author: "agent", body: "noted", created_at: 1 }])).toBeNull();
  });

  it("returns null for an empty thread", () => {
    expect(latestGuidance([])).toBeNull();
  });
});
