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

describe("tasks lifecycle", () => {
  test("createForAgent stamps userId + projectId and opens the task", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId, projectId } = await setupOwner(t, "owner@example.com");

    const { task, reused } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "Ship README",
      instructions: "Approve the README",
    });

    expect(reused).toBe(false);
    expect(task.status).toBe("open");
    expect(task.revision).toBe(0);
    expect(task.project_id).toBe(projectId);

    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.userId).toBe(userId);
    expect(row?.projectId).toBe(projectId);
  });

  test("createForAgent is idempotent on (userId, idempotencyKey)", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");

    const first = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
      idempotencyKey: "k1",
    });
    const second = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "B",
      instructions: "B",
      idempotencyKey: "k1",
    });

    expect(second.reused).toBe(true);
    expect(second.task.task_id).toBe(first.task.task_id);
  });

  test("approve moves open → awaiting_agent and stamps the outcome", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });

    const resolved = await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      revision: 0,
    });
    expect(resolved.status).toBe("awaiting_agent");
    expect(resolved.outcome).toBe("approved");

    // First agent read consumes it: awaiting_agent → resumed.
    const consumed = await t.mutation(internal.tasks.consumeForAgent, {
      userId,
      tokenId,
      taskId: task.task_id,
    });
    expect(consumed.status).toBe("resumed");
  });

  test("resolve rejects a stale revision", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });
    await expect(
      asOwner.mutation(api.tasks.resolve, {
        taskId: task.task_id,
        action: "approve",
        revision: 99,
      }),
    ).rejects.toThrow();
  });

  test("creating a task into a project you don't own is rejected", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    const stranger = await setupOwner(t, "stranger@example.com");

    // owner.projectId belongs to owner; stranger must not be able to file into it.
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId: stranger.userId,
        tokenId: stranger.tokenId,
        project: owner.projectId,
        type: "approval",
        title: "intrusion",
        instructions: "intrusion",
      }),
    ).rejects.toThrow();
  });

  test("a foreign user cannot read another user's task", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asStranger = t.withIdentity({ email: "stranger@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: owner.userId,
      tokenId: owner.tokenId,
      type: "approval",
      title: "secret",
      instructions: "secret",
    });

    // A foreign or stale task reads back as null (no throw, no existence leak) —
    // so a push deep-link to a task you no longer own shows the empty state.
    expect(await asStranger.query(api.tasks.get, { taskId: task.task_id })).toBeNull();
    // A malformed id from a tampered ?task= URL is also graceful.
    expect(await asStranger.query(api.tasks.get, { taskId: "not-a-real-id" })).toBeNull();
  });

  test("expire is a no-op once the task has left the queue", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });
    await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      revision: 0,
    });

    await t.mutation(internal.tasks.expire, { taskId: task.task_id });
    const row = await t.run((ctx) => ctx.db.get(task.task_id));
    expect(row?.outcome).toBe("approved");
    expect(row?.status).toBe("awaiting_agent");
  });
});

describe("tasks.close", () => {
  test("writes a taskAudit row when a resumed task is closed", async () => {
    const t = convexTest(schema, modules);
    const { userId, tokenId } = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId,
      tokenId,
      type: "approval",
      title: "A",
      instructions: "A",
    });
    await asOwner.mutation(api.tasks.resolve, {
      taskId: task.task_id,
      action: "approve",
      revision: 0,
    });
    await t.mutation(internal.tasks.consumeForAgent, { userId, tokenId, taskId: task.task_id });
    await asOwner.mutation(api.tasks.close, { taskId: task.task_id });

    const audits = await t.run((ctx) =>
      ctx.db
        .query("taskAudit")
        .withIndex("by_task", (q) => q.eq("taskId", task.task_id))
        .collect(),
    );
    const closeAudit = audits.find((a) => a.action === "close");
    expect(closeAudit).toBeTruthy();
    expect(closeAudit?.fromStatus).toBe("resumed");
    expect(closeAudit?.toStatus).toBe("done");
  });
});

