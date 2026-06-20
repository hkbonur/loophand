// Task comment hygiene + the guidance derivation. Comments make "ask the agent
// back" real: a human leaves direction on a task and the agent reads it via
// get_task. `guidance` is the convenience shortcut — the freshest comment — so an
// agent need not parse the whole thread to pick up the latest instruction.
//
// Only humans write comments today, so there is no author dimension. Reintroduce
// one (and filter guidance to human comments) when an agent-comment path lands.
import { ConvexError } from "convex/values";

export const MAX_COMMENT_LENGTH = 2000;
// Cap how many comments a consume returns so a long-lived task's thread can't
// bloat every agent read. Guidance is still derived from the full thread.
export const MAX_RETURNED_COMMENTS = 50;

export interface AgentComment {
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

// Latest direction on the task, or null. `comments` is ascending by time.
export function latestGuidance(comments: AgentComment[]): string | null {
  const last = comments[comments.length - 1];
  return last ? last.body : null;
}
