import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { assertOwnedProject } from "./lib/ownership";
import {
  MAX_PREFS_PER_SCOPE,
  normalizePrefKey,
  normalizePrefValue,
  resolvePreferences,
} from "./lib/preferences";

const prefViewValidator = v.object({
  _id: v.id("preferences"),
  // null = the user-level fallback row (applies across every board).
  projectId: v.union(v.id("projects"), v.null()),
  key: v.string(),
  value: v.string(),
  updatedAt: v.number(),
});

function toPrefView(row: Doc<"preferences">) {
  return {
    _id: row._id,
    projectId: row.projectId ?? null,
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt,
  };
}

// All rows in one scope: a specific project, or the user-level fallback
// (projectId undefined). The index prefix [userId, projectId] returns the scope.
function scopeRows(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects"> | undefined,
) {
  return ctx.db
    .query("preferences")
    .withIndex("by_scope_key", (q) => q.eq("userId", userId).eq("projectId", projectId))
    .collect();
}

export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    // Omit for a user-level rule; pass a project to scope (and override) it there.
    projectId: v.optional(v.id("projects")),
  },
  returns: prefViewValidator,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.projectId) await assertOwnedProject(ctx, args.projectId, userId);
    const key = normalizePrefKey(args.key);
    const value = normalizePrefValue(args.value);
    const now = Date.now();

    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_scope_key", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId).eq("key", key),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: now });
      return toPrefView({ ...existing, value, updatedAt: now });
    }

    const rows = await scopeRows(ctx, userId, args.projectId);
    if (rows.length >= MAX_PREFS_PER_SCOPE) {
      throw new ConvexError({
        code: "LIMIT_EXCEEDED",
        message: `A scope holds at most ${MAX_PREFS_PER_SCOPE} preferences.`,
      });
    }
    const id = await ctx.db.insert("preferences", {
      userId,
      projectId: args.projectId,
      key,
      value,
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new ConvexError({ code: "NOT_FOUND", message: "Preference not found" });
    return toPrefView(created);
  },
});

export const list = query({
  args: {},
  returns: v.array(prefViewValidator),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(toPrefView);
  },
});

export const remove = mutation({
  args: { preferenceId: v.id("preferences") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(args.preferenceId);
    if (!row || row.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Preference not found" });
    }
    await ctx.db.delete(args.preferenceId);
    return null;
  },
});

// Flatten a project's effective preferences for an agent: user-level fallback
// overlaid by the project's own rows. Used by get_task (NOT a Convex function —
// a helper the agent-facing mutation calls inline).
export async function resolveForProject(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Record<string, string>> {
  const userRows = await scopeRows(ctx, userId, undefined);
  const projectRows = await scopeRows(ctx, userId, projectId);
  return resolvePreferences(userRows, projectRows);
}