describe("tasks dependencies (create)", () => {
  async function createDep(
    t: ReturnType<typeof convexTest>,
    ids: { userId: Id<"users">; tokenId: Id<"apiTokens"> },
  ) {
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "dep",
      instructions: "dep",
    });
    return task.task_id;
  }

  test("a task depending on an open task is born blocked, with an edge written", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const depId = await createDep(t, ids);

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "child",
      instructions: "child",
      dependsOn: [depId],
    });
    expect(task.status).toBe("blocked");

    const edges = await t.run((ctx) =>
      ctx.db
        .query("taskDeps")
        .withIndex("by_task", (q) => q.eq("taskId", task.task_id))
        .collect(),
    );
    expect(edges.map((e) => e.dependsOnTaskId)).toEqual([depId]);
  });

  test("a task whose deps are all approved is born open", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const depId = await createDep(t, ids);
    await asOwner.mutation(api.tasks.resolve, { taskId: depId, action: "approve", revision: 0 });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "child",
      instructions: "child",
      dependsOn: [depId],
    });
    expect(task.status).toBe("open");
  });

  test("a task depending on a failed task is born dependency_failed", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const depId = await createDep(t, ids);
    await t.mutation(internal.tasks.cancelForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      taskId: depId,
    });

    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "child",
      instructions: "child",
      dependsOn: [depId],
    });
    expect(task.status).toBe("done");
    expect(task.outcome).toBe("dependency_failed");
  });

  test("a future not_before makes a task blocked", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "later",
      instructions: "later",
      notBefore: Date.now() + 60_000,
    });
    expect(task.status).toBe("blocked");
  });

  test("a cross-project dependency is rejected", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const otherProject = await t.run((ctx) =>
      ctx.db.insert("projects", {
        name: "Other",
        userId: ids.userId,
        isDefault: false,
        createdAt: Date.now(),
      }),
    );
    const depElsewhere = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: ids.userId,
        projectId: otherProject,
        type: "approval",
        title: "elsewhere",
        instructions: "elsewhere",
        status: "open",
        resultVersion: 0,
        revision: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId: ids.userId,
        tokenId: ids.tokenId,
        type: "approval",
        title: "child",
        instructions: "child",
        dependsOn: [depElsewhere],
      }),
    ).rejects.toThrow();
  });

  test("an unknown dependency id is rejected", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    await expect(
      t.mutation(internal.tasks.createForAgent, {
        userId: ids.userId,
        tokenId: ids.tokenId,
        type: "approval",
        title: "child",
        instructions: "child",
        dependsOn: ["not-a-real-id"],
      }),
    ).rejects.toThrow();
  });
});

describe("tasks dependencies (unblock)", () => {
  async function create(
    t: ReturnType<typeof convexTest>,
    ids: { userId: Id<"users">; tokenId: Id<"apiTokens"> },
    dependsOn?: string[],
  ) {
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "t",
      instructions: "t",
      dependsOn,
    });
    return task;
  }

  async function statusOf(t: ReturnType<typeof convexTest>, id: Id<"tasks">) {
    const row = await t.run((ctx) => ctx.db.get(id));
    return row?.status;
  }

  test("approving the sole dep opens the dependent", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const dep = await create(t, ids);
    const child = await create(t, ids, [dep.task_id]);
    expect(child.status).toBe("blocked");

    await asOwner.mutation(api.tasks.resolve, {
      taskId: dep.task_id,
      action: "approve",
      revision: 0,
    });
    expect(await statusOf(t, child.task_id)).toBe("open");
  });

  test("a dependent on two deps unblocks exactly once both are approved", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const dep1 = await create(t, ids);
    const dep2 = await create(t, ids);
    const child = await create(t, ids, [dep1.task_id, dep2.task_id]);
    expect(child.status).toBe("blocked");

    await asOwner.mutation(api.tasks.resolve, {
      taskId: dep1.task_id,
      action: "approve",
      revision: 0,
    });
    // Still blocked — dep2 outstanding. Re-checking ALL deps is what prevents a
    // premature open here.
    expect(await statusOf(t, child.task_id)).toBe("blocked");

    await asOwner.mutation(api.tasks.resolve, {
      taskId: dep2.task_id,
      action: "approve",
      revision: 0,
    });
    expect(await statusOf(t, child.task_id)).toBe("open");
  });

  test("requesting changes on a dep leaves the dependent blocked", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const dep = await create(t, ids);
    const child = await create(t, ids, [dep.task_id]);

    await asOwner.mutation(api.tasks.resolve, {
      taskId: dep.task_id,
      action: "request_changes",
      revision: 0,
    });
    expect(await statusOf(t, child.task_id)).toBe("blocked");
  });
});

