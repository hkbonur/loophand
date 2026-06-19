import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { r2, isValidR2Key, SIGNED_URL_TTL_SECONDS } from "../lib/r2";

/**
 * HTTP proxy for R2 storage objects. Generates a fresh signed URL on each
 * request and redirects (302). Gives a permanent, non-expiring proxy URL
 * (`<CONVEX_SITE_URL>/api/storage/<r2Key>`) that can be embedded in task
 * artifacts. Keys are random UUIDs — unguessable.
 */
export const storageProxyHandler = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const r2Key = url.pathname.replace("/api/storage/", "");

  if (!isValidR2Key(r2Key)) {
    return new Response("Invalid storage key", { status: 400 });
  }

  try {
    const signedUrl = await r2.getUrl(r2Key, { expiresIn: SIGNED_URL_TTL_SECONDS });
    return new Response(null, {
      status: 302,
      headers: { Location: signedUrl, "Cache-Control": "private, max-age=900, immutable" },
    });
  } catch (error) {
    console.error("Storage proxy error:", error);
    return new Response("Not found", { status: 404 });
  }
});

export function registerStorageRoutes(http: HttpRouter): void {
  http.route({ pathPrefix: "/api/storage/", method: "GET", handler: storageProxyHandler });
}
