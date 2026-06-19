import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { generateApiKey, hashToken, DEFAULT_TOKEN_EXPIRY_MS } from "./lib/apiTokenAuth";
import { logger } from "./lib/logger";

const MAX_TOKENS_PER_USER = 10;

// Scope minted on every user API key: full task access for the connected agent.
export const DEFAULT_SCOPE = "tasks:read tasks:write";

/** Mint a new API key. Returns the full token ONCE — it cannot be retrieved again. */
export const create = mutation({
  args: { name: v.optional(v.string()) },
  returns: v.object({
    id: v.id("apiTokens"),
    name: v.string(),
    token: v.string(),
    tokenPrefix: v.string(),
    createdAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const apiKeyCount = existing.filter((t) => t.tokenType === "api_key" && !t.revokedAt).length;
    if (apiKeyCount >= MAX_TOKENS_PER_USER) {
      throw new ConvexError({
        code: "LIMIT_EXCEEDED",
        message: `Maximum of ${MAX_TOKENS_PER_USER} API keys allowed`,
      });
    }

    const name = args.name?.trim() || `Key ${apiKeyCount + 1}`;
    const token = generateApiKey();
    const tokenHash = await hashToken(token);
    const tokenPrefix = token.slice(0, 11);
    const createdAt = Date.now();

    const id = await ctx.db.insert("apiTokens", {
      userId,
      tokenType: "api_key",
      name,
      tokenHash,
      tokenPrefix,
      scope: DEFAULT_SCOPE,
      createdAt,
      expiresAt: createdAt + DEFAULT_TOKEN_EXPIRY_MS,
    });

    logger.audit("api_token.created", { tokenId: id, tokenPrefix, userId });
    return { id, name, token, tokenPrefix, createdAt };
  },
});

/** List the current user's API keys (excludes OAuth-issued access tokens). */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("apiTokens"),
      name: v.string(),
      tokenPrefix: v.string(),
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
      isRevoked: v.boolean(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return tokens
      .filter((t) => t.tokenType === "api_key")
      .map((t) => ({
        _id: t._id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        isRevoked: !!t.revokedAt,
        expiresAt: t.expiresAt,
      }));
  },
});

/** Revoke an API key (soft delete — stays visible in the list). */
export const revoke = mutation({
  args: { id: v.id("apiTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const token = await ctx.db.get(args.id);
    if (!token) throw new ConvexError({ code: "NOT_FOUND", message: "Token not found" });
    if (token.userId !== userId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Not authorized to revoke this token" });
    if (token.revokedAt)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Token is already revoked" });
    await ctx.db.patch(args.id, { revokedAt: Date.now() });
    logger.audit("api_token.revoked", { tokenId: args.id, tokenPrefix: token.tokenPrefix, userId });
    return null;
  },
});

/**
 * Get a token by hash. Internal-only — invoked by the HTTP auth pipeline
 * (authenticateApiToken) via runQuery, never exposed to public clients, so
 * token metadata can't be probed by hash from the browser.
 */
export const getByHash = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("apiTokens"),
      userId: v.id("users"),
      tokenType: v.union(v.literal("api_key"), v.literal("oauth_access")),
      clientId: v.optional(v.string()),
      scope: v.optional(v.string()),
      tokenPrefix: v.string(),
      revokedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("apiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!token) return null;
    return {
      _id: token._id,
      userId: token.userId,
      tokenType: token.tokenType,
      clientId: token.clientId,
      scope: token.scope,
      tokenPrefix: token.tokenPrefix,
      revokedAt: token.revokedAt,
      expiresAt: token.expiresAt,
    };
  },
});

/** Internal: stamp lastUsedAt after a successful auth. */
export const updateLastUsed = internalMutation({
  args: { id: v.id("apiTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
    return null;
  },
});