describe("tasks dependencies (failure cascade)", () => {
  async function create(
    t: ReturnType<typeof convexTest>,
    ids: { userId: Id<"users">; tokenId: Id<"apiTokens"> },
    dependsOn?: string[],
  ) {
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "t",
      instructions: "t",
      dependsOn,
    });
    return task;
  }

  async function rowOf(t: ReturnType<typeof convexTest>, id: Id<"tasks">) {
    return t.run((ctx) => ctx.db.get(id));
  }

  test("failing a root cascades dependency_failed down A -> B -> C", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const a = await create(t, ids);
    const b = await create(t, ids, [a.task_id]);
    const c = await create(t, ids, [b.task_id]);

    await t.mutation(internal.tasks.cancelForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      taskId: a.task_id,
    });

    const rb = await rowOf(t, b.task_id);
    const rc = await rowOf(t, c.task_id);
    expect(rb?.status).toBe("done");
    expect(rb?.outcome).toBe("dependency_failed");
    expect(rc?.status).toBe("done");
    expect(rc?.outcome).toBe("dependency_failed");
  });

  test("an expired dep fails its blocked dependents", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const dep = await create(t, ids);
    const child = await create(t, ids, [dep.task_id]);

    await t.mutation(internal.tasks.expire, { taskId: dep.task_id });
    const rc = await rowOf(t, child.task_id);
    expect(rc?.outcome).toBe("dependency_failed");
  });

  test("a dependent that already opened is not retroactively failed", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const dep = await create(t, ids);
    const child = await create(t, ids, [dep.task_id]);

    // Approve the dep so the child opens, then cancel the (now awaiting_agent) dep.
    await asOwner.mutation(api.tasks.resolve, {
      taskId: dep.task_id,
      action: "approve",
      revision: 0,
    });
    expect((await rowOf(t, child.task_id))?.status).toBe("open");

    await t.mutation(internal.tasks.cancelForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      taskId: dep.task_id,
    });
    // The child cleared the gate before the dep was cancelled — it stays open.
    expect((await rowOf(t, child.task_id))?.status).toBe("open");
  });
});

describe("tasks.deps view + depCount", () => {
  async function create(
    t: ReturnType<typeof convexTest>,
    ids: { userId: Id<"users">; tokenId: Id<"apiTokens"> },
    dependsOn?: string[],
  ) {
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      type: "approval",
      title: "t",
      instructions: "t",
      dependsOn,
    });
    return task;
  }

  test("deps() returns blockedBy and blocks neighbours", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const a = await create(t, ids);
    const b = await create(t, ids, [a.task_id]);

    const bDeps = await asOwner.query(api.deps.forTask, { taskId: b.task_id });
    expect(bDeps.blockedBy.map((d) => d._id)).toEqual([a.task_id]);
    expect(bDeps.blocks).toEqual([]);

    const aDeps = await asOwner.query(api.deps.forTask, { taskId: a.task_id });
    expect(aDeps.blocks.map((d) => d._id)).toEqual([b.task_id]);
    expect(aDeps.blockedBy).toEqual([]);
  });

  test("deps() is owner-checked", async () => {
    const t = convexTest(schema, modules);
    const owner = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const a = await create(t, owner);
    await expect(
      t.withIdentity({ email: "stranger@example.com" }).query(api.deps.forTask, { taskId: a.task_id }),
    ).rejects.toThrow();
  });

  test("depCount is the dep total for a blocked task, 0 otherwise", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const a = await create(t, ids);
    const b = await create(t, ids, [a.task_id]);

    expect((await asOwner.query(api.tasks.get, { taskId: b.task_id }))?.depCount).toBe(1);
    expect((await asOwner.query(api.tasks.get, { taskId: a.task_id }))?.depCount).toBe(0);
  });
});

describe("tasks.reopen (undo)", () => {
  async function openTask(t: ReturnType<typeof convexTest>, ids: { userId: Id<"users">; tokenId: Id<"apiTokens">; projectId: Id<"projects"> }) {
    const { task } = await t.mutation(internal.tasks.createForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      project: ids.projectId,
      type: "approval",
      title: "T",
      instructions: "i",
    });
    return task.task_id;
  }

  test("reverts a just-approved task back to open", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const taskId = await openTask(t, ids);

    await asOwner.mutation(api.tasks.resolve, { taskId, action: "approve", revision: 0 });
    await asOwner.mutation(api.tasks.reopen, { taskId });

    const row = await asOwner.query(api.tasks.get, { taskId });
    expect(row?.status).toBe("open");
    expect(row?.outcome).toBeNull();
  });

  test("refuses once the agent has consumed the result", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const taskId = await openTask(t, ids);

    await asOwner.mutation(api.tasks.resolve, { taskId, action: "approve", revision: 0 });
    await t.mutation(internal.tasks.consumeForAgent, {
      userId: ids.userId,
      tokenId: ids.tokenId,
      taskId,
    });

    await expect(asOwner.mutation(api.tasks.reopen, { taskId })).rejects.toThrow();
  });

  test("rejects undo from a non-owner", async () => {
    const t = convexTest(schema, modules);
    const ids = await setupOwner(t, "owner@example.com");
    await setupOwner(t, "stranger@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });
    const taskId = await openTask(t, ids);
    await asOwner.mutation(api.tasks.resolve, { taskId, action: "approve", revision: 0 });

    await expect(
      t.withIdentity({ email: "stranger@example.com" }).mutation(api.tasks.reopen, { taskId }),
    ).rejects.toThrow();
  });
});
