import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { generateApiKey, hashToken, DEFAULT_TOKEN_EXPIRY_MS } from "./lib/apiTokenAuth";
import { DEFAULT_SCOPE } from "./apiTokens";
import { ensureDefaultProject } from "./lib/projectHelpers";
import { logger } from "./lib/logger";

// Local dev seed: one user + default project + one API key (printed once).
// Run with: npx convex run seed:seed '{"email":"you@example.com"}'
export const seed = internalMutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  returns: v.object({
    userId: v.id("users"),
    projectId: v.id("projects"),
    token: v.string(),
    tokenPrefix: v.string(),
  }),
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      const id = await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(id);
    }
    if (!user) throw new Error("Failed to create seed user");

    const projectId = await ensureDefaultProject(ctx, user._id);

    const token = generateApiKey();
    const now = Date.now();
    await ctx.db.insert("apiTokens", {
      userId: user._id,
      tokenType: "api_key",
      name: "Seed key",
      tokenHash: await hashToken(token),
      tokenPrefix: token.slice(0, 11),
      scope: DEFAULT_SCOPE,
      createdAt: now,
      expiresAt: now + DEFAULT_TOKEN_EXPIRY_MS,
    });

    logger.audit("seed.completed", { userId: user._id, projectId, email: args.email });
    return { userId: user._id, projectId, token, tokenPrefix: token.slice(0, 11) };
  },
});
