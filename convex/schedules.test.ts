// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MAX_ACTIVE_SCHEDULES } from "./lib/limits";

const modules = import.meta.glob("./**/*.ts");

async function setupUser(t: ReturnType<typeof convexTest>, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { email, createdAt: Date.now() }));
}

const template = {
  type: "approval",
  title: "Daily standup review",
  instructions: "Review the overnight changes.",
};

// Insert a schedule row directly so the test controls nextRunAt precisely.
async function insertSchedule(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  over: Partial<{
    nextRunAt: number;
    skipIfPrevOpen: boolean;
    projectId: Id<"projects">;
    createdByTokenId: Id<"apiTokens">;
    enabled: boolean;
    lastMaterializedSlot: number;
  }> = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("schedules", {
      userId,
      name: "S",
      cron: "0 9 * * *",
      timezone: "UTC",
      taskTemplate: template,
      skipIfPrevOpen: over.skipIfPrevOpen ?? false,
      nextRunAt: over.nextRunAt ?? Date.now() - 60_000,
      enabled: over.enabled ?? true,
      createdAt: Date.now(),
      ...(over.projectId ? { projectId: over.projectId } : {}),
      ...(over.createdByTokenId ? { createdByTokenId: over.createdByTokenId } : {}),
      ...(over.lastMaterializedSlot !== undefined
        ? { lastMaterializedSlot: over.lastMaterializedSlot }
        : {}),
    }),
  );
}

const countTasks = (t: ReturnType<typeof convexTest>) =>
  t.run((ctx) => ctx.db.query("tasks").collect());

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

describe("schedules.createScheduleForAgent", () => {
  test("creates a token-attributed schedule from the agent path", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const tokenId = await t.run((ctx) =>
      ctx.db.insert("apiTokens", {
        userId,
        tokenType: "api_key" as const,
        name: "agent",
        tokenHash: "h",
        tokenPrefix: "lh_x",
        scope: "tasks:write",
        createdAt: Date.now(),
        expiresAt: Date.now() + 1_000_000,
      }),
    );

    const res = await t.mutation(internal.schedules.createScheduleForAgent, {
      userId,
      tokenId,
      cron: "0 9 * * *",
      timezone: "America/New_York",
      taskTemplate: template,
    });
    expect(res.next_run_at).toBeGreaterThan(Date.now());
    const row = await t.run((ctx) => ctx.db.get(res.schedule_id));
    expect(row?.createdByTokenId).toBe(tokenId);
    expect(row?.timezone).toBe("America/New_York");
  });

  test("rejects an invalid cron from the agent path", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const tokenId = await t.run((ctx) =>
      ctx.db.insert("apiTokens", {
        userId,
        tokenType: "api_key" as const,
        name: "agent",
        tokenHash: "h2",
        tokenPrefix: "lh_y",
        scope: "tasks:write",
        createdAt: Date.now(),
        expiresAt: Date.now() + 1_000_000,
      }),
    );
    await expect(
      t.mutation(internal.schedules.createScheduleForAgent, {
        userId,
        tokenId,
        cron: "nope",
        taskTemplate: template,
      }),
    ).rejects.toThrow();
  });
});

describe("schedules.tick", () => {
  test("materializes one open task for a due slot and advances nextRunAt", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const slot = Date.now() - 60_000;
    const id = await insertSchedule(t, userId, { nextRunAt: slot });

    const res = await t.mutation(internal.schedules.tick, {});
    expect(res.materialized).toBe(1);

    const tasks = await countTasks(t);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("open");
    expect(tasks[0].title).toBe(template.title);

    const sched = await t.run((ctx) => ctx.db.get(id));
    expect(sched?.nextRunAt).toBeGreaterThan(Date.now());
    expect(sched?.lastMaterializedSlot).toBe(slot);
  });

  test("a long-overdue schedule makes exactly one catch-up task, not a burst", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    await insertSchedule(t, userId, { nextRunAt: Date.now() - 10 * 24 * 60 * 60 * 1000 });

    const res = await t.mutation(internal.schedules.tick, {});
    expect(res.materialized).toBe(1);
    expect(await countTasks(t)).toHaveLength(1);
  });

  test("a second tick does not double-fire the same slot", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    await insertSchedule(t, userId, { nextRunAt: Date.now() - 60_000 });

    await t.mutation(internal.schedules.tick, {});
    const res2 = await t.mutation(internal.schedules.tick, {});
    expect(res2.materialized).toBe(0);
    expect(await countTasks(t)).toHaveLength(1);
  });

  test("skipIfPrevOpen drops a slot while the prior task is unresolved", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const id = await insertSchedule(t, userId, {
      nextRunAt: Date.now() - 60_000,
      skipIfPrevOpen: true,
    });

    await t.mutation(internal.schedules.tick, {}); // task1 (open)
    expect(await countTasks(t)).toHaveLength(1);

    // Next slot comes due while task1 is still open → skip.
    await t.run((ctx) => ctx.db.patch(id, { nextRunAt: Date.now() - 1_000 }));
    const skipped = await t.mutation(internal.schedules.tick, {});
    expect(skipped.materialized).toBe(0);
    expect(await countTasks(t)).toHaveLength(1);

    // Resolve task1, then a due slot materializes again.
    const tasks = await countTasks(t);
    await t.run((ctx) => ctx.db.patch(tasks[0]._id, { status: "done" }));
    await t.run((ctx) => ctx.db.patch(id, { nextRunAt: Date.now() - 1_000 }));
    const fired = await t.mutation(internal.schedules.tick, {});
    expect(fired.materialized).toBe(1);
    expect(await countTasks(t)).toHaveLength(2);
  });

  test("auto-disables a schedule whose project is gone", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const projectId = await t.run((ctx) =>
      ctx.db.insert("projects", { name: "P", userId, isDefault: false, createdAt: Date.now() }),
    );
    const id = await insertSchedule(t, userId, { projectId, nextRunAt: Date.now() - 60_000 });
    await t.run((ctx) => ctx.db.delete(projectId));

    const res = await t.mutation(internal.schedules.tick, {});
    expect(res.disabled).toBe(1);
    expect(res.materialized).toBe(0);
    expect((await t.run((ctx) => ctx.db.get(id)))?.enabled).toBe(false);
    expect(await countTasks(t)).toHaveLength(0);
  });
});

describe("active-schedule cap", () => {
  test("rejects creating past the active-schedule cap", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    for (let i = 0; i < MAX_ACTIVE_SCHEDULES; i++) await insertSchedule(t, userId);

    await expect(
      asOwner.mutation(api.schedules.create, {
        name: "one too many",
        cron: "0 9 * * *",
        timezone: "UTC",
        taskTemplate: template,
      }),
    ).rejects.toThrow();
  });

  test("disabled schedules don't count against the cap", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    for (let i = 0; i < MAX_ACTIVE_SCHEDULES - 1; i++) await insertSchedule(t, userId);
    await insertSchedule(t, userId, { enabled: false });

    // At the cap on total rows but one is disabled, so one create still fits.
    const id = await asOwner.mutation(api.schedules.create, {
      name: "fits",
      cron: "0 9 * * *",
      timezone: "UTC",
      taskTemplate: template,
    });
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  });
});
