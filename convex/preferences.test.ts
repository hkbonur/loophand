// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { resolveForProject } from "./preferences";

const modules = import.meta.glob("./**/*.ts");

async function setupOwner(t: ReturnType<typeof convexTest>, email: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, createdAt: Date.now() });
    const projectId = await ctx.db.insert("projects", {
      name: "Default",
      userId,
      isDefault: true,
      createdAt: Date.now(),
    });
    return { userId, projectId };
  });
}

describe("preferences.set", () => {
  test("creates a user-level preference and lists it", async () => {
    const t = convexTest(schema, modules);
    await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const pref = await asOwner.mutation(api.preferences.set, {
      key: "  Brand-Color ",
      value: " #ff0000 ",
    });
    expect(pref.key).toBe("brand-color");
    expect(pref.value).toBe("#ff0000");
    expect(pref.projectId).toBeNull();

    const all = await asOwner.query(api.preferences.list, {});
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe("brand-color");
  });

  test("upserts an existing key in the same scope rather than duplicating", async () => {
    const t = convexTest(schema, modules);
    await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "staging" });
    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "prod" });

    const all = await asOwner.query(api.preferences.list, {});
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe("prod");
  });

  test("keeps user-level and project-level rows for the same key distinct", async () => {
    const t = convexTest(schema, modules);
    const { projectId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "staging" });
    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "prod", projectId });

    const all = await asOwner.query(api.preferences.list, {});
    expect(all).toHaveLength(2);
  });

  test("rejects setting a project preference on a project you don't own", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    await expect(
      asStranger.mutation(api.preferences.set, {
        key: "deploy",
        value: "prod",
        projectId: owner.projectId,
      }),
    ).rejects.toThrow();
  });
});

describe("preferences.remove", () => {
  test("deletes a preference the caller owns", async () => {
    const t = convexTest(schema, modules);
    await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const pref = await asOwner.mutation(api.preferences.set, { key: "deploy", value: "staging" });
    await asOwner.mutation(api.preferences.remove, { preferenceId: pref._id });

    expect(await asOwner.query(api.preferences.list, {})).toHaveLength(0);
  });

  test("rejects removing another user's preference", async () => {
    const t = convexTest(schema, modules);
    await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    const pref = await asOwner.mutation(api.preferences.set, { key: "deploy", value: "staging" });
    await expect(
      asStranger.mutation(api.preferences.remove, { preferenceId: pref._id }),
    ).rejects.toThrow();
  });
});

describe("resolveForProject", () => {
  test("overlays project preferences on the user-level fallback", async () => {
    const t = convexTest(schema, modules);
    const { userId, projectId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.preferences.set, { key: "brand-color", value: "#000" });
    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "staging" });
    await asOwner.mutation(api.preferences.set, { key: "deploy", value: "prod", projectId });

    const resolved = await t.run((ctx) => resolveForProject(ctx, userId, projectId));
    expect(resolved).toEqual({ "brand-color": "#000", deploy: "prod" });
  });
});
