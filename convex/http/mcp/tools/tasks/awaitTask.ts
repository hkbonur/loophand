import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";
import type { AgentTaskView } from "../../../../lib/taskViews";

const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 120;
const POLL_INTERVAL_MS = 1500;

const schema = z.object({
  task_id: z.string().describe("The task id returned by create_task."),
  timeout_seconds: z
    .number()
    .int()
    .positive()
    .max(MAX_TIMEOUT_SECONDS)
    .optional()
    .describe(
      `How long to block before returning pending. Default ${DEFAULT_TIMEOUT_SECONDS}s, max ${MAX_TIMEOUT_SECONDS}s.`,
    ),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export const awaitTaskTool = defineTool({
  name: "await_task",
  description:
    "Blocks with a bounded long-poll until the human resolves the task, then returns the result and flips the card to Agent working. On a slow human turn it returns a pending envelope — call it again with the same task_id to keep waiting.",
  schema,
  responseShape: mcpEnvelope({
    status: z.string(),
    outcome: z.string().nullable().optional(),
    result: z.unknown().optional(),
    result_version: z.number().optional(),
    task_id: z.string(),
    poll_after_ms: z.number().optional(),
    resume: z.string().optional(),
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "read");
    const timeoutMs = (input.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      // `awaitReady` covers both a single task leaving the human's hands and a
      // multi-item task reaching a full pass while staying open (ADR-0002).
      const probe: { awaitReady: boolean } = await mcpCtx.ctx.runQuery(
        internal.tasks.statusForAgent,
        {
          userId: mcpCtx.userId,
          taskId: input.task_id,
        },
      );
      if (probe.awaitReady) {
        const task: AgentTaskView = await mcpCtx.ctx.runMutation(internal.tasks.consumeForAgent, {
          userId: mcpCtx.userId,
          tokenId: mcpCtx.tokenId,
          taskId: input.task_id,
        });
        return mcpSuccess({
          status: task.status,
          outcome: task.outcome,
          result: task.result,
          result_version: task.result_version,
          task_id: task.task_id,
        });
      }
      await sleep(POLL_INTERVAL_MS);
    }

    return mcpSuccess({
      status: "pending",
      task_id: input.task_id,
      poll_after_ms: 1000,
      resume:
        "Still waiting on the human. Call await_task again with the same task_id to keep waiting.",
    });
  },
});
