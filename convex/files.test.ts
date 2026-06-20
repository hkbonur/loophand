// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MAX_OUTPUT_BYTES, MAX_STORAGE_BYTES_PER_USER } from "./lib/limits";

const modules = import.meta.glob("./**/*.ts");

const R2_KEY = "abc123abc123abc1";

// A user (matchable by email for session auth) + an owned task to attach
// outputs to, plus a pending upload claim the human "just finished" PUT-ing.
async function setupOutputOwner(t: ReturnType<typeof convexTest>, email: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, createdAt: Date.now() });
    const projectId = await ctx.db.insert("projects", {
      name: "Default",
      userId,
      isDefault: true,
      createdAt: Date.now(),
    });
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      userId,
      projectId,
      type: "doc_review",
      title: "Review docs",
      instructions: "Review the rendered docs",
      status: "open",
      resultVersion: 0,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { userId, projectId, taskId };
  });
}

async function claimUpload(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  r2Key: string,
) {
  await t.run((ctx) =>
    ctx.db.insert("pendingR2Uploads", {
      r2Key,
      userId,
      contentType: "application/pdf",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }),
  );
}

describe("file uploads", () => {
  test("registerUpload stores the blob and an uploader claim", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "a@b.c", createdAt: Date.now() }),
    );

    const fileId = await t.mutation(internal.files.registerUpload, {
      userId,
      r2Key: R2_KEY,
      contentType: "image/png",
      size: 42,
    });

    const file = await t.run((ctx) => ctx.db.get(fileId));
    expect(file?.r2Key).toBe(R2_KEY);
    expect(file?.contentType).toBe("image/png");
    expect(file?.size).toBe(42);

    const pending = await t.run((ctx) =>
      ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", R2_KEY))
        .first(),
    );
    expect(pending?.userId).toBe(userId);
    expect(pending?.expiresAt).toBeGreaterThan(Date.now());
  });

  test("cleanup reclaims an upload that was never attached to a task", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "a@b.c", createdAt: Date.now() }),
    );
    const fileId = await t.mutation(internal.files.registerUpload, {
      userId,
      r2Key: "orphankey00000001",
      contentType: "image/png",
      size: 10,
    });
    // Fast-forward the claim past its expiry.
    await t.run(async (ctx) => {
      const pending = await ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", "orphankey00000001"))
        .first();
      if (pending) await ctx.db.patch(pending._id, { expiresAt: Date.now() - 1 });
    });

    await t.mutation(internal.crons.cleanupExpiredUploads, {});

    expect(await t.run((ctx) => ctx.db.get(fileId))).toBeNull();
    const pending = await t.run((ctx) =>
      ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", "orphankey00000001"))
        .first(),
    );
    expect(pending).toBeNull();
  });

  test("cleanup keeps a file that a task already references", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "a@b.c", createdAt: Date.now() }),
    );
    const fileId = await t.mutation(internal.files.registerUpload, {
      userId,
      r2Key: "keepkey0000000001",
      contentType: "image/png",
      size: 10,
    });
    // A reference exists (a task claimed it) but an expired pending row lingers.
    await t.run(async (ctx) => {
      await ctx.db.insert("managedFileReferences", {
        fileId,
        ownerType: "task",
        ownerId: "task_x",
        createdAt: Date.now(),
      });
      const pending = await ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", "keepkey0000000001"))
        .first();
      if (pending) await ctx.db.patch(pending._id, { expiresAt: Date.now() - 1 });
    });

    await t.mutation(internal.crons.cleanupExpiredUploads, {});

    expect(await t.run((ctx) => ctx.db.get(fileId))).not.toBeNull();
  });
});

