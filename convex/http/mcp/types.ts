import type { z } from "zod";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type { Tool as SdkTool, Prompt as SdkPrompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Context for MCP tool handlers. Bearer-authenticated: every call is pinned to
 * the token's `userId` (the hard security boundary) and the token's `scope`
 * (the `tasks:read` / `tasks:write` gate). `tokenId` is stamped onto rows the
 * agent creates so the board can attribute work per-agent.
 */
export interface McpContext {
  ctx: ActionCtx;
  userId: Id<"users">;
  tokenId: Id<"apiTokens">;
  scope?: string;
  clientId?: string;
}

export type McpTool = Omit<SdkTool, "description"> & {
  description: NonNullable<SdkTool["description"]>;
  execute: (mcpCtx: McpContext, input: unknown) => Promise<unknown>;
  /** Optional Zod schema describing the response envelope (audit harness). */
  responseShape?: z.ZodTypeAny;
};

export type McpToolResult = Awaited<ReturnType<McpTool["execute"]>>;

export type McpPrompt = Pick<SdkPrompt, "name"> & {
  description: NonNullable<SdkPrompt["description"]>;
  content: string;
};

export interface McpServerResult {
  tools: McpTool[];
  prompts: McpPrompt[];
}
