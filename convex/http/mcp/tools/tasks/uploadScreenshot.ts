import { z } from "zod";
import { internal } from "../../../../_generated/api";
import type { Id } from "../../../../_generated/dataModel";
import { r2 } from "../../../../lib/r2";
import { decodeScreenshotUpload } from "../../../../lib/screenshots";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";

const schema = z.object({
  data_base64: z
    .string()
    .min(1)
    .describe(
      "The screenshot bytes, base64-encoded (a data: URL is also accepted). Must be a PNG, JPEG, or WEBP image.",
    ),
});

export const uploadScreenshotTool = defineTool({
  name: "upload_screenshot",
  description:
    "Stores a screenshot image and returns a file_id. Pass that id as create_task tool_payload.screenshotFileId to open a visual_review task. You upload the bytes directly — no URL is ever fetched server-side.",
  schema,
  responseShape: mcpEnvelope({ file_id: z.string() }),
  execute: async (mcpCtx, input) => {
    requireTaskScope(mcpCtx, "write");
    const { bytes, contentType, size } = decodeScreenshotUpload(input.data_base64);
    const r2Key = await r2.store(mcpCtx.ctx, bytes, { type: contentType });
    // Annotate the result to break the self-referential inference cycle that
    // otherwise forms when a tool handler's return type flows through the
    // generated `internal.*` function-reference graph (see lib/taskViews.ts).
    const fileId: Id<"managedFiles"> = await mcpCtx.ctx.runMutation(
      internal.files.registerUpload,
      { userId: mcpCtx.userId, r2Key, contentType, size },
    );
    return mcpSuccess({ file_id: fileId });
  },
});
