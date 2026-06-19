// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupUser(t: ReturnType<typeof convexTest>, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { email, createdAt: Date.now() }));
}

const SUB = { endpoint: "https://push.example/abc", p256dh: "key-p256", auth: "key-auth" };

describe("push subscriptions", () => {
  test("subscribe stores a subscription for the signed-in user", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.push.subscribe, SUB);

    const rows = await t.run((ctx) => ctx.db.query("pushSubscriptions").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ endpoint: SUB.endpoint, p256dh: SUB.p256dh, auth: SUB.auth });
  });

  test("re-subscribing the same endpoint updates keys instead of duplicating", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.push.subscribe, SUB);
    await asOwner.mutation(api.push.subscribe, { ...SUB, p256dh: "rotated", auth: "rotated" });

    const rows = await t.run((ctx) => ctx.db.query("pushSubscriptions").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ p256dh: "rotated", auth: "rotated" });
  });

  test("unsubscribe removes your own subscription", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    const asOwner = t.withIdentity({ email: "owner@example.com" });

    await asOwner.mutation(api.push.subscribe, SUB);
    await asOwner.mutation(api.push.unsubscribe, { endpoint: SUB.endpoint });

    const rows = await t.run((ctx) => ctx.db.query("pushSubscriptions").collect());
    expect(rows).toHaveLength(0);
  });

  test("unsubscribe cannot remove another user's subscription", async () => {
    const t = convexTest(schema, modules);
    await setupUser(t, "owner@example.com");
    await setupUser(t, "stranger@example.com");
    await t.withIdentity({ email: "owner@example.com" }).mutation(api.push.subscribe, SUB);

    await t.withIdentity({ email: "stranger@example.com" }).mutation(api.push.unsubscribe, {
      endpoint: SUB.endpoint,
    });

    const rows = await t.run((ctx) => ctx.db.query("pushSubscriptions").collect());
    expect(rows).toHaveLength(1); // untouched
  });

  test("listForUser returns only that user's subscriptions", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await setupUser(t, "owner@example.com");
    await setupUser(t, "stranger@example.com");
    await t.withIdentity({ email: "owner@example.com" }).mutation(api.push.subscribe, SUB);
    await t
      .withIdentity({ email: "stranger@example.com" })
      .mutation(api.push.subscribe, { ...SUB, endpoint: "https://push.example/xyz" });

    const subs = await t.query(internal.push.listForUser, { userId: ownerId });
    expect(subs).toHaveLength(1);
    expect(subs[0].endpoint).toBe(SUB.endpoint);
  });
});
