// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// storageProxyUrl requires CONVEX_SITE_URL (auto-injected in real deployments).
process.env.CONVEX_SITE_URL = "https://test.convex.site";

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

describe("visual_review resolve → agent round-trip", () => {
  async function openVisualReview(t: ReturnType<typeof convexTest>, r2Key: string) {
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const fileId = await uploadScreenshot(t, userId, r2Key);
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "visual_review",
      title: "v",
      instructions: "x",
      toolPayload: { screenshotFileId: fileId },
    });
    return { userId, tokenId, taskId: task.task_id };
  }

  test("box + pen-sketch annotations survive to the agent's get_task", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, taskId } = await openVisualReview(t, "roundtripkey000001");
    const annotations = [
      { surface: "screenshot" as const, shape: "box" as const, points: [10, 10, 100, 50], viewport: "desktop" as const, severity: "blocker" as const, comment: "misaligned header" },
      { surface: "screenshot" as const, shape: "pen" as const, points: [1, 2, 3, 4, 5, 6], viewport: "mobile" as const, severity: "nit" as const, comment: "sketchy edge" },
    ];

    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const resolved = await asOwner.mutation(api.tasks.resolve, {
      taskId,
      action: "request_changes",
      comment: "see notes",
      revision: 0,
      annotations,
    });
    expect(resolved.outcome).toBe("changes_requested");
    expect(resolved.result.tool).toBe("visual_review");
    expect(resolved.result.annotations).toHaveLength(2);

    // The agent reads back the structured feedback verbatim.
    const agentView = await t.mutation(internal.tasks.consumeForAgent, {
      userId,
      tokenId,
      taskId,
    });
    expect(agentView.result.tool).toBe("visual_review");
    expect(agentView.result.decision).toBe("changes_requested");
    expect(agentView.result.annotations[1]).toMatchObject({
      shape: "pen",
      severity: "nit",
      comment: "sketchy edge",
    });
  });

  test("rejects annotations on an approval task", async () => {
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
    await expect(
      asOwner.mutation(api.tasks.resolve, {
        taskId: task.task_id,
        action: "approve",
        revision: 0,
        annotations: [
          { surface: "screenshot" as const, shape: "box" as const, points: [0, 0, 1, 1], viewport: "desktop" as const, severity: "nit" as const, comment: "x" },
        ],
      }),
    ).rejects.toThrow();
  });

  test("approval resolution keeps its plain decision + comment result", async () => {
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
    const resolved = await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      comment: "lgtm",
      revision: 0,
    });
    expect(resolved.result).toMatchObject({ decision: "approved", comment: "lgtm" });
    expect(resolved.result.tool).toBeUndefined();
  });
});
