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

const statusValidator = v.union(...TASK_STATUSES.map((s) => v.literal(s)));
const outcomeValidator = v.union(...TASK_OUTCOMES.map((o) => v.literal(o)));

// Create-time payload: the agent passes the screenshot id as a raw string,
// which createForAgent normalizes and ownership-checks before storing it as the
// typed `toolPayloadValidator` shape.
const toolPayloadInputValidator = v.object({
  screenshotFileId: v.string(),
  viewports: v.optional(v.array(viewportValidator)),
});

// One mark the human draws on the screenshot. Shape-agnostic so the canvas can
// grow (box / arrow / freehand pen / numbered pin) without changing the
// agent-facing contract. `points` is interpreted per shape: box [x,y,w,h],
// arrow [x1,y1,x2,y2], pen [x1,y1,x2,y2,…] (a freehand sketch), pin [x,y].
const annotationValidator = v.object({
  shape: v.union(v.literal("box"), v.literal("arrow"), v.literal("pen"), v.literal("pin")),
  points: v.array(v.number()),
  label: v.optional(v.number()),
  viewport: viewportValidator,
  severity: v.union(v.literal("blocker"), v.literal("nit")),
  comment: v.string(),
});

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
  resultVersion: v.number(),
  revision: v.number(),
  createdByTokenId: v.union(v.id("apiTokens"), v.null()),
  resumedByTokenId: v.union(v.id("apiTokens"), v.null()),
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
  return {
    ...toTaskView(task),
    toolPayload: task.toolPayload ?? null,
    screenshotUrl: await resolveScreenshotUrl(ctx, task.toolPayload),
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

// One push per user per window, so a burst of task creates doesn't fire a
// notification for each. `lastNotifiedAt` on the user is the throttle clock.
const PUSH_THROTTLE_MS = 15_000;

async function maybeNotifyOwner(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
  now: number,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (user && now - (user.lastNotifiedAt ?? 0) < PUSH_THROTTLE_MS) return;
  await ctx.db.patch(userId, { lastNotifiedAt: now });
  // Best-effort: the notify action is a no-op when push isn't configured.
  await ctx.scheduler.runAfter(0, internal.notify.push, { taskId });
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

    const taskId = await ctx.db.insert("tasks", {
      userId: args.userId,
      projectId,
      createdByTokenId: args.tokenId,
      type: args.type,
      title: args.title,
      instructions: args.instructions,
      acceptanceCriteria: args.acceptanceCriteria,
      tags: args.tags ?? [],
      status: "open",
      toolPayload,
      resultVersion: 0,
      revision: 0,
      idempotencyKey: args.idempotencyKey,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    if (screenshotFile) await attachUploadToTask(ctx, screenshotFile, taskId);

    await ctx.db.insert("taskActivity", {
      taskId,
      type: "created",
      actorTokenId: args.tokenId,
      createdAt: now,
    });
    if (expiresAt) await ctx.scheduler.runAt(expiresAt, internal.tasks.expire, { taskId });
    await maybeNotifyOwner(ctx, args.userId, taskId, now);

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
export const statusForAgent = internalQuery({
  args: { userId: v.id("users"), taskId: v.string() },
  returns: v.object({
    status: statusValidator,
    outcome: v.union(outcomeValidator, v.null()),
    revision: v.number(),
  }),
  handler: async (ctx, args) => {
    const task = await assertOwnedTask(ctx, requireTaskId(ctx, args.taskId), args.userId);
    return { status: task.status, outcome: task.outcome ?? null, revision: task.revision };
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

export const get = query({
  args: { taskId: v.id("tasks") },
  returns: v.union(taskViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await assertOwnedTask(ctx, args.taskId, userId);
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
    if (args.annotations && args.annotations.length > 0 && task.type !== "visual_review") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "annotations are only valid for visual_review tasks.",
      });
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
    await ctx.db.patch(args.taskId, { status: "done", updatedAt: Date.now() });
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
    return null;
  },
});
