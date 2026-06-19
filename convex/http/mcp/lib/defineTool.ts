import type { z } from "zod";
import type { McpContext, McpTool } from "../types";
import { parseMcpInput } from "./inputValidation";
import { schemaToMcpInputSchema } from "./jsonSchema";
import { isArgumentValidationError, isCursorParseError } from "./convexErrors";
import { mcpError } from "./responses";

// Tool factory: collapses the parse / dispatch / error boilerplate. The execute
// callback receives a typed, already-validated payload instead of `unknown`.
interface DefineToolSpec<TSchema extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  inputSchema?: McpTool["inputSchema"];
  responseShape?: z.ZodTypeAny;
  execute: (mcpCtx: McpContext, input: z.infer<TSchema>) => Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodTypeAny>(spec: DefineToolSpec<TSchema>): McpTool {
  return {
    name: spec.name,
    description: spec.description,
    responseShape: spec.responseShape,
    inputSchema: spec.inputSchema ?? schemaToMcpInputSchema(spec.schema),
    execute: async (mcpCtx: McpContext, rawInput: unknown) => {
      const parsed = parseMcpInput(spec.schema as z.ZodType<z.infer<TSchema>>, rawInput);
      if (!parsed.ok) return parsed.error;
      try {
        return await spec.execute(mcpCtx, parsed.data);
      } catch (err) {
        if (isArgumentValidationError(err)) {
          return mcpError(
            "Invalid ID supplied for one of the input fields. Verify the resource exists and the ID was copied from a recent list/get response.",
          );
        }
        if (isCursorParseError(err)) {
          return mcpError(
            "Invalid pagination cursor. Omit the cursor to start from page 1, or pass the exact nextCursor value from a prior response.",
          );
        }
        throw err;
      }
    },
  };
}
