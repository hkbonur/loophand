import { defineConfig } from "vitest/config";

// Standalone vitest config (kept separate from vite.config.ts so the TanStack
// Start / Cloudflare plugins don't run under tests). Per-file environment is
// chosen with a `// @vitest-environment` docblock: edge-runtime for Convex
// function tests, jsdom for component tests.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["convex/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
