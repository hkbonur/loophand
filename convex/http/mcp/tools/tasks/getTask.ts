import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";
import type { AgentTaskDetail } from "../../../../lib/taskViews";
import { commentShape, preferencesShape } from "./roundTripShapes";

const schema = z.object({
  task_id: z.string().describe("The task id returned by create_task."),
});

export const getTaskTool = defineTool({
  name: "get_task",
  description:
    "Returns the current status, outcome, and result of a task, plus round-trip context: the human comment thread (`comments`), the freshest human direction (`guidance`), and the project's resolved standing-rule `preferences`. Read those before asking the human anything. Reading a task the human has resolved consumes it — the card flips to Agent working.",
  schema,
  responseShape: mcpEnvelope({
    task_id: z.string(),
    status: z.string(),
    outcome: z.string().nullable(),
    result: z.unknown(),
    result_version: z.number(),
    comments: z.array(commentShape),
    guidance: z.string().nullable(),
    preferences: preferencesShape,
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "read");
    const task: AgentTaskDetail = await mcpCtx.ctx.runMutation(internal.tasks.consumeForAgent, {
      userId: mcpCtx.userId,
      tokenId: mcpCtx.tokenId,
      taskId: input.task_id,
    });
    return mcpSuccess({
      task_id: task.task_id,
      status: task.status,
      outcome: task.outcome,
      result: task.result,
      result_version: task.result_version,
      comments: task.comments,
      guidance: task.guidance,
      preferences: task.preferences,
    });
  },
});
