import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Auth-failure budget per client IP. Only the failure path is rate-limited, so
// a legitimate caller with a valid token is never blocked by other clients on
// the same IP (see authenticateApiToken).
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  authFailure: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  magicLink: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
});

// Returns `true` when the caller has exhausted its failure budget.
export const recordAuthFailure = internalMutation({
  args: { key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const status = await rateLimiter.limit(ctx, "authFailure", { key: args.key });
    return !status.ok;
  },
});
