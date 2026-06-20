// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { MAX_RETURNED_COMMENTS } from "./lib/comments";

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
  test("returns comments ascending and derived guidance", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.tasks.addComment, { taskId, body: "use the brand palette" });
    await asOwner.mutation(api.tasks.addComment, { taskId, body: "actually, keep it neutral" });

    const detail = await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId });

    expect(detail.comments.map((c) => c.body)).toEqual([
      "use the brand palette",
      "actually, keep it neutral",
    ]);
    expect(detail.guidance).toBe("actually, keep it neutral");
  });

  test("bounds the returned thread but derives guidance from the full set", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, taskId } = await setupTask(t, "owner@example.com");

    const total = MAX_RETURNED_COMMENTS + 5;
    await t.run(async (ctx) => {
      for (let i = 0; i < total; i++) {
        await ctx.db.insert("taskComments", { taskId, userId, body: `c${i}`, createdAt: i });
      }
    });

    const detail = await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId });

    expect(detail.comments).toHaveLength(MAX_RETURNED_COMMENTS);
    // Newest survives the slice; oldest is dropped.
    expect(detail.comments.at(-1)?.body).toBe(`c${total - 1}`);
    expect(detail.comments[0].body).toBe(`c${total - MAX_RETURNED_COMMENTS}`);
    expect(detail.guidance).toBe(`c${total - 1}`);
  });

  test("returns empty comments and null guidance when none exist", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, taskId } = await setupTask(t, "owner@example.com");

    const detail = await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId });

    expect(detail.comments).toEqual([]);
    expect(detail.guidance).toBeNull();
  });
});

describe("tasks.comments (board query)", () => {
  test("lists an owned task's comments oldest-first", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.tasks.addComment, { taskId, body: "first" });
    await asOwner.mutation(api.tasks.addComment, { taskId, body: "second" });

    const comments = await asOwner.query(api.tasks.comments, { taskId });
    expect(comments.map((c) => c.body)).toEqual(["first", "second"]);
  });

  test("rejects reading comments on a task you don't own", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupTask(t, "owner@example.com");
    await setupTask(t, "stranger@example.com");

    await expect(
      t.withIdentity({ email: "stranger@example.com" }).query(api.tasks.comments, { taskId }),
    ).rejects.toThrow();
  });
});
