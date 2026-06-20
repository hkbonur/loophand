import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { assertOwnedTask } from "./lib/ownership";
import { TASK_ITEM_STATUSES } from "./schema";
import { buildRollup, countSettled, isFullyApproved, itemOutputName } from "./lib/items";

const itemStatusValidator = v.union(...TASK_ITEM_STATUSES.map((s) => v.literal(s)));

// The human verdicts. `pending` is the create-time state, never a target the UI
// sets directly — an item only leaves pending by a human acting on it (here) or
// re-enters it when the agent reopens it (resumeItemsForAgent).
const HUMAN_VERDICTS = ["approved", "changes_requested", "skipped"] as const;
const humanVerdictValidator = v.union(...HUMAN_VERDICTS.map((s) => v.literal(s)));

const itemViewValidator = v.object({
  _id: v.id("taskItems"),
  taskId: v.id("tasks"),
  order: v.number(),
  kind: v.string(),
  title: v.union(v.string(), v.null()),
  data: v.any(),
  status: itemStatusValidator,
  result: v.any(),
  name: v.string(),
});

function toItemView(item: Doc<"taskItems">) {
  return {
    _id: item._id,
    taskId: item.taskId,
    order: item.order,
    kind: item.kind,
    title: item.title ?? null,
    data: item.data ?? null,
    status: item.status,
    result: item.result ?? null,
    name: itemOutputName(item.kind, item.order),
  };
}

async function itemsForTask(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
): Promise<Doc<"taskItems">[]> {
  return ctx.db
    .query("taskItems")
    .withIndex("by_task_order", (q) => q.eq("taskId", taskId))
    .collect();
}

// ── Human-facing (session-authenticated, used by the ItemRail) ───────────────

export const list = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(itemViewValidator),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedTask(ctx, args.taskId, userId);
    const items = await itemsForTask(ctx, args.taskId);
    return items.sort((a, b) => a.order - b.order).map(toItemView);
  },
});

// Record the human's verdict on one rail item, then recompute the task's
// progress. The recompute reads every item fresh, so concurrent item writes are
// an OCC write-write conflict on the task row that Convex retries — itemsDone
// can't drift under a batch submit. See ADR-0002.
export const setStatus = mutation({
  args: {
    itemId: v.id("taskItems"),
    status: humanVerdictValidator,
    result: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError({ code: "NOT_FOUND", message: "Item not found" });
    const task = await assertOwnedTask(ctx, item.taskId, userId);
    if (task.status !== "open") {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Task is "${task.status}", not awaiting review.`,
      });
    }
    await ctx.db.patch(args.itemId, {
      status: args.status,
      result: args.result,
      updatedAt: Date.now(),
    });
    await recomputeProgress(ctx, item.taskId);
    return null;
  },
});

// ── Agent-facing (trusted userId from token auth, used by MCP tools) ─────────

// The agent's reopen: overwrite each changes_requested item with a revised
// payload and reset it to pending. itemsDone drops, the task stays open, and the
// next human pass re-arms await_task (ADR-0002). Only changes_requested items
// can be reopened — approved/skipped verdicts are final.
export const resumeItemsForAgent = internalMutation({
  args: {
    userId: v.id("users"),
    tokenId: v.id("apiTokens"),
    taskId: v.string(),
    items: v.array(v.object({ order: v.number(), data: v.optional(v.any()) })),
  },
  returns: v.object({ reopened: v.number(), itemsDone: v.number(), itemCount: v.number() }),
  handler: async (ctx, args) => {
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
    const task = await assertOwnedTask(ctx, taskId, args.userId);
    if (task.status !== "open" || task.itemCount === undefined) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Only an open multi-item task can have items reopened.",
      });
    }
    const existing = await itemsForTask(ctx, taskId);
    const byOrder = new Map(existing.map((i) => [i.order, i]));
    const now = Date.now();
    let reopened = 0;
    for (const patch of args.items) {
      const item = byOrder.get(patch.order);
      if (!item || item.status !== "changes_requested") continue;
      await ctx.db.patch(item._id, {
        data: patch.data,
        status: "pending",
        result: undefined,
        updatedAt: now,
      });
      reopened++;
    }
    await ctx.db.insert("taskActivity", {
      taskId,
      type: "items_reopened",
      actorTokenId: args.tokenId,
      data: { reopened },
      createdAt: now,
    });
    const counts = await recomputeProgress(ctx, taskId);
    return { reopened, ...counts };
  },
});

// Recompute itemsDone from the live item rows and drive the task transition:
// full pass + all approved → done; full pass + a sent-back item → stays open
// with a changes_requested badge (the agent's turn); otherwise still in review.
// Returns the fresh counts. Used by setStatus, resumeItemsForAgent, reconcile.
export async function recomputeProgress(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<{ itemsDone: number; itemCount: number }> {
  const task = await ctx.db.get(taskId);
  if (!task) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
  const items = await itemsForTask(ctx, taskId);
  const itemCount = task.itemCount ?? items.length;
  const itemsDone = countSettled(items);
  const fullPass = itemsDone === itemCount && itemCount > 0;
  const allApproved = fullPass && isFullyApproved(items);

  const now = Date.now();
  const rollup = buildRollup(task.type, items);
  await ctx.db.patch(taskId, {
    itemsDone,
    result: rollup,
    resultVersion: task.resultVersion + 1,
    revision: task.revision + 1,
    status: allApproved ? "done" : "open",
    // A completed-but-partial pass badges the card "changes requested" (agent's
    // turn) while it stays open; an incomplete pass clears the badge.
    outcome: allApproved ? "approved" : fullPass ? "changes_requested" : undefined,
    updatedAt: now,
  });
  if (allApproved) {
    await ctx.db.insert("taskActivity", { taskId, type: "completed", createdAt: now });
  }
  return { itemsDone, itemCount };
}
