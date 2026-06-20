"use node";
import webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildPushPayload, isDeadPushError } from "./lib/pushPayload";
import { sendEmail } from "./lib/email";
import { buildTaskEmail } from "./lib/taskEmail";

// Emails the task owner that a card needs review. Best-effort: no-op when Resend
// isn't configured (sendEmail handles that) or the owner has no email. Throttled
// upstream by maybeNotifyOwner (one notify per user per window).
export const email = internalAction({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!process.env.RESEND_API_KEY) return null;
    const target: {
      email: string;
      title: string;
      type: string;
      projectId: Id<"projects">;
    } | null = await ctx.runQuery(internal.push.taskEmailTarget, { taskId: args.taskId });
    if (!target) return null;
    const siteUrl = process.env.SITE_URL;
    const url = siteUrl ? `${siteUrl}/?task=${args.taskId}` : null;
    const { subject, html } = buildTaskEmail({ title: target.title, type: target.type, url });
    await sendEmail({ to: target.email, subject, html, meta: { taskId: args.taskId } });
    return null;
  },
});

// Sends a Web Push to every device the task owner has subscribed. Runs in Node
// (web-push needs Node crypto). Best-effort: no-op when VAPID isn't configured,
// and a subscription the push service reports as gone is pruned. The payload is
// IDs only — see buildPushPayload.
export const push = internalAction({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return null;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    // Annotated to break the self-referential inference cycle through the
    // generated `internal.*` graph (see convex/lib/taskViews.ts).
    const target: { userId: Id<"users">; projectId: Id<"projects"> } | null = await ctx.runQuery(
      internal.push.taskNotifyTarget,
      { taskId: args.taskId },
    );
    if (!target) return null;

    const subscriptions: Array<{
      _id: Id<"pushSubscriptions">;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = await ctx.runQuery(internal.push.listForUser, { userId: target.userId });
    const payload = buildPushPayload(args.taskId, target.projectId);

    await Promise.all(
      subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err) {
          if (isDeadPushError((err as { statusCode?: number }).statusCode)) {
            await ctx.runMutation(internal.push.removeDead, { subscriptionId: s._id });
          }
        }
      }),
    );
    return null;
  },
});
