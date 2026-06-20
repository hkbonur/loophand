import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { assertOwnedProject } from "./lib/ownership";
import { nextSlot, isValidCron, isValidTimezone } from "./lib/cron";
import { isTaskType, TASK_TYPES } from "./lib/taskConstants";

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

// Validate cron / timezone / task type, throwing a clear error for each.
function assertValidSchedule(cron: string, timezone: string, type: string): void {
  if (!isValidCron(cron)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `Invalid cron expression "${cron}".` });
  }
  if (!isValidTimezone(timezone)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `Unknown timezone "${timezone}".` });
  }
  if (!isTaskType(type)) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Unsupported task type "${type}". Supported: ${TASK_TYPES.join(", ")}.`,
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
