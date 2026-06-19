import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";
import type { AgentTaskView } from "../../../../lib/taskViews";

const schema = z.object({
  task_id: z.string().describe("The task id to cancel."),
  reason: z.string().optional().describe("Optional note recorded with the cancellation."),
});

export const cancelTaskTool = defineTool({
  name: "cancel_task",
  description:
    "Cancels an open task you created and returns its final state. Moves the card to Done with a cancelled badge; an already-resolved task cannot be cancelled.",
  schema,
  responseShape: mcpEnvelope({
    task_id: z.string(),
    status: z.string(),
    outcome: z.string().nullable(),
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "write");
    const task: AgentTaskView = await mcpCtx.ctx.runMutation(internal.tasks.cancelForAgent, {
      userId: mcpCtx.userId,
      tokenId: mcpCtx.tokenId,
      taskId: input.task_id,
      reason: input.reason,
    });
    return mcpSuccess({ task_id: task.task_id, status: task.status, outcome: task.outcome });
  },
});
