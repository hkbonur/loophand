// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup(t: ReturnType<typeof convexTest>, email: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, createdAt: Date.now() });
    const tokenId = await ctx.db.insert("apiTokens", {
      userId,
      tokenType: "api_key" as const,
      name: "t",
      tokenHash: `h-${email}`,
      tokenPrefix: "lh",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1_000_000_000,
    });
    const projectId = await ctx.db.insert("projects", {
      name: "P",
      userId,
      isDefault: true,
      createdAt: Date.now(),
    });
    return { userId, tokenId, projectId };
  });
}

async function newTask(
  t: ReturnType<typeof convexTest>,
  ids: { userId: Id<"users">; tokenId: Id<"apiTokens">; projectId: Id<"projects"> },
) {
  const { task } = await t.mutation(internal.tasks.createForAgent, {
    userId: ids.userId,
    tokenId: ids.tokenId,
    project: ids.projectId,
    type: "approval",
    title: "T",
    instructions: "i",
  });
  return task.task_id as Id<"tasks">;
}

describe("tasks.deleteTask", () => {
  test("deletes the task with its comments, items, and references", async () => {
    const t = convexTest(schema, modules);
    const ids = await setup(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const taskId = await newTask(t, ids);

    await asOwner.mutation(api.tasks.addComment, { taskId, body: "note" });
    await t.run(async (ctx) => {
      await ctx.db.insert("taskItems", {
        taskId,
        order: 0,
        kind: "approval",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    await asOwner.mutation(api.tasks.deleteTask, { taskId });

    expect(await t.run((ctx) => ctx.db.get(taskId))).toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("taskComments")
          .withIndex("by_task", (q) => q.eq("taskId", taskId))
          .collect(),
      ),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("taskItems")
          .withIndex("by_task_order", (q) => q.eq("taskId", taskId))
          .collect(),
      ),
    ).toHaveLength(0);
  });

  test("reclaims referenced blobs and decrements storageBytes", async () => {
    const t = convexTest(schema, modules);
    const ids = await setup(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const taskId = await newTask(t, ids);

    const fileId = await t.run(async (ctx) => {
      const fid = await ctx.db.insert("managedFiles", {
        r2Key: "blobkey000000001",
        size: 100,
        createdAt: Date.now(),
      });
      await ctx.db.insert("managedFileReferences", {
        fileId: fid,
        ownerType: "task" as const,
        ownerId: taskId,
        name: "out.pdf",
        createdAt: Date.now(),
      });
      await ctx.db.patch(ids.userId, { storageBytes: 100 });
      return fid;
    });

    await asOwner.mutation(api.tasks.deleteTask, { taskId });

    expect(await t.run((ctx) => ctx.db.get(fileId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.userId).then((u) => u?.storageBytes))).toBe(0);
  });

  test("refuses to delete a task other tasks depend on", async () => {
    const t = convexTest(schema, modules);
    const ids = await setup(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const dep = await newTask(t, ids);
    const dependent = await newTask(t, ids);
    await t.run((ctx) =>
      ctx.db.insert("taskDeps", { taskId: dependent, dependsOnTaskId: dep, createdAt: Date.now() }),
    );

    await expect(asOwner.mutation(api.tasks.deleteTask, { taskId: dep })).rejects.toThrow();
    // The dependent itself deletes fine (only an outgoing edge).
    await asOwner.mutation(api.tasks.deleteTask, { taskId: dependent });
    expect(await t.run((ctx) => ctx.db.get(dependent))).toBeNull();
  });

  test("rejects deleting another user's task", async () => {
    const t = convexTest(schema, modules);
    const ids = await setup(t, "owner@example.com");
    await setup(t, "stranger@example.com");
    const taskId = await newTask(t, ids);

    await expect(
      t.withIdentity({ email: "stranger@example.com" }).mutation(api.tasks.deleteTask, { taskId }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.get(taskId))).not.toBeNull();
  });
});
