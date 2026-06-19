import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { authPreflightHandler, authRequestHandler } from "../lib/auth";

// Registered manually (instead of authComponent.registerRoutes()) so we can add
// CORS headers for the cross-origin frontend.
export function registerAuthRoutes(http: HttpRouter): void {
  http.route({
    path: "/.well-known/openid-configuration",
    method: "GET",
    handler: httpAction(async () => {
      const url = `${process.env.CONVEX_SITE_URL}/api/auth/convex/.well-known/openid-configuration`;
      return Response.redirect(url);
    }),
  });

  http.route({ pathPrefix: "/api/auth/", method: "OPTIONS", handler: authPreflightHandler });
  http.route({ pathPrefix: "/api/auth/", method: "GET", handler: authRequestHandler });
  http.route({ pathPrefix: "/api/auth/", method: "POST", handler: authRequestHandler });
}
