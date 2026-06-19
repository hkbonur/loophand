import { ConvexError } from "convex/values";
import type { McpContext } from "../../types";

// Authz layer: enforce the token's OAuth scope on every tool call.
// `tasks:write` implies `tasks:read`.
export type TaskScope = "read" | "write";

function tokenScopes(scope: string | undefined): Set<string> {
  return new Set((scope ?? "").split(/\s+/).filter(Boolean));
}

export function requireTaskScope(mcpCtx: McpContext, need: TaskScope): void {
  const scopes = tokenScopes(mcpCtx.scope);
  const hasWrite = scopes.has("tasks:write");
  const hasRead = scopes.has("tasks:read") || hasWrite;
  const ok = need === "write" ? hasWrite : hasRead;
  if (!ok) {
    throw new ConvexError({
      code: "SCOPE_REQUIRED",
      message: `This token lacks the required scope "tasks:${need}". Mint a key with task access from the loophand settings → Agents page.`,
    });
  }
}