describe("named task outputs (fetch_file path)", () => {
  test("recordOutput stores a named, task-owned reference and consumes the claim", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    await claimUpload(t, userId, "outputkey00000001");

    const fileId = await t
      .withIdentity({ email: "owner@example.com" })
      .mutation(api.files.recordOutput, {
        taskId,
        name: "item-1.pdf",
        r2Key: "outputkey00000001",
        contentType: "application/pdf",
        size: 2048,
      });

    const ref = await t.run((ctx) =>
      ctx.db
        .query("managedFileReferences")
        .withIndex("by_owner_name", (q) =>
          q.eq("ownerType", "task").eq("ownerId", taskId).eq("name", "item-1.pdf"),
        )
        .first(),
    );
    expect(ref?.fileId).toBe(fileId);
    expect(ref?.ownerId).toBe(taskId);

    const claim = await t.run((ctx) =>
      ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", "outputkey00000001"))
        .first(),
    );
    expect(claim).toBeNull();
  });

  test("recordOutput rejects a key the caller never claimed", async () => {
    const t = convexTest(schema, modules);
    const { taskId } = await setupOutputOwner(t, "owner@example.com");
    // No claim exists for this key.
    await expect(
      t.withIdentity({ email: "owner@example.com" }).mutation(api.files.recordOutput, {
        taskId,
        name: "item-1.pdf",
        r2Key: "unclaimedkey00001",
        contentType: "application/pdf",
        size: 1,
      }),
    ).rejects.toThrow(/not found/i);
  });

  test("resolveOutputForAgent returns the key for the owner", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    await claimUpload(t, userId, "outputkey00000002");
    await t.withIdentity({ email: "owner@example.com" }).mutation(api.files.recordOutput, {
      taskId,
      name: "item-1.pdf",
      r2Key: "outputkey00000002",
      contentType: "application/pdf",
      size: 10,
    });

    const resolved = await t.query(internal.files.resolveOutputForAgent, {
      userId,
      taskId,
      name: "item-1.pdf",
    });
    expect(resolved).toEqual({ r2Key: "outputkey00000002", contentType: "application/pdf" });
  });

  test("resolveOutputForAgent hides a foreign owner's file behind NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    await claimUpload(t, userId, "outputkey00000003");
    await t.withIdentity({ email: "owner@example.com" }).mutation(api.files.recordOutput, {
      taskId,
      name: "item-1.pdf",
      r2Key: "outputkey00000003",
      contentType: "application/pdf",
      size: 10,
    });

    const strangerId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "stranger@example.com", createdAt: Date.now() }),
    );
    await expect(
      t.query(internal.files.resolveOutputForAgent, {
        userId: strangerId,
        taskId,
        name: "item-1.pdf",
      }),
    ).rejects.toThrow(/not found/i);
  });

  test("resolveOutputForAgent rejects an unknown name", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    await expect(
      t.query(internal.files.resolveOutputForAgent, { userId, taskId, name: "missing.pdf" }),
    ).rejects.toThrow(/not found/i);
  });

  test("recordOutput supersedes a prior same-named output (last write wins)", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await claimUpload(t, userId, "outputkey0000000a");
    const firstFileId = await asOwner.mutation(api.files.recordOutput, {
      taskId,
      name: "item-1.pdf",
      r2Key: "outputkey0000000a",
      contentType: "application/pdf",
      size: 1,
    });

    await claimUpload(t, userId, "outputkey0000000b");
    await asOwner.mutation(api.files.recordOutput, {
      taskId,
      name: "item-1.pdf",
      r2Key: "outputkey0000000b",
      contentType: "application/pdf",
      size: 2,
    });

    // Exactly one reference for the name, pointing at the new blob.
    const refs = await t.run((ctx) =>
      ctx.db
        .query("managedFileReferences")
        .withIndex("by_owner_name", (q) =>
          q.eq("ownerType", "task").eq("ownerId", taskId).eq("name", "item-1.pdf"),
        )
        .collect(),
    );
    expect(refs).toHaveLength(1);

    const resolved = await t.query(internal.files.resolveOutputForAgent, {
      userId,
      taskId,
      name: "item-1.pdf",
    });
    expect(resolved.r2Key).toBe("outputkey0000000b");

    // The superseded blob's managedFiles row is reclaimed.
    expect(await t.run((ctx) => ctx.db.get(firstFileId))).toBeNull();
  });
});

describe("recordOutput size cap + storage quota", () => {
  test("rejects an output over the per-artifact size cap", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await claimUpload(t, userId, "outputkey00000big");
    await expect(
      asOwner.mutation(api.files.recordOutput, {
        taskId,
        name: "huge.pdf",
        r2Key: "outputkey00000big",
        contentType: "application/pdf",
        size: MAX_OUTPUT_BYTES + 1,
      }),
    ).rejects.toThrow();
  });

  test("tracks storageBytes and rejects an output that would exceed the quota", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await claimUpload(t, userId, "outputkey00000001");
    await asOwner.mutation(api.files.recordOutput, {
      taskId,
      name: "a.pdf",
      r2Key: "outputkey00000001",
      contentType: "application/pdf",
      size: 100,
    });
    expect(await t.run((ctx) => ctx.db.get(userId).then((u) => u?.storageBytes))).toBe(100);

    // Push the running total to the brink, then a 1-byte add must be rejected.
    await t.run((ctx) =>
      ctx.db.patch(userId, { storageBytes: MAX_STORAGE_BYTES_PER_USER }),
    );
    await claimUpload(t, userId, "outputkey00000002");
    await expect(
      asOwner.mutation(api.files.recordOutput, {
        taskId,
        name: "b.pdf",
        r2Key: "outputkey00000002",
        contentType: "application/pdf",
        size: 1,
      }),
    ).rejects.toThrow();
  });

  test("superseding nets the reclaimed bytes out of the quota", async () => {
    const t = convexTest(schema, modules);
    const { userId, taskId } = await setupOutputOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await claimUpload(t, userId, "outputkey0000000a");
    await asOwner.mutation(api.files.recordOutput, {
      taskId,
      name: "item.pdf",
      r2Key: "outputkey0000000a",
      contentType: "application/pdf",
      size: 100,
    });
    await claimUpload(t, userId, "outputkey0000000b");
    await asOwner.mutation(api.files.recordOutput, {
      taskId,
      name: "item.pdf",
      r2Key: "outputkey0000000b",
      contentType: "application/pdf",
      size: 30,
    });

    // 100 reclaimed, 30 added → net 30, not 130.
    expect(await t.run((ctx) => ctx.db.get(userId).then((u) => u?.storageBytes))).toBe(30);
  });
});
