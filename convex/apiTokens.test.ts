// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupUser(t: ReturnType<typeof convexTest>, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { email, createdAt: Date.now() }));
}

describe("apiTokens.list", () => {
  test("exposes the token's scope and name for the Agents panel", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.apiTokens.create, { name: "laptop" });

    const tokens = await asOwner.query(api.apiTokens.list, {});
    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe("laptop");
    expect(tokens[0].scope).toBe("tasks:read tasks:write");
    expect(tokens[0].isRevoked).toBe(false);
  });

  test("only returns the calling user's tokens", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    await setupUser(t, "stranger@example.com");
    await t.withIdentity({ email: "owner@example.com" }).mutation(api.apiTokens.create, {});

    const strangerTokens = await t
      .withIdentity({ email: "stranger@example.com" })
      .query(api.apiTokens.list, {});
    expect(strangerTokens).toHaveLength(0);
  });
});
