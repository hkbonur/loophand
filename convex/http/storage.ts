import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { r2, isValidR2Key, SIGNED_URL_TTL_SECONDS } from "../lib/r2";

/**
 * HTTP proxy for R2 storage objects. Permanent, non-expiring proxy URL
 * (`<CONVEX_SITE_URL>/api/storage/<r2Key>`) embeddable in task artifacts. Keys
 * are random UUIDs — unguessable.
 *
 * Default: redirect (302) to a fresh signed URL — fast, for plain `<img>` embeds.
 * `?cors=1`: stream the bytes back through Convex with `Access-Control-Allow-Origin`,
 * so a canvas tool (image studio, annotation overlay) can load the image
 * cross-origin without tainting the canvas. The redirect target (R2) sends no
 * CORS headers, so a canvas read needs this same-origin-controlled variant.
 */
export const storageProxyHandler = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const r2Key = url.pathname.replace("/api/storage/", "");

  if (!isValidR2Key(r2Key)) {
    return new Response("Invalid storage key", { status: 400 });
  }

  try {
    const signedUrl = await r2.getUrl(r2Key, { expiresIn: SIGNED_URL_TTL_SECONDS });
    if (url.searchParams.get("cors") === "1") {
      const upstream = await fetch(signedUrl);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "private, max-age=900, immutable",
        },
      });
    }
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
