import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { assertOwnedTask, assertOwnedProject } from "./lib/ownership";
import { ensureDefaultProject, findProjectByName } from "./lib/projectHelpers";
import { assertUploadOwnedBy, attachUploadToTask } from "./files";
import { storageProxyUrl } from "./lib/r2";
import {
  TASK_STATUSES,
  TASK_OUTCOMES,
  viewportValidator,
  toolPayloadValidator,
} from "./schema";
import { isTaskType, TASK_TYPES, RESOLVE_ACTIONS, type ResolveAction } from "./lib/taskConstants";
import { assertDocItemData } from "./lib/render";
import { normalizeTags } from "./lib/tags";
import { rateLimiter } from "./rateLimit";
import { enforceLimit } from "./lib/rateLimitGuard";
import { initialTaskState } from "./lib/deps";
import { maybeNotifyOwner } from "./lib/notifyOwner";
import { resolveDeps, unblockDependents, failDependents } from "./deps";

const statusValidator = v.union(...TASK_STATUSES.map((s) => v.literal(s)));
const outcomeValidator = v.union(...TASK_OUTCOMES.map((o) => v.literal(o)));

// Create-time payload: the agent passes the screenshot id as a raw string,
// which createForAgent normalizes and ownership-checks before storing it as the
// typed `toolPayloadValidator` shape.
const toolPayloadInputValidator = v.object({
  screenshotFileId: v.string(),
  viewports: v.optional(v.array(viewportValidator)),
});

// One mark the human draws on a review surface. Shape-agnostic so the canvas can
// grow (box / arrow / freehand pen / numbered pin) without changing the
// agent-facing contract. `points` is interpreted per shape: box [x,y,w,h],
// arrow [x1,y1,x2,y2], pen [x1,y1,x2,y2,…] (a freehand sketch), pin [x,y].
//
// Discriminated on `surface`: a screenshot mark is placed on a viewport, a doc
// mark on a page. The two surfaces are otherwise identical, but the locator
// differs, so the union keeps each precise (Q7 / Phase 3).
const annotationShape = {
  shape: v.union(v.literal("box"), v.literal("arrow"), v.literal("pen"), v.literal("pin")),
  points: v.array(v.number()),
  label: v.optional(v.number()),
  severity: v.union(v.literal("blocker"), v.literal("nit")),
  comment: v.string(),
};
const screenshotAnnotationValidator = v.object({
  surface: v.literal("screenshot"),
  viewport: viewportValidator,
  ...annotationShape,
});
const docAnnotationValidator = v.object({
  surface: v.literal("doc"),
  page: v.number(),
  ...annotationShape,
});
const annotationValidator = v.union(screenshotAnnotationValidator, docAnnotationValidator);

// Agent-facing payload — snake_case for MCP ergonomics.
const agentViewValidator = v.object({
  task_id: v.id("tasks"),
  project_id: v.id("projects"),
  type: v.string(),
  title: v.string(),
  status: statusValidator,
  outcome: v.union(outcomeValidator, v.null()),
  result: v.any(),
  result_version: v.number(),
  revision: v.number(),
  // Present only on multi-item tasks (ADR-0002).
  item_count: v.union(v.number(), v.null()),
  items_done: v.union(v.number(), v.null()),
});

