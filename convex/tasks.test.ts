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
      tokenType: "api_key",
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

describe("tasks lifecycle", () => {
  test("createForAgent stamps userId + projectId and opens the task", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId } = await setupOwner(t, "owner@example.com");

    const { task, reused } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "Ship README",
      instructions: "Approve the README",
      tags: ["docs"],
    });

    expect(reused).toBe(false);
    expect(task.status).toBe("open");
    expect(task.revision).toBe(0);
    expect(task.project_id).toBe(projectId);

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.userId).toBe(userId);
    expect(row?.projectId).toBe(projectId);
    expect(row?.tags).toEqual(["docs"]);
  });

  test("createForAgent is idempotent on (userId, idempotencyKey)", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");

    const first = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
      idempotencyKey: "k1",
    });
    const second = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "B",
      instructions: "B",
      idempotencyKey: "k1",
    });

    expect(second.reused).toBe(true);
    expect(second.task.task_id).toBe(first.task.task_id);
  });

  test("approve moves open → awaiting_agent and stamps the outcome", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });

    const resolved = await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      revision: 0,
    });
    expect(resolved.status).toBe("awaiting_agent");
    expect(resolved.outcome).toBe("approved");

    // First agent read consumes it: awaiting_agent → resumed.
    const consumed = await t.mutation(internal.tasks.consumeForAgent, {
      userId,
      tokenId,
      taskId: task.task_id,
    });
    expect(consumed.status).toBe("resumed");
  });

  test("resolve rejects a stale revision", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });
    await expect(
      asOwner.mutation(api.tasks.resolve, {
        taskId: task.task_id,
        action: "approve",
        revision: 99,
      }),
    ).rejects.toThrow();
  });

  test("creating a task into a project you don't own is rejected", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    const stranger = await setupOwner(t, "stranger@example.com");

    // owner.projectId belongs to owner; stranger must not be able to file into it.
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId: stranger.userId,
        tokenId: stranger.tokenId,
        project: owner.projectId,
        type: "approval",
        title: "intrusion",
        instructions: "intrusion",
      }),
    ).rejects.toThrow();
  });

  test("a foreign user cannot read another user's task", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: owner.userId,
      tokenId: owner.tokenId,
      type: "approval",
      title: "secret",
      instructions: "secret",
    });

    // A foreign or stale task reads back as null (no throw, no existence leak) —
    // so a push deep-link to a task you no longer own shows the empty state.
    expect(await asStranger.query(api.tasks.get, { taskId: task.task_id })).toBeNull();
    // A malformed id from a tampered ?task= URL is also graceful.
    expect(await asStranger.query(api.tasks.get, { taskId: "not-a-real-id" })).toBeNull();
  });

  test("expire is a no-op once the task has left the queue", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });
    await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      revision: 0,
    });

    await t.mutation(internal.tasks.expire, { taskId: task.task_id });
    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.outcome).toBe("approved");
    expect(row?.status).toBe("awaiting_agent");
  });
});
