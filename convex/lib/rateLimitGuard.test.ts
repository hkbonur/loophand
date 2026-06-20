import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { enforceLimit } from "./rateLimitGuard";

describe("enforceLimit", () => {
  test("does nothing when the limiter reports ok", async () => {
    await expect(enforceLimit(async () => ({ ok: true }), "create_task")).resolves.toBeUndefined();
  });

  test("throws RATE_LIMITED when the limiter reports not ok", async () => {
    await expect(enforceLimit(async () => ({ ok: false }), "create_task")).rejects.toMatchObject({
      data: { code: "RATE_LIMITED" },
    });
  });

  test("fails open when the limiter itself throws", async () => {
    await expect(
      enforceLimit(async () => {
        throw new Error("limiter unavailable");
      }, "create_task"),
    ).resolves.toBeUndefined();
  });

  test("the thrown error is a ConvexError carrying a helpful message", async () => {
    try {
      await enforceLimit(async () => ({ ok: false }), "create_task");
      throw new Error("expected enforceLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError);
      expect((err as ConvexError<{ message: string }>).data.message).toMatch(/rate/i);
    }
  });
});
