import { z } from "zod";
import { internal } from "../../../../_generated/api";
import type { Id } from "../../../../_generated/dataModel";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";

const schema = z.object({
  name: z.string().min(1).describe("Name for the new isolated board."),
});

export const createProjectTool = defineTool({
  name: "create_project",
  description:
    "Creates a fresh isolated project (board) and returns its project_id. Pass that id as the `project` argument to create_task to file work into it.",
  schema,
  responseShape: mcpEnvelope({ project_id: z.string() }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "write");
    const projectId: Id<"projects"> = await mcpCtx.ctx.runMutation(
      internal.projects.createForUser,
      {
        userId: mcpCtx.userId,
        name: input.name,
        tokenId: mcpCtx.tokenId,
      },
    );
    return mcpSuccess({ project_id: projectId });
  },
});
