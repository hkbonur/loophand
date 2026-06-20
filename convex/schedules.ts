import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { assertOwnedProject } from "./lib/ownership";
import { ensureDefaultProject } from "./lib/projectHelpers";
import { nextSlot, isValidCron, isValidTimezone } from "./lib/cron";
import { normalizeTags } from "./lib/tags";
import { maybeNotifyOwner } from "./lib/notifyOwner";
import { insertTaskRecord } from "./lib/taskInsert";

// How many due schedules one tick materializes (full quotas in Phase 6).
const TICK_BATCH = 100;

// The create_task payload a schedule materializes each slot. Validated here so a
// bad template is rejected at schedule-create rather than failing every tick.
const templateValidator = v.object({
  type: v.string(),
  title: v.string(),
  instructions: v.string(),
  acceptanceCriteria: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
});

const scheduleView = v.object({
  _id: v.id("schedules"),
  name: v.string(),
  cron: v.string(),
  timezone: v.string(),
  skipIfPrevOpen: v.boolean(),
  enabled: v.boolean(),
  projectId: v.union(v.id("projects"), v.null()),
  nextRunAt: v.number(),
  lastMaterializedSlot: v.union(v.number(), v.null()),
  createdAt: v.number(),
});

// Validate cron / timezone / task type. Schedules are approval-only: the other
// types need a per-run payload (a screenshot, render specs) a template can't
// carry, so they're rejected here rather than failing at materialize time.
function assertValidSchedule(cron: string, timezone: string, type: string): void {
  if (!isValidCron(cron)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `Invalid cron expression "${cron}".` });
  }
  if (!isValidTimezone(timezone)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `Unknown timezone "${timezone}".` });
  }
  if (type !== "approval") {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Scheduled tasks support only the approval type.",
    });
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    cron: v.string(),
    timezone: v.string(),
    taskTemplate: templateValidator,
    skipIfPrevOpen: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.id("schedules"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    assertValidSchedule(args.cron, args.timezone, args.taskTemplate.type);
    if (args.projectId) await assertOwnedProject(ctx, args.projectId, userId);

    const now = Date.now();
    return ctx.db.insert("schedules", {
      userId,
      projectId: args.projectId,
      name: args.name.trim() || "Schedule",
      taskTemplate: args.taskTemplate,
      cron: args.cron,
      timezone: args.timezone,
      skipIfPrevOpen: args.skipIfPrevOpen ?? false,
      nextRunAt: nextSlot(args.cron, args.timezone, now),
      enabled: true,
      createdAt: now,
    });
  },
});

// Agent path (trusted userId + tokenId from token auth): create_task with a
// schedule_cron lands here instead of creating a one-off task.
export const createScheduleForAgent = internalMutation({
  args: {
    userId: v.id("users"),
    tokenId: v.id("apiTokens"),
    project: v.optional(v.string()),
    name: v.optional(v.string()),
    cron: v.string(),
    timezone: v.optional(v.string()),
    skipIfPrevOpen: v.optional(v.boolean()),
    taskTemplate: templateValidator,
  },
  returns: v.object({ schedule_id: v.id("schedules"), next_run_at: v.number() }),
  handler: async (ctx, args) => {
    const timezone = args.timezone ?? "UTC";
    assertValidSchedule(args.cron, timezone, args.taskTemplate.type);

    let projectId: Id<"projects"> | undefined;
    if (args.project) {
      const pid = ctx.db.normalizeId("projects", args.project);
      if (!pid) throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
      await assertOwnedProject(ctx, pid, args.userId);
      projectId = pid;
    }

    const now = Date.now();
    const nextRunAt = nextSlot(args.cron, timezone, now);
    const id = await ctx.db.insert("schedules", {
      userId: args.userId,
      projectId,
      createdByTokenId: args.tokenId,
      name: args.name?.trim() || args.taskTemplate.title,
      taskTemplate: args.taskTemplate,
      cron: args.cron,
      timezone,
      skipIfPrevOpen: args.skipIfPrevOpen ?? false,
      nextRunAt,
      enabled: true,
      createdAt: now,
    });
    return { schedule_id: id, next_run_at: nextRunAt };
  },
});

export const list = query({
  args: {},
  returns: v.array(scheduleView),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("schedules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        cron: s.cron,
        timezone: s.timezone,
        skipIfPrevOpen: s.skipIfPrevOpen,
        enabled: s.enabled,
        projectId: s.projectId ?? null,
        nextRunAt: s.nextRunAt,
        lastMaterializedSlot: s.lastMaterializedSlot ?? null,
        createdAt: s.createdAt,
      }));
  },
});

