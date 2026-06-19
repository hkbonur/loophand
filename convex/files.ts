import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { r2 } from "./lib/r2";

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

// Resolve a caller-supplied screenshot file id to an owned, still-unclaimed
// upload. A bad id, a missing blob, or a claim owned by a different user all
// surface the same NOT_FOUND so a caller can't probe for others' files.
export async function assertUploadOwnedBy(
  ctx: MutationCtx,
  userId: Id<"users">,
  rawFileId: string,
): Promise<Doc<"managedFiles">> {
  const notFound = () =>
    new ConvexError({ code: "NOT_FOUND", message: "Screenshot file not found." });
  const fileId = ctx.db.normalizeId("managedFiles", rawFileId);
  if (!fileId) throw notFound();
  const file = await ctx.db.get(fileId);
  if (!file) throw notFound();
  const claim = await ctx.db
    .query("pendingR2Uploads")
    .withIndex("by_r2Key", (q) => q.eq("r2Key", file.r2Key))
    .first();
  if (!claim || claim.userId !== userId) throw notFound();
  return file;
}

// Bind an uploaded blob to a task and consume its uploader claim. After this a
// re-reference of the same file fails ownership — one upload, one task.
export async function attachUploadToTask(
  ctx: MutationCtx,
  file: Doc<"managedFiles">,
  taskId: Id<"tasks">,
): Promise<void> {
  await ctx.db.insert("managedFileReferences", {
    fileId: file._id,
    ownerType: "task",
    ownerId: taskId,
    createdAt: Date.now(),
  });
  const claim = await ctx.db
    .query("pendingR2Uploads")
    .withIndex("by_r2Key", (q) => q.eq("r2Key", file.r2Key))
    .first();
  if (claim) await ctx.db.delete(claim._id);
}

// Removes the underlying R2 object. Scheduled (not called inline) so the
// cleanup mutation stays pure-DB and fast — the blob delete is the only piece
// that touches the network.
export const deleteBlob = internalAction({
  args: { r2Key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await r2.deleteObject(ctx, args.r2Key);
    return null;
  },
});
