// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

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

describe("projects.distinctTags", () => {
  test("returns the project's distinct tags, sorted, deduped across tasks", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    for (const tags of [["docs", "feature"], ["feature", "bug"], []]) {
      await t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        project: projectId,
        type: "approval",
        title: "A",
        instructions: "A",
        tags,
      });
    }

    const distinct = await asOwner.query(api.projects.distinctTags, { projectId });
    expect(distinct).toEqual(["bug", "docs", "feature"]);
  });

  test("rejects reading tags for a project you don't own", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    await expect(
      asStranger.query(api.projects.distinctTags, { projectId: owner.projectId }),
    ).rejects.toThrow();
  });
});
