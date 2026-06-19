// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const R2_KEY = "abc123abc123abc1";

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