// Human-facing card payload — the full task as the board renders it.
const taskViewValidator = v.object({
  _id: v.id("tasks"),
  projectId: v.id("projects"),
  type: v.string(),
  title: v.string(),
  instructions: v.string(),
  acceptanceCriteria: v.union(v.string(), v.null()),
  tags: v.array(v.string()),
  status: statusValidator,
  outcome: v.union(outcomeValidator, v.null()),
  result: v.any(),
  // Tool input echoed for the board (e.g. visual_review's screenshot + viewports).
  toolPayload: v.union(toolPayloadValidator, v.null()),
  // Resolved storage-proxy URL for the visual_review screenshot, or null.
  screenshotUrl: v.union(v.string(), v.null()),
  // Multi-item progress for the ItemRail chip (null on single tasks).
  itemCount: v.union(v.number(), v.null()),
  itemsDone: v.union(v.number(), v.null()),
  resultVersion: v.number(),
  revision: v.number(),
  createdByTokenId: v.union(v.id("apiTokens"), v.null()),
  resumedByTokenId: v.union(v.id("apiTokens"), v.null()),
  // Number of tasks this one waits on — drives the blocked lane's lock badge.
  // Counted only for blocked tasks (0 otherwise) to keep the board query cheap.
  depCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.union(v.number(), v.null()),
});

function toAgentView(task: Doc<"tasks">) {
  return {
    task_id: task._id,
    project_id: task.projectId,
    type: task.type,
    title: task.title,
    status: task.status,
    outcome: task.outcome ?? null,
    result: task.result ?? null,
    result_version: task.resultVersion,
    revision: task.revision,
    item_count: task.itemCount ?? null,
    items_done: task.itemsDone ?? null,
  };
}

function toTaskView(task: Doc<"tasks">) {
  return {
    _id: task._id,
    projectId: task.projectId,
    type: task.type,
    title: task.title,
    instructions: task.instructions,
    acceptanceCriteria: task.acceptanceCriteria ?? null,
    tags: task.tags,
    status: task.status,
    outcome: task.outcome ?? null,
    result: task.result ?? null,
    itemCount: task.itemCount ?? null,
    itemsDone: task.itemsDone ?? null,
    resultVersion: task.resultVersion,
    revision: task.revision,
    createdByTokenId: task.createdByTokenId ?? null,
    resumedByTokenId: task.resumedByTokenId ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: task.expiresAt ?? null,
  };
}

// Turn a stored screenshot reference into an embeddable proxy URL for the board.
async function resolveScreenshotUrl(
  ctx: QueryCtx | MutationCtx,
  toolPayload: Doc<"tasks">["toolPayload"],
): Promise<string | null> {
  if (!toolPayload) return null;
  const fileId: Id<"managedFiles"> = toolPayload.screenshotFileId;
  const file = await ctx.db.get(fileId);
  return file ? storageProxyUrl(file.r2Key) : null;
}

// The board view plus the fields that need a lookup: the tool payload and its
// resolved screenshot URL.
async function enrichTaskView(ctx: QueryCtx | MutationCtx, task: Doc<"tasks">) {
  // Only blocked cards surface a dep count; skip the lookup otherwise.
  const depCount =
    task.status === "blocked"
      ? (
          await ctx.db
            .query("taskDeps")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .collect()
        ).length
      : 0;
  return {
    ...toTaskView(task),
    toolPayload: task.toolPayload ?? null,
    screenshotUrl: await resolveScreenshotUrl(ctx, task.toolPayload),
    depCount,
  };
}

// Agents pass raw string ids; resolve to a typed Id or report NOT_FOUND so a
// malformed id never surfaces as a framework validation error.
function requireTaskId(ctx: QueryCtx | MutationCtx, raw: string): Id<"tasks"> {
  const id = ctx.db.normalizeId("tasks", raw);
  if (!id) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
  return id;
}

// First agent read of a resolved task flips Awaiting agent → Agent working.
async function consumeIfResolved(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  tokenId: Id<"apiTokens">,
): Promise<Doc<"tasks">> {
  if (task.status !== "awaiting_agent") return task;
  const now = Date.now();
  await ctx.db.patch(task._id, {
    status: "resumed",
    resumedByTokenId: tokenId,
    resultConsumedAt: now,
    updatedAt: now,
  });
  const updated = await ctx.db.get(task._id);
  if (!updated) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
  return updated;
}

