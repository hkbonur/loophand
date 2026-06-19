import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";
import { TASK_STATUSES } from "../../../../schema";
import type { AgentTaskView } from "../../../../lib/taskViews";

const schema = z.object({
  project: z
    .string()
    .optional()
    .describe("Limit to a project (id or name). Omit to span all your projects."),
  status: z.enum(TASK_STATUSES).optional().describe("Filter by kanban column."),
  tags: z.array(z.string()).optional().describe("Only tasks carrying all of these tags."),
  mine: z.boolean().optional().describe("Only tasks created by this token (agent recovery)."),
});

export const listTasksTool = defineTool({
  name: "list_tasks",
  description:
    "Lists your tasks, newest first, optionally filtered by project, status, tags, or this token. Returns a compact array for board recovery and polling.",
  schema,
  responseShape: mcpEnvelope({ tasks: z.array(z.unknown()), count: z.number() }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "read");
    const tasks: AgentTaskView[] = await mcpCtx.ctx.runQuery(internal.tasks.listForAgent, {
      userId: mcpCtx.userId,
      project: input.project,
      status: input.status,
      tags: input.tags,
      tokenId: input.mine ? mcpCtx.tokenId : undefined,
    });
    return mcpSuccess({ tasks, count: tasks.length });
  },
});
