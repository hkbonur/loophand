import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Reclaim abandoned uploads: a `pendingR2Uploads` claim whose window lapsed
// before any task referenced the blob. The blob, its managedFiles row, and the
// claim are all freed (R2 deletion is scheduled so this stays a fast DB sweep).
// A blob that a task did reference keeps its file row and is left alone.
export const cleanupExpiredUploads = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("pendingR2Uploads")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(200);
    for (const row of stale) {
      const file = await ctx.db
        .query("managedFiles")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", row.r2Key))
        .first();
      if (file) {
        const ref = await ctx.db
          .query("managedFileReferences")
          .withIndex("by_file", (q) => q.eq("fileId", file._id))
          .first();
        if (!ref) {
          await ctx.db.delete(file._id);
          await ctx.scheduler.runAfter(0, internal.files.deleteBlob, { r2Key: row.r2Key });
        }
      }
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

const crons = cronJobs();
crons.daily(
  "cleanup-expired-uploads",
  { hourUTC: 4, minuteUTC: 0 },
  internal.crons.cleanupExpiredUploads,
);

export default crons;
