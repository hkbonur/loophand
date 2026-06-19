import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// How long an uploaded-but-unreferenced blob is held before the cleanup cron
// reclaims it. The upload is "claimed" the moment a task references it
// (create_task for visual_review); until then it lives on the uploader ledger.
export const UPLOAD_CLAIM_TTL_MS = 60 * 60 * 1000; // 1 hour

// Records a freshly uploaded R2 blob: the owner-agnostic `managedFiles` row plus
// a `pendingR2Uploads` claim that binds the blob to its uploader. The claim lets
// create_task verify the caller owns the file, and lets the cron reclaim blobs
// that were uploaded but never attached to a task.
export const registerUpload = internalMutation({
  args: {
    userId: v.id("users"),
    r2Key: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  returns: v.id("managedFiles"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const fileId = await ctx.db.insert("managedFiles", {
      r2Key: args.r2Key,
      contentType: args.contentType,
      size: args.size,
      createdAt: now,
    });
    await ctx.db.insert("pendingR2Uploads", {
      r2Key: args.r2Key,
      userId: args.userId,
      contentType: args.contentType,
      createdAt: now,
      expiresAt: now + UPLOAD_CLAIM_TTL_MS,
    });
    return fileId;
  },
});
