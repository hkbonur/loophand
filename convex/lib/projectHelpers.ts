import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

const DEFAULT_PROJECT_NAME = "Default";

export interface ProjectSummary {
  _id: Id<"projects">;
  name: string;
  isDefault: boolean;
  createdAt: number;
}

// Return the user's default project, creating it on first use.
export async function ensureDefaultProject(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Id<"projects">> {
  const existing = await ctx.db
    .query("projects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const current = existing.find((p) => p.isDefault) ?? existing[0];
  if (current) return current._id;
  return ctx.db.insert("projects", {
    name: DEFAULT_PROJECT_NAME,
    userId,
    isDefault: true,
    createdAt: Date.now(),
  });
}

export async function createProject(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
  tokenId?: Id<"apiTokens">,
): Promise<Id<"projects">> {
  const trimmed = name.trim() || "Untitled project";
  return ctx.db.insert("projects", {
    name: trimmed,
    userId,
    isDefault: false,
    createdAt: Date.now(),
    ...(tokenId ? { createdByTokenId: tokenId } : {}),
  });
}

// Resolve a project name to an owned project, or null when none matches.
export async function findProjectByName(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  name: string,
): Promise<Id<"projects"> | null> {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const match = rows.find((p) => p.name.toLowerCase() === target);
  return match?._id ?? null;
}

export async function listProjects(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<ProjectSummary[]> {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows
    .map((p) => ({ _id: p._id, name: p.name, isDefault: p.isDefault, createdAt: p.createdAt }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt);
}
