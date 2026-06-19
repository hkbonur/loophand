import type { Id } from "../_generated/dataModel";
import { logger } from "./logger";
import { getClientIp } from "./clientIp";

const PEPPER = process.env.API_TOKEN_PEPPER ?? "";

// A ≥190-bit token's unsalted SHA-256 isn't brute-forceable, so an empty pepper
// is acceptable — but surface it so a missing pepper in a real deploy is
// visible rather than silently degraded.
if (!PEPPER) logger.warn("apiToken.pepper_unset", { reason: "API_TOKEN_PEPPER unset" });

export const DEFAULT_TOKEN_EXPIRY_DAYS = 90;
export const DEFAULT_TOKEN_EXPIRY_MS = DEFAULT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 32;

// Mint a fresh plaintext API key (`lh_` + 32 chars). The caller hashes it for
// storage and returns the plaintext to the user exactly once.
export function generateApiKey(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  let token = "lh_";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_CHARS.charAt(array[i] % TOKEN_CHARS.length);
  }
  return token;
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(PEPPER + token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Accepted Bearer token shapes:
//   - `lh_`  + 32 alphanumeric chars (user-minted API keys)
//   - `lho_` + 43 base64url chars    (OAuth-issued access tokens)
const TOKEN_FORMAT = /^(?:lh_[A-Za-z0-9]{32}|lho_[A-Za-z0-9_-]{43})$/;

export function validateTokenFormat(token: string): { valid: boolean; error?: string } {
  if (TOKEN_FORMAT.test(token)) return { valid: true };
  return { valid: false, error: "Invalid token format" };
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export type AuthenticateTokenResult =
  | {
      ok: true;
      userId: Id<"users">;
      tokenId: Id<"apiTokens">;
      tokenPrefix: string;
      tokenType: "api_key" | "oauth_access";
      clientId?: string;
      scope?: string;
    }
  | { ok: false; error: string };

/**
 * Shared auth pipeline: extract Bearer → validate format → hash → DB lookup →
 * revoked/expired check → update lastUsed.
 *
 * Rate-limiting is enforced only on the failure path so a legitimate caller
 * with a valid token is never blocked by other clients on the same IP.
 */
export async function authenticateApiToken(
  ctx: {
    runQuery: (ref: any, args: any) => Promise<any>;
    runMutation: (ref: any, args: any) => Promise<any>;
  },
  request: Request,
  deps: {
    recordAuthFailure: any;
    getByHash: any;
    updateLastUsed: any;
  },
): Promise<AuthenticateTokenResult> {
  const clientIp = getClientIp(request);

  async function failAfterRecording(error: string): Promise<AuthenticateTokenResult> {
    const limited = await ctx.runMutation(deps.recordAuthFailure, { key: clientIp });
    if (limited) return { ok: false, error: "RATE_LIMITED" };
    return { ok: false, error };
  }

  const token = extractBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return failAfterRecording(
      "Authentication required. Provide a Bearer token in the Authorization header.",
    );
  }

  const formatCheck = validateTokenFormat(token);
  if (!formatCheck.valid) {
    return failAfterRecording(formatCheck.error ?? "Invalid token format");
  }

  const tokenHash = await hashToken(token);
  const tokenDoc = (await ctx.runQuery(deps.getByHash, { tokenHash })) as {
    _id: Id<"apiTokens">;
    userId: Id<"users">;
    tokenType: "api_key" | "oauth_access";
    clientId?: string;
    scope?: string;
    tokenPrefix: string;
    revokedAt?: number;
    expiresAt: number;
  } | null;

  if (!tokenDoc) return failAfterRecording("Invalid token");
  if (tokenDoc.revokedAt) return { ok: false, error: "Token has been revoked" };
  if (tokenDoc.expiresAt < Date.now()) return { ok: false, error: "Token has expired" };

  await ctx.runMutation(deps.updateLastUsed, { id: tokenDoc._id }).catch((error: unknown) => {
    logger.warn("api_token.last_used_update_failed", {
      tokenId: tokenDoc._id,
      error: String(error),
    });
  });

  return {
    ok: true,
    userId: tokenDoc.userId,
    tokenId: tokenDoc._id,
    tokenPrefix: tokenDoc.tokenPrefix,
    tokenType: tokenDoc.tokenType,
    clientId: tokenDoc.clientId,
    scope: tokenDoc.scope,
  };
}