// Resolve a caller-supplied project reference (id or name) to an owned project.
// Unresolved names are rejected — agents spin up new boards via create_project.
async function resolveProjectRef(
  ctx: MutationCtx,
  userId: Id<"users">,
  ref: string | undefined,
): Promise<Id<"projects">> {
  if (!ref || !ref.trim()) return ensureDefaultProject(ctx, userId);
  const asId = ctx.db.normalizeId("projects", ref);
  if (asId) {
    await assertOwnedProject(ctx, asId, userId);
    return asId;
  }
  const byName = await findProjectByName(ctx, userId, ref);
  if (byName) return byName;
  throw new ConvexError({
    code: "NOT_FOUND",
    message: `No project named "${ref}". Create one with create_project, pass an existing project id, or omit to use your default board.`,
  });
}

// ── Agent-facing (trusted userId from token auth, used by MCP tools) ─────────

export const createForAgent = internalMutation({
  args: {
    userId: v.id("users"),
    tokenId: v.id("apiTokens"),
    project: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    instructions: v.string(),
    acceptanceCriteria: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    toolPayload: v.optional(toolPayloadInputValidator),
    // Multi-item (opt-in): each entry becomes a rail item the human reviews in
    // place. `data` is the per-item surface payload (e.g. a doc render spec).
    items: v.optional(
      v.array(v.object({ title: v.optional(v.string()), data: v.optional(v.any()) })),
    ),
    // DAG: ids of owned, same-project tasks this one waits on. The task starts
    // `blocked` until every dep is approved (and notBefore passes).
    dependsOn: v.optional(v.array(v.string())),
    notBefore: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    ttlSeconds: v.optional(v.number()),
  },
  returns: v.object({ task: agentViewValidator, reused: v.boolean() }),
  handler: async (ctx, args) => {
    if (!isTaskType(args.type)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Unsupported task type "${args.type}". Supported: ${TASK_TYPES.join(", ")}.`,
      });
    }

    // A visual_review must carry a screenshot; no other type accepts a payload.
    if (args.type === "visual_review" && !args.toolPayload?.screenshotFileId) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message:
          "visual_review requires tool_payload.screenshotFileId — upload one with upload_screenshot first.",
      });
    }
    if (args.type !== "visual_review" && args.toolPayload) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `tool_payload is only valid for visual_review tasks, not "${args.type}".`,
      });
    }

    // A multi-item task carries its surface per item, not in tool_payload.
    const items = args.items && args.items.length > 0 ? args.items : undefined;
    if (items && args.toolPayload) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Pass either items[] (multi-item) or tool_payload (single), not both.",
      });
    }

    // A doc_review carries one render spec per item (even a single doc is a
    // one-item rail) — there's no tool_payload surface for it.
    if (args.type === "doc_review") {
      if (!items) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "doc_review requires items[] — one render spec per document.",
        });
      }
      items.forEach((item, i) => assertDocItemData(item.data, `items[${i}]`));
    }

    // Idempotency: a retried create with the same key returns the first row.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_idempotency", (q) =>
          q.eq("userId", args.userId).eq("idempotencyKey", args.idempotencyKey),
        )
        .first();
      if (existing) return { task: toAgentView(existing), reused: true };
    }

    // Per-agent create backstop (fail-open). Charged only for a real create —
    // after the idempotency short-circuit, so retries don't burn the budget.
    await enforceLimit(
      () => rateLimiter.limit(ctx, "createTask", { key: args.tokenId }),
      "create_task",
    );

    const projectId = await resolveProjectRef(ctx, args.userId, args.project);

    // Resolve the screenshot before inserting so an invalid/unowned file id
    // never produces a half-formed task. (After the idempotency check, so a
    // retry doesn't trip over its own already-consumed upload claim.)
    const screenshotFile =
      args.type === "visual_review" && args.toolPayload
        ? await assertUploadOwnedBy(ctx, args.userId, args.toolPayload.screenshotFileId)
        : null;
    const toolPayload = screenshotFile
      ? { screenshotFileId: screenshotFile._id, viewports: args.toolPayload?.viewports }
      : undefined;

    const now = Date.now();
    const expiresAt =
      args.ttlSeconds && args.ttlSeconds > 0 ? now + args.ttlSeconds * 1000 : undefined;

    // Resolve + validate deps, then derive the birth state: born `done`/
    // dependency_failed if any dep already failed, `blocked` while a dep is
    // unapproved or notBefore is future, else `open`.
    const deps = await resolveDeps(ctx, args.userId, projectId, args.dependsOn);
    const initial = initialTaskState(deps, args.notBefore, now);

    const taskId = await ctx.db.insert("tasks", {
      userId: args.userId,
      projectId,
      createdByTokenId: args.tokenId,
      type: args.type,
      title: args.title,
      instructions: args.instructions,
      acceptanceCriteria: args.acceptanceCriteria,
      tags: normalizeTags(args.tags),
      status: initial.status,
      outcome: "outcome" in initial ? initial.outcome : undefined,
      toolPayload,
      itemCount: items ? items.length : undefined,
      itemsDone: items ? 0 : undefined,
      notBefore: args.notBefore,
      resultVersion: 0,
      revision: 0,
      idempotencyKey: args.idempotencyKey,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    for (const dep of deps) {
      await ctx.db.insert("taskDeps", { taskId, dependsOnTaskId: dep._id, createdAt: now });
    }

    if (items) {
      for (const [order, item] of items.entries()) {
        await ctx.db.insert("taskItems", {
          taskId,
          order,
          kind: args.type,
          title: item.title,
          data: item.data,
          status: "pending",
          createdAt: now,
        });
      }
    }

    if (screenshotFile) await attachUploadToTask(ctx, screenshotFile, taskId);

    await ctx.db.insert("taskActivity", {
      taskId,
      type: "created",
      actorTokenId: args.tokenId,
      createdAt: now,
    });
    if (expiresAt) await ctx.scheduler.runAt(expiresAt, internal.tasks.expire, { taskId });
    // A future notBefore needs a timer to release the task even if its deps are
    // already satisfied; dep-driven release goes through unblockDependents.
    if (initial.status === "blocked" && args.notBefore && args.notBefore > now) {
      await ctx.scheduler.runAt(args.notBefore, internal.deps.unblockCheck, { taskId });
    }
    // Only an immediately-actionable (open) task pings the human; blocked and
    // born-failed tasks don't.
    if (initial.status === "open") await maybeNotifyOwner(ctx, args.userId, taskId, now);

    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
    return { task: toAgentView(task), reused: false };
  },
});

// get_task / await_task consume point: flips a resolved task to Agent working.
export const consumeForAgent = internalMutation({
  args: { userId: v.id("users"), tokenId: v.id("apiTokens"), taskId: v.string() },
  returns: agentViewValidator,
  handler: async (ctx, args) => {
    const task = await assertOwnedTask(ctx, requireTaskId(ctx, args.taskId), args.userId);
    const consumed = await consumeIfResolved(ctx, task, args.tokenId);
    return toAgentView(consumed);
  },
});

// Read-only status probe for the await_task long-poll (never mutates).
// `awaitReady` is the wake signal: a single task is ready once it leaves the
// human's hands; a multi-item task is also ready on a full pass (itemsDone ===
// itemCount) even though it stays `open` for the next round (ADR-0002).
export const statusForAgent = internalQuery({
  args: { userId: v.id("users"), taskId: v.string() },
  returns: v.object({
    status: statusValidator,
    outcome: v.union(outcomeValidator, v.null()),
    revision: v.number(),
    awaitReady: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const task = await assertOwnedTask(ctx, requireTaskId(ctx, args.taskId), args.userId);
    const left = task.status === "awaiting_agent" || task.status === "resumed";
    const fullPass = task.itemCount !== undefined && (task.itemsDone ?? 0) === task.itemCount;
    const awaitReady = left || task.status === "done" || fullPass;
    return {
      status: task.status,
      outcome: task.outcome ?? null,
      revision: task.revision,
      awaitReady,
    };
  },
});

export const cancelForAgent = internalMutation({
  args: {
    userId: v.id("users"),
    tokenId: v.id("apiTokens"),
    taskId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: agentViewValidator,
  handler: async (ctx, args) => {
    const taskId = requireTaskId(ctx, args.taskId);
    const task = await assertOwnedTask(ctx, taskId, args.userId);
    if (task.status === "done") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Task is already resolved and cannot be cancelled.",
      });
    }
    const now = Date.now();
    await ctx.db.patch(taskId, {
      status: "done",
      outcome: "cancelled",
      result: { decision: "cancelled", reason: args.reason ?? null },
      resultVersion: task.resultVersion + 1,
      revision: task.revision + 1,
      updatedAt: now,
    });
    await ctx.db.insert("taskActivity", {
      taskId,
      type: "cancelled",
      actorTokenId: args.tokenId,
      createdAt: now,
    });
    await failDependents(ctx, taskId, now);
    const updated = await ctx.db.get(taskId);
    if (!updated) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
    return toAgentView(updated);
  },
});

export const listForAgent = internalQuery({
  args: {
    userId: v.id("users"),
    project: v.optional(v.string()),
    status: v.optional(statusValidator),
    tags: v.optional(v.array(v.string())),
    tokenId: v.optional(v.id("apiTokens")),
  },
  returns: v.array(agentViewValidator),
  handler: async (ctx, args) => {
    let rows: Doc<"tasks">[];
    if (args.project) {
      const projectId = ctx.db.normalizeId("projects", args.project);
      if (!projectId) return [];
      const project = await ctx.db.get(projectId);
      if (!project || project.userId !== args.userId) return [];
      rows = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    } else {
      rows = await ctx.db
        .query("tasks")
        .withIndex("by_user_status", (q) => q.eq("userId", args.userId))
        .collect();
    }
    const tags = args.tags;
    return rows
      .filter((t) => (args.status ? t.status === args.status : true))
      .filter((t) => (args.tokenId ? t.createdByTokenId === args.tokenId : true))
      .filter((t) => (tags && tags.length > 0 ? tags.every((tag) => t.tags.includes(tag)) : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toAgentView);
  },
});

// ── Human-facing (session-authenticated, used by the frontend) ──────────────

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(taskViewValidator),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedProject(ctx, args.projectId, userId);
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sorted.map((task) => enrichTaskView(ctx, task)));
  },
});

// Accepts a raw string id (push deep-links pass `?task=<id>` unvalidated) and
// returns null — never throws — for a malformed, missing, or not-owned task, so
// clicking a stale/foreign notification shows the empty state instead of
// crashing the board. Null is identical for "gone" and "not yours": no leak.
export const get = query({
  args: { taskId: v.string() },
  returns: v.union(taskViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) return null;
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId) return null;
    return enrichTaskView(ctx, task);
  },
});

// Maps a human resolution action onto the status/outcome machine.
const RESOLUTION: Record<
  ResolveAction,
  { status: Doc<"tasks">["status"]; outcome: Doc<"tasks">["outcome"] }
> = {
  approve: { status: "awaiting_agent", outcome: "approved" },
  request_changes: { status: "awaiting_agent", outcome: "changes_requested" },
  cancel: { status: "done", outcome: "cancelled" },
};

export const resolve = mutation({
  args: {
    taskId: v.id("tasks"),
    action: v.union(...RESOLVE_ACTIONS.map((a) => v.literal(a))),
    comment: v.optional(v.string()),
    annotations: v.optional(v.array(annotationValidator)),
    revision: v.number(),
  },
  returns: taskViewValidator,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await assertOwnedTask(ctx, args.taskId, userId);

    // Review happens in-place on an open task; reject stale or repeat resolves.
    if (task.status !== "open") {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Task is "${task.status}", not awaiting review.`,
      });
    }
    if (args.revision !== task.revision) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Task changed since you loaded it. Reload and try again.",
      });
    }
    if (args.annotations && args.annotations.length > 0) {
      // resolve() is the single-task path; only visual_review marks up here, and
      // only on the screenshot surface. (doc_review marks flow per-item through
      // items.setStatus.)
      if (task.type !== "visual_review") {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "annotations are only valid for visual_review tasks.",
        });
      }
      if (args.annotations.some((a) => a.surface !== "screenshot")) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "visual_review annotations must be on the screenshot surface.",
        });
      }
    }

    const mapping = RESOLUTION[args.action];
    const now = Date.now();
    const resultVersion = task.resultVersion + 1;
    // visual_review returns tool-tagged, structured feedback (the annotations
    // the human drew); every other type returns the plain decision + comment.
    // A cancel always falls back to the plain shape — there's nothing to mark up.
    const result =
      task.type === "visual_review" && args.action !== "cancel"
        ? {
            result_version: resultVersion,
            tool: "visual_review" as const,
            decision: mapping.outcome,
            annotations: args.annotations ?? [],
            comment: args.comment ?? null,
          }
        : { decision: mapping.outcome, comment: args.comment ?? null };
    await ctx.db.patch(args.taskId, {
      status: mapping.status,
      outcome: mapping.outcome,
      result,
      resultVersion,
      revision: task.revision + 1,
      updatedAt: now,
    });
    await ctx.db.insert("taskAudit", {
      taskId: args.taskId,
      userId,
      action: args.action,
      fromStatus: "open",
      toStatus: mapping.status,
      outcome: mapping.outcome ?? undefined,
      revision: task.revision + 1,
      createdAt: now,
    });
    // Propagate to the DAG: an approval may release blocked dependents; a cancel
    // is a terminal failure that fails the blocked subtree below it.
    if (args.action === "approve") await unblockDependents(ctx, args.taskId);
    else if (args.action === "cancel") await failDependents(ctx, args.taskId, now);
    const updated = await ctx.db.get(args.taskId);
    if (!updated) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
    return enrichTaskView(ctx, updated);
  },
});

