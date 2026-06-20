import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";

// Hand-written so the handler's type never flows back through the generated
// `internal.*` graph (the self-referential inference cycle, see fetchFile.ts).
type ResumeResult = { reopened: number; itemsDone: number; itemCount: number };

const schema = z.object({
  task_id: z.string().describe("The multi-item task to send another round of."),
  items: z
    .array(
      z.object({
        order: z.number().int().min(0).describe("The 0-based item index to revise (from the rollup)."),
        data: z
          .record(z.string(), z.any())
          .optional()
          .describe("The revised per-item payload, e.g. { render: { kind: 'react_pdf', tree } }."),
      }),
    )
    .min(1)
    .describe("The changes_requested items to revise and reopen."),
});

export const resumeItemsTool = defineTool({
  name: "resume_items",
  description:
    "Reopens the human-rejected items of a multi-item task with revised content, putting them back in front of the human for another round on the same task. Only items the human marked changes_requested can be reopened; await_task again to get the next pass.",
  schema,
  responseShape: mcpEnvelope({
    reopened: z.number(),
    items_done: z.number(),
    item_count: z.number(),
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "write");
    const result: ResumeResult = await mcpCtx.ctx.runMutation(internal.items.resumeItemsForAgent, {
      userId: mcpCtx.userId,
      tokenId: mcpCtx.tokenId,
      taskId: input.task_id,
      items: input.items,
    });
    return mcpSuccess({
      reopened: result.reopened,
      items_done: result.itemsDone,
      item_count: result.itemCount,
    });
  },
});
