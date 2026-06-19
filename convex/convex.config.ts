import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import r2 from "@convex-dev/r2/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// loophand components. No Polar (no billing in v1). Resend email is wired via
// the REST API in lib/email.ts, so no component for it.
const app: ReturnType<typeof defineApp> = defineApp();

app.use(betterAuth);
app.use(r2);
app.use(rateLimiter);

export default app;
