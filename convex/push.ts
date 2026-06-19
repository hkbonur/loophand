import { v } from "convex/values";
import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// A browser's Web Push subscription (endpoint + the keys needed to encrypt a
// payload to it). One row per device/endpoint, owned by a user.

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // Upsert by endpoint: a browser re-subscribing with the same endpoint
    // refreshes its keys (and owner) rather than creating a duplicate.
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId, p256dh: args.p256dh, auth: args.auth });
      return null;
    }
    await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing && existing.userId === userId) await ctx.db.delete(existing._id);
    return null;
  },
});

// Subscriptions to push to, for the notify action.
export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      endpoint: v.string(),
      p256dh: v.string(),
      auth: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return subs.map((s) => ({ _id: s._id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
  },
});

// Drop a subscription the push service reported as gone (404/410).
export const removeDead = internalMutation({
  args: { subscriptionId: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.subscriptionId);
    return null;
  },
});
