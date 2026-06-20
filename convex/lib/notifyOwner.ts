import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// One push per user per window, so a burst of task creates (or unblocks) doesn't
// fire a notification for each. `lastNotifiedAt` on the user is the throttle
// clock. Shared by task creation and dependency release.
const PUSH_THROTTLE_MS = 15_000;

export async function maybeNotifyOwner(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
  now: number,
): Promise<void> {
  // Skip the user-row write + scheduled action entirely when push isn't
  // configured (e.g. a deployment without VAPID) — keeps create off that path.
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const user = await ctx.db.get(userId);
  if (user && now - (user.lastNotifiedAt ?? 0) < PUSH_THROTTLE_MS) return;
  // The read-modify-write on this row makes concurrent creates a Convex OCC
  // write-write conflict: one retries against the fresh stamp, so exactly one
  // push fires per window even under a race.
  await ctx.db.patch(userId, { lastNotifiedAt: now });
  await ctx.scheduler.runAfter(0, internal.notify.push, { taskId });
}
