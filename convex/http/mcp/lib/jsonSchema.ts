import { z } from "zod";
import type { McpTool } from "../types";

// One source of truth for a tool's wire schema: derive the MCP JSON input
// schema from its Zod definition. zod v4 ships native JSON-schema conversion.
export function schemaToMcpInputSchema(schema: z.ZodTypeAny): McpTool["inputSchema"] {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  // MCP clients don't need the dialect marker, and some choke on it.
  delete json.$schema;
  if (json.type !== "object") {
    // MCP requires an object root. Wrap non-object schemas defensively.
    return { type: "object", properties: {} };
  }
  return json as McpTool["inputSchema"];
}
