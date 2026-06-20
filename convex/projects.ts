import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { assertOwnedProject } from "./lib/ownership";
import { ensureDefaultProject, createProject, listProjects } from "./lib/projectHelpers";

const projectShape = v.object({
  _id: v.id("projects"),
  name: v.string(),
  isDefault: v.boolean(),
  createdAt: v.number(),
});

// ── Public (session-authenticated, used by the frontend) ───────────────────

export const list = query({
  args: {},
  returns: v.array(projectShape),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return listProjects(ctx, userId);
  },
});

export const ensureDefault = mutation({
  args: {},
  returns: v.id("projects"),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return ensureDefaultProject(ctx, userId);
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return createProject(ctx, userId, args.name);
  },
});

// Distinct tags across a project's tasks, sorted — feeds the board's tag filter.
export const distinctTags = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertOwnedProject(ctx, args.projectId, userId);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const tags = new Set<string>();
    for (const task of tasks) for (const tag of task.tags) tags.add(tag);
    return [...tags].sort();
  },
});

// ── Internal (trusted userId, used by MCP tools after token auth) ───────────

export const createForUser = internalMutation({
  args: { userId: v.id("users"), name: v.string(), tokenId: v.optional(v.id("apiTokens")) },
  returns: v.id("projects"),
  handler: (ctx, args) => createProject(ctx, args.userId, args.name, args.tokenId),
});

export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(projectShape),
  handler: (ctx, args) => listProjects(ctx, args.userId),
});
