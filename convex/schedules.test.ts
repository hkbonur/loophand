// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupUser(t: ReturnType<typeof convexTest>, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { email, createdAt: Date.now() }));
}

const template = {
  type: "approval",
  title: "Daily standup review",
  instructions: "Review the overnight changes.",
};

describe("schedules.create", () => {
  test("creates an enabled schedule with a future nextRunAt", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const id = await asOwner.mutation(api.schedules.create, {
      name: "Standup",
      cron: "0 9 * * *",
      timezone: "America/New_York",
      taskTemplate: template,
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.enabled).toBe(true);
    expect(row?.nextRunAt).toBeGreaterThan(Date.now());
    expect(row?.skipIfPrevOpen).toBe(false);
  });

  test("rejects an invalid cron, timezone, or task type", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await expect(
      asOwner.mutation(api.schedules.create, {
        name: "x",
        cron: "nope",
        timezone: "UTC",
        taskTemplate: template,
      }),
    ).rejects.toThrow();
    await expect(
      asOwner.mutation(api.schedules.create, {
        name: "x",
        cron: "0 9 * * *",
        timezone: "Mars/Phobos",
        taskTemplate: template,
      }),
    ).rejects.toThrow();
    await expect(
      asOwner.mutation(api.schedules.create, {
        name: "x",
        cron: "0 9 * * *",
        timezone: "UTC",
        taskTemplate: { ...template, type: "bogus" },
      }),
    ).rejects.toThrow();
  });
});

describe("schedules.list / setEnabled / remove", () => {
  test("lists only the caller's schedules", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    await setupUser(t, "stranger@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    await asOwner.mutation(api.schedules.create, {
      name: "Standup",
      cron: "0 9 * * *",
      timezone: "UTC",
      taskTemplate: template,
    });

    expect(await asOwner.query(api.schedules.list, {})).toHaveLength(1);
    expect(
      await t.withIdentity({ email: "stranger@example.com" }).query(api.schedules.list, {}),
    ).toHaveLength(0);
  });

  test("disabling then enabling recomputes nextRunAt", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const id = await asOwner.mutation(api.schedules.create, {
      name: "Standup",
      cron: "0 9 * * *",
      timezone: "UTC",
      taskTemplate: template,
    });

    await asOwner.mutation(api.schedules.setEnabled, { id, enabled: false });
    expect((await t.run((ctx) => ctx.db.get(id)))?.enabled).toBe(false);

    await asOwner.mutation(api.schedules.setEnabled, { id, enabled: true });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.enabled).toBe(true);
    expect(row?.nextRunAt).toBeGreaterThan(Date.now());
  });

  test("remove is owner-checked", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    await setupUser(t, "stranger@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const id = await asOwner.mutation(api.schedules.create, {
      name: "Standup",
      cron: "0 9 * * *",
      timezone: "UTC",
      taskTemplate: template,
    });

    await expect(
      t.withIdentity({ email: "stranger@example.com" }).mutation(api.schedules.remove, { id }),
    ).rejects.toThrow();
    await asOwner.mutation(api.schedules.remove, { id });
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });
});
