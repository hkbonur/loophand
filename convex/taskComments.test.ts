// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupTask(t: ReturnType<typeof convexTest>, email: string) {
  const ids = await t.run(async (ctx) => {
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
  const { task } = await t.mutation(internal.tasks.createForAgent, {
    userId: ids.userId,
    tokenId: ids.tokenId,
    project: ids.projectId,
    type: "approval",
    title: "Ship it?",
    instructions: "Review",
  });
  return { ...ids, taskId: task.task_id };
}

describe("tasks.addComment", () => {
  test("appends a human comment to an owned task", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const comment = await asOwner.mutation(api.tasks.addComment, {
      taskId,
      body: "  use the brand palette  ",
    });
    expect(comment.author).toBe("human");
    expect(comment.body).toBe("use the brand palette");

    const stored = await t.run((ctx) =>
      ctx.db
        .query("taskComments")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
    );
    expect(stored).toHaveLength(1);
  });

  test("records a glass-box activity entry for the comment", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.tasks.addComment, { taskId, body: "looks good" });

    const activity = await t.run((ctx) =>
      ctx.db
        .query("taskActivity")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
    );
    expect(activity.some((a) => a.type === "commented")).toBe(true);
  });

  test("rejects an empty comment", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await expect(
      asOwner.mutation(api.tasks.addComment, { taskId, body: "   " }),
    ).rejects.toThrow();
  });

  test("rejects commenting on a task you don't own", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    await setupTask(t, "stranger@example.com");
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    await expect(
      asStranger.mutation(api.tasks.addComment, { taskId, body: "sneaky" }),
    ).rejects.toThrow();
  });
});

describe("get_task surfacing (consumeForAgent)", () => {
  test("returns comments ascending, derived guidance, and resolved preferences", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId, taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.tasks.addComment, { taskId, body: "use the brand palette" });
    await asOwner.mutation(api.tasks.addComment, { taskId, body: "actually, keep it neutral" });
    await asOwner.mutation(api.preferences.set, { key: "brand-color", value: "#000" });
    await asOwner.mutation(api.preferences.set, { key: "brand-color", value: "#fff", projectId });

    const detail = await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId });

    expect(detail.comments.map((c) => c.body)).toEqual([
      "use the brand palette",
      "actually, keep it neutral",
    ]);
    expect(detail.comments.every((c) => c.author === "human")).toBe(true);
    expect(detail.guidance).toBe("actually, keep it neutral");
    expect(detail.preferences).toEqual({ "brand-color": "#fff" });
  });

  test("returns empty comments and null guidance when none exist", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, taskId } = await setupTask(t, "owner@example.com");

    const detail = await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId });

    expect(detail.comments).toEqual([]);
    expect(detail.guidance).toBeNull();
    expect(detail.preferences).toEqual({});
  });
});
