import type { McpContext, McpServerResult, McpToolResult } from "./types";
import { getAllTools, getTool } from "./tools";
import { identityPrompt } from "./prompts/identity";
import { logger } from "../../lib/logger";
import { normalizeToolError } from "./lib/normalizeToolError";

export const MCP_ALL_TOOLS = getAllTools();
export const MCP_TOOL_MAP: ReadonlyMap<string, (typeof MCP_ALL_TOOLS)[number]> = new Map(
  MCP_ALL_TOOLS.map((tool) => [tool.name, tool]),
);

export function createMcpServer(): McpServerResult {
  return { tools: MCP_ALL_TOOLS, prompts: [identityPrompt] };
}

/**
 * Execute an MCP tool by name. Scope and owner enforcement live inside each
 * tool / its internal Convex function. Recognized ConvexErrors are normalized
 * into the failure envelope; anything else rethrows as a server fault.
 */
export async function executeMcpTool(
  mcpCtx: McpContext,
  toolName: string,
  input: unknown,
): Promise<McpToolResult> {
  const tool = getTool(toolName);
  if (!tool) throw new Error(`MCP tool not found: ${toolName}`);

  const startedAt = Date.now();
  let ok = true;
  try {
    return await tool.execute(mcpCtx, input);
  } catch (error) {
    ok = false;
    const wrapped = normalizeToolError(error);
    if (wrapped) return wrapped;
    throw error;
  } finally {
    logger.info("mcp.tool_call", { tool: toolName, durationMs: Date.now() - startedAt, ok });
  }
}

export type { McpContext };
