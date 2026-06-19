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
    return { userId, tokenId };
  });
}

async function uploadScreenshot(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  r2Key: string,
) {
  return t.mutation(internal.files.registerUpload, {
    userId,
    r2Key,
    contentType: "image/png",
    size: 1024,
  });
}

describe("visual_review create + tool_payload", () => {
  test("creates a visual_review task, stores the payload, references the file, and consumes the claim", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const fileId = await uploadScreenshot(t, userId, "shotkey0001shotkey1");

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "visual_review",
      title: "Review the dashboard",
      instructions: "Check spacing on mobile",
      toolPayload: { screenshotFileId: fileId, viewports: ["desktop", "mobile"] },
    });

    expect(task.type).toBe("visual_review");
    expect(task.status).toBe("open");

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.toolPayload).toMatchObject({
      screenshotFileId: fileId,
      viewports: ["desktop", "mobile"],
    });

    const ref = await t.run((ctx) =>
      ctx.db
        .query("managedFileReferences")
        .withIndex("by_owner", (q) => q.eq("ownerType", "task").eq("ownerId", task.task_id))
        .first(),
    );
    expect(ref?.fileId).toBe(fileId);

    // The uploader claim is consumed once the task references the file.
    const claim = await t.run((ctx) =>
      ctx.db
        .query("pendingR2Uploads")
        .withIndex("by_r2Key", (q) => q.eq("r2Key", "shotkey0001shotkey1"))
        .first(),
    );
    expect(claim).toBeNull();
  });

  test("rejects a visual_review task with no screenshot", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "visual_review",
        title: "No shot",
        instructions: "x",
      }),
    ).rejects.toThrow();
  });

  test("rejects referencing a screenshot uploaded by another user", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    const stranger = await setupOwner(t, "stranger@example.com");
    const strangerFile = await uploadScreenshot(t, stranger.userId, "strangerkey000001");

    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId: owner.userId,
        tokenId: owner.tokenId,
        type: "visual_review",
        title: "intrusion",
        instructions: "x",
        toolPayload: { screenshotFileId: strangerFile },
      }),
    ).rejects.toThrow();
  });

  test("rejects tool_payload on a non-visual_review task", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const fileId = await uploadScreenshot(t, userId, "approvalkey0000001");

    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "approval",
        title: "approval with payload",
        instructions: "x",
        toolPayload: { screenshotFileId: fileId },
      }),
    ).rejects.toThrow();
  });

  test("a screenshot can be attached to only one task", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const fileId = await uploadScreenshot(t, userId, "oneshotkey00000001");

    await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "visual_review",
      title: "first",
      instructions: "x",
      toolPayload: { screenshotFileId: fileId },
    });

    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "visual_review",
        title: "second",
        instructions: "x",
        toolPayload: { screenshotFileId: fileId },
      }),
    ).rejects.toThrow();
  });
});

describe("visual_review human view", () => {
  test("resolves the screenshot to a storage-proxy URL and exposes the payload", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const fileId = await uploadScreenshot(t, userId, "viewkey00000000001");
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "visual_review",
      title: "v",
      instructions: "x",
      toolPayload: { screenshotFileId: fileId, viewports: ["mobile"] },
    });

    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const view = await asOwner.query(api.tasks.get, { taskId: task.task_id });
    expect(view?.toolPayload).toMatchObject({ viewports: ["mobile"] });
    expect(view?.screenshotUrl).toContain("/api/storage/viewkey00000000001");
  });

  test("an approval task carries no screenshot", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "a",
      instructions: "x",
    });

    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const view = await asOwner.query(api.tasks.get, { taskId: task.task_id });
    expect(view?.toolPayload).toBeNull();
    expect(view?.screenshotUrl).toBeNull();
  });
});