export const setEnabled = mutation({
  args: { id: v.id("schedules"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const schedule = await ctx.db.get(args.id);
    if (!schedule || schedule.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Schedule not found" });
    }
    // Re-enabling jumps to the next future slot so a long-disabled schedule
    // doesn't backfill a burst when switched back on.
    const nextRunAt = args.enabled
      ? nextSlot(schedule.cron, schedule.timezone, Date.now())
      : schedule.nextRunAt;
    await ctx.db.patch(args.id, { enabled: args.enabled, nextRunAt });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("schedules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const schedule = await ctx.db.get(args.id);
    if (!schedule || schedule.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Schedule not found" });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// ── Materialization (cron tick) ──────────────────────────────────────────────

// The per-slot idempotency key. A repeat tick for the same slot can't create a
// second task (createForAgent-style dedup on userId + key).
function slotKey(scheduleId: Id<"schedules">, slot: number): string {
  return `sched:${scheduleId}:${slot}`;
}

// Create one approval task for a due slot, idempotently. Approval-only, so the
// insert is a plain open task — no payload, items, or deps.
async function materializeScheduledTask(
  ctx: MutationCtx,
  schedule: Doc<"schedules">,
  slot: number,
): Promise<void> {
  const idempotencyKey = slotKey(schedule._id, slot);
  const existing = await ctx.db
    .query("tasks")
    .withIndex("by_idempotency", (q) =>
      q.eq("userId", schedule.userId).eq("idempotencyKey", idempotencyKey),
    )
    .first();
  if (existing) return;

  const tpl = schedule.taskTemplate as {
    type: string;
    title: string;
    instructions: string;
    acceptanceCriteria?: string;
    tags?: string[];
  };
  const projectId = schedule.projectId ?? (await ensureDefaultProject(ctx, schedule.userId));
  const now = Date.now();
  const taskId = await insertTaskRecord(ctx, {
    userId: schedule.userId,
    projectId,
    createdByTokenId: schedule.createdByTokenId,
    type: "approval",
    title: tpl.title,
    instructions: tpl.instructions,
    acceptanceCriteria: tpl.acceptanceCriteria,
    tags: normalizeTags(tpl.tags),
    status: "open",
    resultVersion: 0,
    revision: 0,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });
  await maybeNotifyOwner(ctx, schedule.userId, taskId, now);
}

// Is a schedule's board/token still alive? A gone project or revoked token means
// the schedule can never produce a valid task — auto-disable rather than error
// every minute.
async function scheduleIsAlive(ctx: MutationCtx, schedule: Doc<"schedules">): Promise<boolean> {
  if (schedule.projectId) {
    const project = await ctx.db.get(schedule.projectId);
    if (!project || project.userId !== schedule.userId) return false;
  }
  if (schedule.createdByTokenId) {
    const token = await ctx.db.get(schedule.createdByTokenId);
    if (!token || token.revokedAt) return false;
  }
  return true;
}

// Minute cron: materialize one task per due slot. Idempotency hinges on
// advancing nextRunAt to the next FUTURE slot BEFORE creating (so a slow/retried
// tick can't double-fire) and on the per-slot key. Backfill is bounded — after
// downtime nextRunAt jumps past `now`, so exactly one catch-up task is made, not
// a replayed burst. skipIfPrevOpen drops a slot whose prior task is unresolved.
export const tick = internalMutation({
  args: {},
  returns: v.object({ materialized: v.number(), disabled: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("schedules")
      .withIndex("by_next_run", (q) => q.lte("nextRunAt", now))
      .take(TICK_BATCH);

    let materialized = 0;
    let disabled = 0;
    for (const schedule of due) {
      if (!schedule.enabled) continue;
      if (!(await scheduleIsAlive(ctx, schedule))) {
        await ctx.db.patch(schedule._id, { enabled: false });
        disabled++;
        continue;
      }

      const slot = schedule.nextRunAt;
      const next = nextSlot(schedule.cron, schedule.timezone, now);

      // Skip this slot if the previous materialized task is still unresolved.
      let skip = false;
      if (schedule.skipIfPrevOpen && schedule.lastMaterializedSlot !== undefined) {
        const prev = await ctx.db
          .query("tasks")
          .withIndex("by_idempotency", (q) =>
            q
              .eq("userId", schedule.userId)
              .eq("idempotencyKey", slotKey(schedule._id, schedule.lastMaterializedSlot as number)),
          )
          .first();
        if (prev && (prev.status === "open" || prev.status === "blocked")) skip = true;
      }

      // Advance first — even when skipping — so this slot is never re-fired.
      await ctx.db.patch(schedule._id, {
        nextRunAt: next,
        lastMaterializedSlot: skip ? schedule.lastMaterializedSlot : slot,
      });
      if (skip) continue;

      await materializeScheduledTask(ctx, schedule, slot);
      materialized++;
    }
    return { materialized, disabled };
  },
});
