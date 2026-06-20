// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// A user with one task, plus a stored output blob referenced by that task.
async function setupWithOutput(
  t: ReturnType<typeof convexTest>,
  email: string,
  size: number,
  opts: { storageBytes?: number; named?: boolean } = {},
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      createdAt: Date.now(),
      ...(opts.storageBytes !== undefined ? { storageBytes: opts.storageBytes } : {}),
    });
    const projectId = await ctx.db.insert("projects", {
      name: "P",
      userId,
      isDefault: true,
      createdAt: Date.now(),
    });
    const taskId = await ctx.db.insert("tasks", {
      userId,
      projectId,
      type: "doc_review",
      title: "T",
      instructions: "i",
      status: "open",
      resultVersion: 0,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const fileId = await ctx.db.insert("managedFiles", {
      r2Key: `key-${email}`,
      size,
      createdAt: Date.now(),
    });
    await ctx.db.insert("managedFileReferences", {
      fileId,
      ownerType: "task" as const,
      ownerId: taskId,
      ...(opts.named === false ? {} : { name: "item.pdf" }),
      createdAt: Date.now(),
    });
    return { userId };
  });
}

const storageOf = (t: ReturnType<typeof convexTest>, userId: Id<"users">) =>
  t.run((ctx) => ctx.db.get(userId).then((u) => u?.storageBytes));

describe("reconcile.storageBytes", () => {
  test("repairs a drifted counter from the live references", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setupWithOutput(t, "owner@example.com", 100, { storageBytes: 999 });

    const res = await t.mutation(internal.reconcile.storageBytes, {});
    expect(res.repaired).toBe(1);
    expect(await storageOf(t, userId)).toBe(100);
  });

  test("is a no-op when the counter already matches", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setupWithOutput(t, "owner@example.com", 100, { storageBytes: 100 });

    const res = await t.mutation(internal.reconcile.storageBytes, {});
    expect(res.repaired).toBe(0);
    expect(await storageOf(t, userId)).toBe(100);
  });

  test("meters unnamed (input) references too", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setupWithOutput(t, "owner@example.com", 100, {
      storageBytes: 999,
      named: false,
    });

    const res = await t.mutation(internal.reconcile.storageBytes, {});
    // Attached inputs are metered like outputs → recomputed total is 100.
    expect(res.repaired).toBe(1);
    expect(await storageOf(t, userId)).toBe(100);
  });
});
