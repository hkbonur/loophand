import { mcpError, type McpFailure } from "./responses";
import { errorCode, errorMessage } from "./convexErrors";

// Map a thrown ConvexError ({ code, message } on .data) into the MCP failure
// envelope so owner/scope/not-found assertions surface as clean, recoverable
// tool errors instead of raw 500s. Returns null for anything unrecognized so
// the caller rethrows (genuine server faults stay loud).
const RECOVERABLE_CODES = new Set([
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "VALIDATION_ERROR",
  "SCOPE_REQUIRED",
]);

export function normalizeToolError(error: unknown): McpFailure | null {
  const code = errorCode(error);
  if (!code) return null;
  if (!RECOVERABLE_CODES.has(code)) return null;
  const data = (error as { data?: { message?: string } }).data;
  const message = data?.message ?? errorMessage(error);
  return mcpError(message, undefined, undefined, {
    recoverable: code !== "FORBIDDEN" && code !== "SCOPE_REQUIRED",
  });
}
