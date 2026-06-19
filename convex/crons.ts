import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Sweep abandoned R2 pre-uploads (rows whose signed-upload window lapsed before
// the client finalized). Harmless no-op until artifacts land (Phase 3).
export const cleanupExpiredUploads = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("pendingR2Uploads")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(200);
    for (const row of stale) await ctx.db.delete(row._id);
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
