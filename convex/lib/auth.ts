import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import authConfig from "../auth.config";
import { addCorsHeaders, corsPreflightHandler } from "./cors";
import { sendEmail, buildMagicLinkEmail } from "./email";
import { rateLimiter } from "../rateLimit";

/** Assert a Convex env var is set and is a valid absolute URL. */
function requireUrl(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it via: npx convex env set ${name} <url>`,
    );
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable ${name}: "${value}"`);
  }
  return value;
}

/**
 * Read an OAuth provider's client id + secret from the environment. Returns
 * null unless both are present, so callers wire the provider only when it's
 * fully configured.
 */
function oauthCreds(idVar: string, secretVar: string): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[idVar];
  if (!clientId) return null;
  const clientSecret = process.env[secretVar];
  if (!clientSecret) return null;
  return { clientId, clientSecret };
}

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Validated per-request (createAuth closes over ctx) so a misconfigured env
  // surfaces as a failed auth request, not a module-load crash.
  const siteUrl = requireUrl("SITE_URL");
  const convexSiteUrl = requireUrl("CONVEX_SITE_URL");

  // Only wire a provider when both of its credentials are present, so a
  // missing one degrades to "button fails" instead of breaking every sign-in
  // path at auth init.
  const googleCreds = oauthCreds("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  const githubCreds = oauthCreds("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");

  return betterAuth({
    baseURL: convexSiteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    socialProviders: {
      ...(googleCreds ? { google: { ...googleCreds, prompt: "select_account" as const } } : {}),
      ...(githubCreds ? { github: githubCreds } : {}),
    },
    plugins: [
      crossDomain({ siteUrl }),
      magicLink({
        // Store the sign-in token hashed, not plaintext — it's a bearer
        // credential for unauthenticated sign-in.
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          // Abuse backstop: drop the send silently once over budget.
          try {
            const status = await rateLimiter.limit(
              ctx as Parameters<typeof rateLimiter.limit>[0],
              "magicLink",
              { key: email },
            );
            if (!status.ok) return;
          } catch {
            // Fail open — never strand a legit sign-in on a limiter hiccup.
          }
          await sendEmail({
            to: email,
            subject: "Sign in to loophand",
            html: buildMagicLinkEmail(url, siteUrl),
            meta: { type: "magic_link" },
          });
        },
      }),
      convex({ authConfig }),
    ],
  });
};

// ── Auth HTTP handlers with CORS ──────────────────────────────────────────

export const authPreflightHandler = corsPreflightHandler;

export const authRequestHandler = httpAction(async (ctx, request) => {
  const auth = createAuth(ctx);
  const response = await auth.handler(request);
  return addCorsHeaders(response, request);
});

export async function getProvider(
  ctx: GenericCtx<DataModel>,
  _userId: string,
): Promise<string | null> {
  // listUserAccounts goes through an internal better-fetch round-trip that can
  // throw a BetterFetchError ("HTTPError") when the session token is stale —
  // e.g. an idle tab past the 15-min JWT horizon. Swallow it: provider is a
  // cosmetic cache, never worth turning a transient auth blip into a Convex 500.
  try {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const accounts = await auth.api.listUserAccounts({ headers });
    return accounts?.[0]?.providerId ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  return user?._id ?? null;
}

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Authentication required" });
  }
  return userId;
}
