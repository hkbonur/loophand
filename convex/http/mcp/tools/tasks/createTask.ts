import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";
import { TASK_TYPES } from "../../../../lib/taskConstants";
import type { AgentTaskView } from "../../../../lib/taskViews";

const schema = z.object({
  project: z
    .string()
    .optional()
    .describe("Existing project id or name. Omit to use your default board."),
  type: z.enum(TASK_TYPES).describe('Task type. v1 supports "approval".'),
  title: z.string().min(1).describe("Short card title shown on the board."),
  instructions: z.string().min(1).describe("What you want the human to review or decide."),
  acceptance_criteria: z
    .string()
    .optional()
    .describe("Optional bar the human checks the work against."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Labels for grouping/filtering within the project."),
  idempotency_key: z
    .string()
    .optional()
    .describe("Retry-safe key: a repeat create with the same key returns the first task."),
  ttl_seconds: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Auto-expire the task if unresolved after this many seconds."),
});

export const createTaskTool = defineTool({
  name: "create_task",
  description:
    "Creates a human-review task on your loophand board and returns its task_id. The card appears live for the human; pair it with await_task to block until they resolve it.",
  schema,
  responseShape: mcpEnvelope({
    task_id: z.string(),
    project_id: z.string(),
    status: z.string(),
    reused: z.boolean(),
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "write");
    const created: { task: AgentTaskView; reused: boolean } = await mcpCtx.ctx.runMutation(
      internal.tasks.createForAgent,
      {
        userId: mcpCtx.userId,
        tokenId: mcpCtx.tokenId,
        project: input.project,
        type: input.type,
        title: input.title,
        instructions: input.instructions,
        acceptanceCriteria: input.acceptance_criteria,
        tags: input.tags,
        idempotencyKey: input.idempotency_key,
        ttlSeconds: input.ttl_seconds,
      },
    );
    const task = created.task;
    return mcpSuccess({
      task_id: task.task_id,
      project_id: task.project_id,
      status: task.status,
      reused: created.reused,
    });
  },
});
