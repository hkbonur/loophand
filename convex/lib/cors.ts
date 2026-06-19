import { httpAction } from "../_generated/server";

// loophand serves its frontend from SITE_URL (Cloudflare) and its API from
// CONVEX_SITE_URL. CORS allows the configured site origin plus any origin for
// the MCP endpoint (agents connect from arbitrary hosts with a Bearer token).
function allowedOrigin(request: Request): string {
  const origin = request.headers.get("Origin");
  const site = process.env.SITE_URL;
  if (origin && site && origin === site) return origin;
  // MCP/API callers authenticate with a Bearer token, not a cookie, so a
  // permissive origin is safe here — there's no ambient credential to abuse.
  return origin ?? "*";
}

const BASE_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // `Better-Auth-Cookie` carries the session for the cross-domain auth flow
  // (frontend origin ≠ Convex origin); `Set-Better-Auth-Cookie` is the matching
  // response header the better-auth client reads back, so it must be exposed.
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Better-Auth-Cookie, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "Set-Better-Auth-Cookie",
  "Access-Control-Max-Age": "86400",
};

export function addCorsHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin(request));
  headers.set("Vary", "Origin");
  for (const [k, val] of Object.entries(BASE_HEADERS)) headers.set(k, val);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsJsonErrorResponse(message: string, status: number, request: Request): Response {
  return addCorsHeaders(
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    request,
  );
}

export const corsPreflightHandler = httpAction(async (_ctx, request) => {
  return addCorsHeaders(new Response(null, { status: 204 }), request);
});