// Human-set tags from the board. Normalized on write (trim/lowercase/dedupe/cap)
// so agent- and human-supplied tags share one hygiene path.
export const setTags = mutation({
  args: { taskId: v.id("tasks"), tags: v.array(v.string()) },
  returns: taskViewValidator,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedTask(ctx, args.taskId, userId);
    await ctx.db.patch(args.taskId, { tags: normalizeTags(args.tags), updatedAt: Date.now() });
    const updated = await ctx.db.get(args.taskId);
    if (!updated) throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
    return enrichTaskView(ctx, updated);
  },
});

// Human archive: Agent working → Done.
export const close = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await assertOwnedTask(ctx, args.taskId, userId);
    if (task.status !== "resumed") {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Only a resumed task can be closed (was "${task.status}").`,
      });
    }
    const now = Date.now();
    await ctx.db.patch(args.taskId, { status: "done", updatedAt: now });
    await ctx.db.insert("taskAudit", {
      taskId: args.taskId,
      userId,
      action: "close",
      fromStatus: "resumed",
      toStatus: "done",
      createdAt: now,
    });
    return null;
  },
});

// Scheduler TTL handler — no-op unless the task is still open or blocked.
export const expire = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    if (task.status !== "open" && task.status !== "blocked") return null;
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "done",
      outcome: "expired",
      resultVersion: task.resultVersion + 1,
      revision: task.revision + 1,
      updatedAt: now,
    });
    await ctx.db.insert("taskActivity", { taskId: args.taskId, type: "expired", createdAt: now });
    await failDependents(ctx, args.taskId, now);
    return null;
  },
});
