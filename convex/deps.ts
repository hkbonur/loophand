import { v, ConvexError } from "convex/values";
import {
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { assertOwnedTask } from "./lib/ownership";
import { canUnblock } from "./lib/deps";
import { maybeNotifyOwner } from "./lib/notifyOwner";
import { TASK_STATUSES, TASK_OUTCOMES } from "./schema";

// The task DAG plumbing (Phase 5): create-time validation, the unblock decision,
// and the failure cascade. Pure lifecycle rules live in lib/deps; this is the
// DB-coupled orchestration, kept out of tasks.ts to hold that file's size down.

const statusValidator = v.union(...TASK_STATUSES.map((s) => v.literal(s)));
const outcomeValidator = v.union(...TASK_OUTCOMES.map((o) => v.literal(o)));

// Cap on a task's declared dependencies (full quotas land in Phase 6).
export const MAX_DEPS = 50;
// Backstop on a single failure cascade's fan-out.
const MAX_CASCADE = 1000;

// Compact neighbour in the dependency mini-view (a blocker or a blocked task).
const depEntryValidator = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  status: statusValidator,
  outcome: v.union(outcomeValidator, v.null()),
});

function toDepEntry(task: Doc<"tasks">) {
  return { _id: task._id, title: task.title, status: task.status, outcome: task.outcome ?? null };
}

// Resolve and validate a task's declared dependencies. Each must be an owned
// task in the SAME project — a cross-project (or cross-user) reference is an
// isolation leak, so this is a security check, not just UX. Not-owned/unknown
// ids report NOT_FOUND (no existence leak); a wrong-project dep is a clear
// validation error (same user, nothing to hide). Cycles can't form: a new task
// has no inbound edges, so its deps only ever point at older tasks.
export async function resolveDeps(
  ctx: MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
  rawIds: string[] | undefined,
): Promise<Doc<"tasks">[]> {
  if (!rawIds || rawIds.length === 0) return [];
  if (rawIds.length > MAX_DEPS) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `A task can declare at most ${MAX_DEPS} dependencies.`,
    });
  }
  const seen = new Set<string>();
  const deps: Doc<"tasks">[] = [];
  for (const raw of rawIds) {
    const id = ctx.db.normalizeId("tasks", raw);
    if (!id) throw new ConvexError({ code: "NOT_FOUND", message: `Dependency "${raw}" not found.` });
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = await ctx.db.get(id);
    if (!dep || dep.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: `Dependency "${raw}" not found.` });
    }
    if (dep.projectId !== projectId) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Dependencies must be in the same project as the task.",
      });
    }
    deps.push(dep);
  }
  return deps;
}

// Freshly read a task's dependency tasks from its edges — never a counter. The
// unblock decision re-reads these in-transaction so two deps finishing at once
// can't wedge a dependent (the crux race).
async function readDeps(ctx: QueryCtx | MutationCtx, taskId: Id<"tasks">): Promise<Doc<"tasks">[]> {
  const edges = await ctx.db
    .query("taskDeps")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  const deps: Doc<"tasks">[] = [];
  for (const edge of edges) {
    const dep = await ctx.db.get(edge.dependsOnTaskId);
    if (dep) deps.push(dep);
  }
  return deps;
}

// Open one blocked task if its deps (freshly re-read) are all approved and its
// notBefore has passed. The single place that decides a release — shared by the
// notBefore timer (unblockCheck) and the on-approval sweep (unblockDependents) —
// so the fresh-read rule can't drift between them.
async function tryOpenIfReady(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<void> {
  if (task.status !== "blocked") return;
  const deps = await readDeps(ctx, task._id);
  if (!canUnblock(deps, task.notBefore, now)) return;
  await ctx.db.patch(task._id, { status: "open", updatedAt: now });
  await maybeNotifyOwner(ctx, task.userId, task._id, now);
}

// A dep just became approved: re-check each blocked dependent against ALL its
// deps and open the ones now satisfied. Re-reading every dep — rather than
// trusting a counter — is what makes two deps finishing at once resolve
// correctly instead of wedging a dependent blocked forever.
export async function unblockDependents(ctx: MutationCtx, taskId: Id<"tasks">): Promise<void> {
  const edges = await ctx.db
    .query("taskDeps")
    .withIndex("by_dependsOn", (q) => q.eq("dependsOnTaskId", taskId))
    .collect();
  const now = Date.now();
  for (const edge of edges) {
    const dependent = await ctx.db.get(edge.taskId);
    if (dependent) await tryOpenIfReady(ctx, dependent, now);
  }
}

// A task failed terminally: fail every still-blocked dependent
// (dependency_failed) and cascade down the DAG. Only blocked dependents are
// touched — one that already cleared the gate (open/resumed/done) has moved on.
// Iterative + capped so a deep or diamond-shaped DAG can't blow the stack or
// fan out unbounded; a node reached twice is skipped on the second visit (it's
// no longer blocked), so diamonds converge.
export async function failDependents(
  ctx: MutationCtx,
  rootTaskId: Id<"tasks">,
  now: number,
): Promise<void> {
  const queue: Id<"tasks">[] = [rootTaskId];
  let processed = 0;
  while (queue.length > 0 && processed < MAX_CASCADE) {
    const current = queue.shift() as Id<"tasks">;
    const edges = await ctx.db
      .query("taskDeps")
      .withIndex("by_dependsOn", (q) => q.eq("dependsOnTaskId", current))
      .collect();
    for (const edge of edges) {
      const dependent = await ctx.db.get(edge.taskId);
      if (!dependent || dependent.status !== "blocked") continue;
      await ctx.db.patch(dependent._id, {
        status: "done",
        outcome: "dependency_failed",
        resultVersion: dependent.resultVersion + 1,
        revision: dependent.revision + 1,
        updatedAt: now,
      });
      await ctx.db.insert("taskActivity", {
        taskId: dependent._id,
        type: "dependency_failed",
        createdAt: now,
      });
      queue.push(dependent._id);
      processed++;
    }
  }
}

// Release a blocked task once every dep is approved and notBefore has passed.
// Fired by the notBefore timer and by unblockDependents; both re-read deps fresh
// (canUnblock), so a concurrent dep completion can't wedge the task. Idempotent:
// a no-longer-blocked task is left untouched.
export const unblockCheck = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (task) await tryOpenIfReady(ctx, task, Date.now());
    return null;
  },
});

// Dependency neighbours for the card dialog's mini-view: what this task waits on
// (blockedBy) and what waits on it (blocks). Owner-checked.
export const forTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    blockedBy: v.array(depEntryValidator),
    blocks: v.array(depEntryValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedTask(ctx, args.taskId, userId);

    const blockerEdges = await ctx.db
      .query("taskDeps")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    const dependentEdges = await ctx.db
      .query("taskDeps")
      .withIndex("by_dependsOn", (q) => q.eq("dependsOnTaskId", args.taskId))
      .collect();

    const resolve = async (ids: Array<Id<"tasks">>) => {
      const rows = [];
      for (const id of ids) {
        const row = await ctx.db.get(id);
        if (row) rows.push(toDepEntry(row));
      }
      return rows;
    };

    return {
      blockedBy: await resolve(blockerEdges.map((e) => e.dependsOnTaskId)),
      blocks: await resolve(dependentEdges.map((e) => e.taskId)),
    };
  },
});
