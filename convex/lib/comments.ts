// Task comment hygiene + the guidance derivation. Comments make "ask the agent
// back" real: a human leaves direction on a task and the agent reads it via
// get_task. `guidance` is the convenience shortcut — the freshest human comment —
// so an agent need not parse the whole thread to pick up the latest instruction.
import { ConvexError } from "convex/values";

export const MAX_COMMENT_LENGTH = 2000;

export type CommentAuthor = "human" | "agent";

export interface AgentComment {
  author: CommentAuthor;
  body: string;
  created_at: number;
}

export function normalizeCommentBody(raw: string): string {
  const body = raw.trim();
  if (!body) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Comment body is required." });
  }
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Comment exceeds ${MAX_COMMENT_LENGTH} characters.`,
    });
  }
  return body;
}

// A comment carrying a tokenId was written by an agent; otherwise it is human.
export function commentAuthor(row: { userId?: unknown; tokenId?: unknown }): CommentAuthor {
  return row.tokenId ? "agent" : "human";
}

// Latest human direction on the task, or null. `comments` is ascending by time.
export function latestGuidance(comments: AgentComment[]): string | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].author === "human") return comments[i].body;
  }
  return null;
}
