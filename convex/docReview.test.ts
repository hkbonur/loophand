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
    await ctx.db.insert("projects", { name: "Default", userId, isDefault: true, createdAt: Date.now() });
    return { userId, tokenId };
  });
}

const reactPdfItem = (heading: string) => ({
  title: heading,
  data: { render: { kind: "react_pdf", tree: { type: "Document", children: [] } } },
});

describe("doc_review create", () => {
  test("a react_pdf doc_review materializes rail items carrying the render spec", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "doc_review",
      title: "Review contracts",
      instructions: "Check each contract",
      items: [reactPdfItem("NDA"), reactPdfItem("MSA")],
    });

    expect(task.item_count).toBe(2);
    const items = await t.run((ctx) =>
      ctx.db
        .query("taskItems")
        .withIndex("by_task_order", (q) => q.eq("taskId", task.task_id))
        .collect(),
    );
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("doc_review");
    expect(items[0].data.render.kind).toBe("react_pdf");
  });

  test("doc_review without items[] is rejected", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "doc_review",
        title: "x",
        instructions: "x",
      }),
    ).rejects.toThrow(/requires items/i);
  });

  test("xsl_fo render is rejected as not implemented", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "doc_review",
        title: "x",
        instructions: "x",
        items: [{ data: { render: { kind: "xsl_fo", source: "<fo:root/>" } } }],
      }),
    ).rejects.toThrow(/xsl_fo|not available/i);
  });

  test("a doc_review item missing a render spec is rejected", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId,
        tokenId,
        type: "doc_review",
        title: "x",
        instructions: "x",
        items: [{ data: { not: "a render spec" } }],
      }),
    ).rejects.toThrow(/render/i);
  });
});

describe("annotation surface", () => {
  test("visual_review rejects a doc-surface annotation", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    // Open a visual_review via a registered screenshot upload.
    const fileId: Id<"managedFiles"> = await t.mutation(internal.files.registerUpload, {
      userId,
      r2Key: "shotkey0000000001",
      contentType: "image/png",
      size: 10,
    });
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "visual_review",
      title: "Review UI",
      instructions: "x",
      toolPayload: { screenshotFileId: fileId },
    });

    await expect(
      t.withIdentity({ email: "owner@example.com" }).mutation(api.tasks.resolve, {
        taskId: task.task_id,
        action: "request_changes",
        revision: 0,
        annotations: [
          {
            surface: "doc" as const,
            page: 1,
            shape: "box" as const,
            points: [0, 0, 1, 1],
            severity: "nit" as const,
            comment: "wrong surface",
          },
        ],
      }),
    ).rejects.toThrow(/screenshot surface/i);
  });
});
