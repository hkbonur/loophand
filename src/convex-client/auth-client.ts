import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import {
  convexClient as convexAuthPlugin,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

const baseURL = import.meta.env.VITE_CONVEX_SITE_URL;
if (!baseURL) {
  throw new Error("VITE_CONVEX_SITE_URL is not set. Add it to .env.local (the *.convex.site URL).");
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [crossDomainClient(), convexAuthPlugin(), magicLinkClient()],
});
