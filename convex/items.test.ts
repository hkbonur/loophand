// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

// A 3-item approval task — type-agnostic rail mechanics, no doc_review needed.
async function createMultiItem(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  tokenId: Id<"apiTokens">,
) {
  const { task } = await t.mutation(internal.tasks.createForAgent, {
    userId,
    tokenId,
    type: "approval",
    title: "Review batch",
    instructions: "Review each",
    items: [{ data: { n: 1 } }, { data: { n: 2 } }, { data: { n: 3 } }],
  });
  return task;
}

async function itemIdByOrder(
  t: ReturnType<typeof convexTest>,
  taskId: Id<"tasks">,
  order: number,
): Promise<Id<"taskItems">> {
  const id = await t.run(async (ctx) => {
    const items = await ctx.db.query("taskItems").collect();
    const match = items.find((i) => i.taskId === taskId && i.order === order);
    return match?._id ?? null;
  });
  if (!id) throw new Error(`no item at order ${order}`);
  return id as Id<"taskItems">;
}

describe("multi-item create", () => {
  test("items[] materializes pending rail items and sets the counts", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);

    expect(task.item_count).toBe(3);
    expect(task.items_done).toBe(0);

    const items = await t.run((ctx) =>
      ctx.db
        .query("taskItems")
        .withIndex("by_task_order", (q) => q.eq("taskId", task.task_id))
        .collect(),
    );
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.status === "pending")).toBe(true);
    expect(items.every((i) => i.kind === "approval")).toBe(true);
  });

  test("items[] and tool_payload are mutually exclusive", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "visual_review",
        title: "x",
        instructions: "x",
        items: [{ data: {} }],
        toolPayload: { screenshotFileId: "whatever" },
      }),
    ).rejects.toThrow(/either items|not both/i);
  });
});

describe("item loop", () => {
  test("approving every item completes the task and wakes await", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    for (const order of [0, 1, 2]) {
      const itemId = await itemIdByOrder(t, task.task_id, order);
      await asOwner.mutation(api.items.setStatus, { itemId, status: "approved" });
    }

    const probe = await t.query(internal.tasks.statusForAgent, {
      userId,
      taskId: task.task_id,
    });
    expect(probe.awaitReady).toBe(true);

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.status).toBe("done");
    expect(row?.outcome).toBe("approved");
    expect(row?.itemsDone).toBe(3);
    expect(row?.result?.partial).toBe(false);
  });

  test("a changes_requested item keeps the task open but ready, badged for the agent", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 0),
      status: "approved",
    });
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 1),
      status: "changes_requested",
      result: { note: "fix heading" },
    });
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 2),
      status: "approved",
    });

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.status).toBe("open"); // stays open across the round
    expect(row?.outcome).toBe("changes_requested");
    expect(row?.itemsDone).toBe(3);
    expect(row?.result?.partial).toBe(true);

    const probe = await t.query(internal.tasks.statusForAgent, {
      userId,
      taskId: task.task_id,
    });
    expect(probe.awaitReady).toBe(true); // full pass wakes await even while open
  });

  test("agent reopen resets failed items to pending and re-arms await", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 0),
      status: "approved",
    });
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 1),
      status: "changes_requested",
    });
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 2),
      status: "approved",
    });

    const out = await t.mutation(internal.items.resumeItemsForAgent, {
      userId,
      tokenId,
      taskId: task.task_id,
      items: [{ order: 1, data: { n: 2, revised: true } }],
    });
    expect(out).toEqual({ reopened: 1, itemsDone: 2, itemCount: 3 });

    const reopened = await t.run((ctx) =>
      ctx.db
        .query("taskItems")
        .withIndex("by_task_order", (q) => q.eq("taskId", task.task_id).eq("order", 1))
        .first(),
    );
    expect(reopened?.status).toBe("pending");
    expect(reopened?.data).toEqual({ n: 2, revised: true });
    expect(reopened?.result ?? null).toBeNull();

    // itemsDone dropped below itemCount → await blocks again.
    const probe = await t.query(internal.tasks.statusForAgent, {
      userId,
      taskId: task.task_id,
    });
    expect(probe.awaitReady).toBe(false);

    // The second human pass re-approves it → task completes.
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 1),
      status: "approved",
    });
    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.status).toBe("done");
    expect(row?.outcome).toBe("approved");
  });

  test("reopen refuses an approved item (verdict is final)", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    for (const order of [0, 1, 2]) {
      await asOwner.mutation(api.items.setStatus, {
        itemId: await itemIdByOrder(t, task.task_id, order),
        status: "approved",
      });
    }
    // Task is done now; reopen should refuse (not open).
    await expect(
      t.mutation(internal.items.resumeItemsForAgent, {
        userId,
        tokenId,
        taskId: task.task_id,
        items: [{ order: 0, data: {} }],
      }),
    ).rejects.toThrow(/open multi-item/i);
  });

  test("setStatus on a foreign user's item is NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const itemId = await itemIdByOrder(t, task.task_id, 0);
    await expect(
      t.withIdentity({ email: "stranger@example.com" }).mutation(api.items.setStatus, {
        itemId,
        status: "approved",
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("itemsDone consistency", () => {
  test("concurrent item writes leave itemsDone exact (OCC race)", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    // Fire all three setStatus mutations concurrently — Convex serializes the
    // task-row read-modify-write via OCC retries.
    await Promise.all(
      [0, 1, 2].map(async (order) =>
        asOwner.mutation(api.items.setStatus, {
          itemId: await itemIdByOrder(t, task.task_id, order),
          status: "approved",
        }),
      ),
    );

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.itemsDone).toBe(3);
    expect(row?.status).toBe("done");
  });

  test("reconcile repairs a hand-corrupted itemsDone without spurious writes", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const task = await createMultiItem(t, userId, tokenId);
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    await asOwner.mutation(api.items.setStatus, {
      itemId: await itemIdByOrder(t, task.task_id, 0),
      status: "approved",
    });

    // Corrupt the stored count, then reconcile.
    await t.run((ctx) => ctx.db.patch(task.task_id, { itemsDone: 99 }));
    const before = await t.run((ctx) => ctx.db.get(task.task_id));
    const result = await t.mutation(internal.reconcile.itemCounts, {});
    expect(result.repaired).toBe(1);

    const after = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(after?.itemsDone).toBe(1);

    // A second pass finds nothing to fix and bumps no revision.
    const second = await t.mutation(internal.reconcile.itemCounts, {});
    expect(second.repaired).toBe(0);
    const settled = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(settled?.revision).toBe(after?.revision);
    expect(before).toBeTruthy();
  });
});
