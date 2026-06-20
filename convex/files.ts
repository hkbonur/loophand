import { v, ConvexError } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { r2, generateR2Key } from "./lib/r2";
import { requireAuth } from "./lib/auth";
import { assertOwnedTask } from "./lib/ownership";

// Minimum hold for an uploaded-but-unreferenced blob: once this lapses the
// upload is eligible for reclamation by the daily cleanup cron (so actual
// reclaim latency is up to ~a day, not exactly an hour). The upload is
// "claimed" the moment a task references it (create_task for visual_review);
// until then it lives on the uploader ledger.
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

// ── Human-produced outputs (browser → R2, session-authenticated) ─────────────
//
// An agent uploads inputs server-side (upload_screenshot → r2.store). A human
// produces *outputs* (an approved doc PDF the browser rendered) and uploads them
// the other way: browser PUTs straight to R2 via a signed URL, then records the
// result. The blob is stored under a random key; the stable output name lives on
// the reference so the agent can fetch_file(task_id, name) later. See ADR-0001.

// Mint a signed URL the browser PUTs an approved output to. A pendingR2Uploads
// claim (same ledger the agent path uses) binds the key to this uploader so an
// abandoned upload is reclaimed by the daily cleanup cron.
export const startOutputUpload = mutation({
  args: { taskId: v.id("tasks"), contentType: v.string() },
  returns: v.object({ key: v.string(), url: v.string() }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedTask(ctx, args.taskId, userId);
    const key = generateR2Key();
    const { url } = await r2.generateUploadUrl(key);
    const now = Date.now();
    await ctx.db.insert("pendingR2Uploads", {
      r2Key: key,
      userId,
      contentType: args.contentType,
      createdAt: now,
      expiresAt: now + UPLOAD_CLAIM_TTL_MS,
    });
    return { key, url };
  },
});

// Record a finished output upload as a named, task-owned artifact. Pure DB — the
// bytes are already in R2 (the client PUT them to the signed URL). A re-record of
// the same (task, name) replaces the prior reference so fetch_file stays
// unambiguous across reopen rounds; the superseded blob is reclaimed.
export const recordOutput = mutation({
  args: {
    taskId: v.id("tasks"),
    name: v.string(),
    r2Key: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  returns: v.id("managedFiles"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedTask(ctx, args.taskId, userId);
    // The upload claim proves this user started this exact upload.
    const claim = await ctx.db
      .query("pendingR2Uploads")
      .withIndex("by_r2Key", (q) => q.eq("r2Key", args.r2Key))
      .first();
    if (!claim || claim.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Upload not found." });
    }

    await supersedePriorOutput(ctx, args.taskId, args.name);

    const now = Date.now();
    const fileId = await ctx.db.insert("managedFiles", {
      r2Key: args.r2Key,
      contentType: args.contentType,
      size: args.size,
      createdAt: now,
    });
    await ctx.db.insert("managedFileReferences", {
      fileId,
      ownerType: "task",
      ownerId: args.taskId,
      name: args.name,
      createdAt: now,
    });
    await ctx.db.delete(claim._id);
    return fileId;
  },
});

// Drop an existing output reference for (task, name) and reclaim its blob if no
// other reference points at it. Keeps "last write wins" for an output name.
async function supersedePriorOutput(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  name: string,
): Promise<void> {
  const prior = await ctx.db
    .query("managedFileReferences")
    .withIndex("by_owner_name", (q) =>
      q.eq("ownerType", "task").eq("ownerId", taskId).eq("name", name),
    )
    .first();
  if (!prior) return;
  await ctx.db.delete(prior._id);
  const stillReferenced = await ctx.db
    .query("managedFileReferences")
    .withIndex("by_file", (q) => q.eq("fileId", prior.fileId))
    .first();
  if (stillReferenced) return;
  const file = await ctx.db.get(prior.fileId);
  if (!file) return;
  await ctx.db.delete(file._id);
  await ctx.scheduler.runAfter(0, internal.files.deleteBlob, { r2Key: file.r2Key });
}

// Resolve (task, output name) → the stored blob's R2 key for an owning agent.
// The owner check + name lookup live here (pure DB, no network); the MCP
// fetch_file tool signs a short-TTL URL from the key. A foreign task, an unknown
// name, or a missing blob all surface the same NOT_FOUND. See ADR-0001.
export const resolveOutputForAgent = internalQuery({
  args: { userId: v.id("users"), taskId: v.string(), name: v.string() },
  returns: v.object({ r2Key: v.string(), contentType: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const notFound = () => new ConvexError({ code: "NOT_FOUND", message: "File not found." });
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) throw notFound();
    await assertOwnedTask(ctx, taskId, args.userId);
    const ref = await ctx.db
      .query("managedFileReferences")
      .withIndex("by_owner_name", (q) =>
        q.eq("ownerType", "task").eq("ownerId", taskId).eq("name", args.name),
      )
      .first();
    if (!ref) throw notFound();
    const file = await ctx.db.get(ref.fileId);
    if (!file) throw notFound();
    return { r2Key: file.r2Key, contentType: file.contentType ?? null };
  },
});

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
