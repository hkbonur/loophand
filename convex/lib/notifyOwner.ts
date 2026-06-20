import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// One notification per user per window, so a burst of task creates (or unblocks)
// doesn't fire one for each. `lastNotifiedAt` on the user is the throttle clock,
// shared across the push and email channels. Used by task creation + dep release.
const NOTIFY_THROTTLE_MS = 15_000;

export async function maybeNotifyOwner(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
  now: number,
): Promise<void> {
  const pushOn = !!process.env.VAPID_PUBLIC_KEY;
  const emailOn = !!process.env.RESEND_API_KEY;
  // No channel configured → skip the user-row write + scheduled work entirely.
  if (!pushOn && !emailOn) return;
  const user = await ctx.db.get(userId);
  if (user && now - (user.lastNotifiedAt ?? 0) < NOTIFY_THROTTLE_MS) return;
  // The read-modify-write on this row makes concurrent creates a Convex OCC
  // write-write conflict: one retries against the fresh stamp, so exactly one
  // notification fires per window even under a race.
  await ctx.db.patch(userId, { lastNotifiedAt: now });
  if (pushOn) await ctx.scheduler.runAfter(0, internal.notify.push, { taskId });
  if (emailOn) await ctx.scheduler.runAfter(0, internal.notify.email, { taskId });
}
