import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
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
