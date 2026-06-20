// @vitest-environment edge-runtime
// Integration coverage for the wired hardening limits (the pure asserts live in
// lib/limits.test.ts). Verifies each cap actually fires on its real code path.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { MAX_ITEMS_PER_TASK } from "./lib/limits";

const modules = import.meta.glob("./**/*.ts");

async function setupOwner(t: ReturnType<typeof convexTest>, email: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, createdAt: Date.now() });
    const tokenId = await ctx.db.insert("apiTokens", {
      userId,
      tokenType: "api_key" as const,
      name: "test",
      tokenHash: `hash-${email}`,
      tokenPrefix: "lh_test",
      scope: "tasks:read tasks:write",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1_000_000_000,
    });
    const projectId = await ctx.db.insert("projects", {
      name: "Default",
      userId,
      isDefault: true,
      createdAt: Date.now(),
    });
    return { userId, tokenId, projectId };
  });
}

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({ title: `item ${i}`, data: { i } }));
}

describe("createForAgent item cap", () => {
  test("accepts a task at the item cap", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId } = await setupOwner(t, "owner@example.com");

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      project: projectId,
      type: "approval",
      title: "Batch",
      instructions: "Review",
      items: items(MAX_ITEMS_PER_TASK),
    });
    expect(task.item_count).toBe(MAX_ITEMS_PER_TASK);
  });

  test("rejects a task over the item cap", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId } = await setupOwner(t, "owner@example.com");

    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        project: projectId,
        type: "approval",
        title: "Batch",
        instructions: "Review",
        items: items(MAX_ITEMS_PER_TASK + 1),
      }),
    ).rejects.toThrow();
  });
});
