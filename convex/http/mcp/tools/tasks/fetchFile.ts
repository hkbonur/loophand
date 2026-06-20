import { z } from "zod";
import { internal } from "../../../../_generated/api";
import { r2, SIGNED_URL_TTL_SECONDS } from "../../../../lib/r2";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";

// Hand-written so the handler's type never flows back through the generated
// `internal.*` graph (the cycle uploadScreenshot.ts and lib/taskViews.ts dodge).
type ResolvedOutput = { r2Key: string; contentType: string | null };

const schema = z.object({
  task_id: z.string().describe("The task id the artifact belongs to."),
  name: z
    .string()
    .min(1)
    .describe('The stable output name, e.g. "item-1.pdf" (as returned in the task result).'),
});

export const fetchFileTool = defineTool({
  name: "fetch_file",
  description:
    "Returns a short-lived signed download URL for a human-produced artifact stored on a task, addressed by its stable name. Only the task's owner can fetch it; the URL expires, so download it promptly.",
  schema,
  responseShape: mcpEnvelope({
    name: z.string(),
    url: z.string(),
    content_type: z.string().nullable(),
    expires_in: z.number(),
  }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "read");
    // Owner + name resolution happen in the query (pure DB); we only sign here.
    const resolved: ResolvedOutput = await mcpCtx.ctx.runQuery(
      internal.files.resolveOutputForAgent,
      { userId: mcpCtx.userId, taskId: input.task_id, name: input.name },
    );
    const url = await r2.getUrl(resolved.r2Key, { expiresIn: SIGNED_URL_TTL_SECONDS });
    return mcpSuccess({
      name: input.name,
      url,
      content_type: resolved.contentType,
      expires_in: SIGNED_URL_TTL_SECONDS,
    });
  },
});
