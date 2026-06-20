import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { authComponent, getProvider } from "./lib/auth";
import { logger } from "./lib/logger";

const userResponse = v.union(
  v.object({
    id: v.id("users"),
    email: v.string(),
    name: v.union(v.string(), v.null()),
    image: v.union(v.string(), v.null()),
    provider: v.union(v.string(), v.null()),
  }),
  v.null(),
);

async function loadCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();
  if (!user) return null;
  return {
    id: user._id,
    email: user.email ?? identity.email,
    name: user.name ?? identity.name ?? null,
    image: user.image ?? identity.pictureUrl ?? null,
    provider: user.provider ?? null,
  };
}

export const currentUser = query({
  args: {},
  returns: userResponse,
  handler: (ctx) => loadCurrentUser(ctx),
});

/**
 * Upsert the app `users` row from the auth identity. Called by the frontend on
 * mount after sign-in — Better Auth owns auth tables inside its component, this
 * gives every domain row a stable `Id<'users'>` to key on.
 */
export const ensureUser = mutation({
  args: {},
  returns: userResponse,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // getAuthUser round-trips Better Auth and can throw BetterFetchError
    // ("HTTPError") when the session token is stale — e.g. an idle tab past the
    // 15-min JWT horizon. Swallow it and fall back to the Convex identity:
    // never turn a transient auth blip into a Convex 500. Mirrors getProvider.
    let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      authUser = null;
    }
    const email = authUser?.email ?? identity.email;
    if (!email) return null;

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email,
        name: authUser?.name ?? identity.name,
        image: authUser?.image ?? identity.pictureUrl,
        createdAt: Date.now(),
      });
      logger.audit("user.created", { userId, email });
      user = await ctx.db.get(userId);
    }
    if (!user) return null;

    // Cache the provider on the row so reads don't round-trip Better Auth.
    let provider: string | null = user.provider ?? null;
    if (!provider && authUser) {
      provider = await getProvider(ctx, authUser._id);
      if (provider) await ctx.db.patch(user._id, { provider });
    }

    return {
      id: user._id,
      email: user.email ?? email,
      name: user.name ?? authUser?.name ?? identity.name ?? null,
      image: user.image ?? authUser?.image ?? identity.pictureUrl ?? null,
      provider,
    };
  },
});
