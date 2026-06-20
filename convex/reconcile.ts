import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { countSettled } from "./lib/items";
import { recomputeProgress } from "./items";

// Nightly drift backstop for multi-item tasks (ADR-0002). itemsDone is kept
// correct transactionally by items.setStatus, but a crash mid-mutation or a
// future code path could leave it stale; this recomputes it from the live item
// rows and repairs any task whose stored count disagrees. Only open multi-item
// tasks can drift — done tasks are terminal — so a drifted-but-complete task is
// also driven to completion here. Writes happen ONLY on a mismatch, so a
// consistent board produces no spurious revision bumps.
const SCAN_LIMIT = 1000;

export const itemCounts = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), repaired: v.number() }),
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").take(SCAN_LIMIT);
    let scanned = 0;
    let repaired = 0;
    for (const task of tasks) {
      if (task.itemCount === undefined || task.status !== "open") continue;
      scanned++;
      const items = await ctx.db
        .query("taskItems")
        .withIndex("by_task_order", (q) => q.eq("taskId", task._id))
        .collect();
      if (countSettled(items) === (task.itemsDone ?? 0)) continue;
      await recomputeProgress(ctx, task._id);
      repaired++;
    }
    return { scanned, repaired };
  },
});

// Recompute a user's metered storage from the live references: every distinct
// blob attached to their tasks — inputs (an attached screenshot) and outputs (a
// recorded artifact) alike. Mirrors how attachUploadToTask / recordOutput /
// supersede / deleteTask maintain users.storageBytes.
async function userReferencedBytes(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_status", (q) => q.eq("userId", userId))
    .collect();
  const counted = new Set<Id<"managedFiles">>();
  let total = 0;
  for (const task of tasks) {
    const refs = await ctx.db
      .query("managedFileReferences")
      .withIndex("by_owner", (q) => q.eq("ownerType", "task").eq("ownerId", task._id))
      .collect();
    for (const ref of refs) {
      if (counted.has(ref.fileId)) continue;
      counted.add(ref.fileId);
      const file = await ctx.db.get(ref.fileId);
      total += file?.size ?? 0;
    }
  }
  return total;
}

// Nightly drift backstop for the storage quota. The counter is kept correct
// transactionally by files.recordOutput / supersede, but a crash mid-mutation or
// a future free-without-decrement path could leave it stale; recompute from the
// live references and repair only on a mismatch.
export const storageBytes = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), repaired: v.number() }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(SCAN_LIMIT);
    let scanned = 0;
    let repaired = 0;
    for (const user of users) {
      scanned++;
      const actual = await userReferencedBytes(ctx, user._id);
      if ((user.storageBytes ?? 0) === actual) continue;
      await ctx.db.patch(user._id, { storageBytes: actual });
      repaired++;
    }
    return { scanned, repaired };
  },
});
