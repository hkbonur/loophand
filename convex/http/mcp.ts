import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { addCorsHeaders, corsJsonErrorResponse, corsPreflightHandler } from "../lib/cors";
import { authenticateApiToken } from "../lib/apiTokenAuth";
import { getClientIp } from "../lib/clientIp";
import { logger } from "../lib/logger";
import { createMcpServer, executeMcpTool, MCP_TOOL_MAP, type McpContext } from "./mcp/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  type CallToolResult,
  type EmptyResult,
  type GetPromptResult,
  type InitializeResult,
  type ListPromptsResult,
  type ListToolsResult,
  CallToolRequestSchema,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  PingRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";

const MCP_SERVER_INFO = {
  name: "loophand-mcp",
  title: "loophand",
  version: "1.0.0",
};

const mcpServer = createMcpServer();

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error?: { code: number; message: string; data?: unknown };
}

function jsonRpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function createSdkServer(mcpCtx: McpContext): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
  });

  server.server.setRequestHandler(InitializeRequestSchema, async () => {
    const result: InitializeResult = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
      serverInfo: MCP_SERVER_INFO,
    };
    return result;
  });

  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result: ListToolsResult = {
      tools: mcpServer.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
    return result;
  });

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = MCP_TOOL_MAP.get(name);
    if (!tool) {
      const result: CallToolResult = {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) },
        ],
        isError: true,
      };
      return result;
    }
    try {
      const result = await executeMcpTool(mcpCtx, name, args ?? {});
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      } satisfies CallToolResult;
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : "Tool execution failed",
            }),
          },
        ],
        isError: true,
      } satisfies CallToolResult;
    }
  });

  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const result: ListPromptsResult = {
      prompts: mcpServer.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
      })),
    };
    return result;
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = mcpServer.prompts.find((p) => p.name === request.params.name);
    if (!prompt) throw new Error(`Unknown prompt: ${request.params.name}`);
    const result: GetPromptResult = {
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: prompt.content } },
      ],
    };
    return result;
  });

  server.server.setRequestHandler(PingRequestSchema, async () => ({}) as EmptyResult);

  return server;
}

const AUTH_DEPS = {
  recordAuthFailure: internal.rateLimit.recordAuthFailure,
  getByHash: internal.apiTokens.getByHash,
  updateLastUsed: internal.apiTokens.updateLastUsed,
};

export const mcpHandler = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS")
    return addCorsHeaders(new Response(null, { status: 204 }), request);
  if (request.method !== "POST") return corsJsonErrorResponse("Method not allowed", 405, request);

  const auth = await authenticateApiToken(ctx, request, AUTH_DEPS);
  if (!auth.ok) {
    if (auth.error === "RATE_LIMITED") {
      logger.info("mcp.rate_limited", { clientIp: getClientIp(request) });
      return addCorsHeaders(
        new Response(
          JSON.stringify(
            jsonRpcError(null, -32000, "Too many authentication attempts. Please try again later."),
          ),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
        request,
      );
    }
    return addCorsHeaders(
      new Response(JSON.stringify(jsonRpcError(null, -32000, auth.error)), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="loophand", error="invalid_token"',
        },
      }),
      request,
    );
  }

  const mcpCtx: McpContext = {
    ctx,
    userId: auth.userId,
    tokenId: auth.tokenId,
    scope: auth.scope,
    clientId: auth.clientId,
  };

  const server = createSdkServer(mcpCtx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return addCorsHeaders(response, request);
  } catch (error) {
    return addCorsHeaders(
      new Response(
        JSON.stringify(
          jsonRpcError(
            null,
            -32603,
            error instanceof Error ? error.message : "Internal error handling MCP request",
          ),
        ),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
      request,
    );
  } finally {
    await server.close().catch(() => {});
    await transport.close().catch(() => {});
  }
});

export function registerMcpRoutes(http: HttpRouter): void {
  http.route({ path: "/api/mcp", method: "OPTIONS", handler: corsPreflightHandler });
  http.route({ path: "/api/mcp", method: "POST", handler: mcpHandler });
}
