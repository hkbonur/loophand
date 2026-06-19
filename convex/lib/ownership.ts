import { ConvexError } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

// Owner assertions are the hard security boundary. A row owned by another user
// is reported as NOT_FOUND (not FORBIDDEN) so existence never leaks across the
// userId boundary.

export async function assertOwnedProject(
  ctx: Ctx,
  projectId: Id<"projects">,
  userId: Id<"users">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}

export async function assertOwnedTask(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">,
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get(taskId);
  if (!task || task.userId !== userId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
  }
  return task;
}
