import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Insert a task row and its paired "created" activity entry. Notification is left
// to the caller (it gates differently: only when the task is open). Returns the id.
export async function insertTaskRecord(
  ctx: MutationCtx,
  fields: WithoutSystemFields<Doc<"tasks">>,
): Promise<Id<"tasks">> {
  const taskId = await ctx.db.insert("tasks", fields);
  await ctx.db.insert("taskActivity", {
    taskId,
    type: "created",
    actorTokenId: fields.createdByTokenId,
    createdAt: fields.createdAt,
  });
  return taskId;
}
