import { describe, expect, test } from "vitest";
import { nextSlot, isValidCron } from "./cron";

describe("isValidCron", () => {
  test("accepts standard 5-field expressions", () => {
    expect(isValidCron("0 9 * * *")).toBe(true);
    expect(isValidCron("*/15 * * * *")).toBe(true);
  });
  test("rejects garbage", () => {
    expect(isValidCron("not a cron")).toBe(false);
    expect(isValidCron("")).toBe(false);
  });
});

describe("nextSlot", () => {
  test("returns the next slot strictly after the given instant (UTC)", () => {
    const after = Date.parse("2024-01-01T09:05:00Z");
    const next = nextSlot("0 9 * * *", "UTC", after);
    expect(new Date(next).toISOString()).toBe("2024-01-02T09:00:00.000Z");
  });

  test("honors IANA timezone — 9am New York is 14:00Z in winter", () => {
    const after = Date.parse("2024-01-01T00:00:00Z");
    const next = nextSlot("0 9 * * *", "America/New_York", after);
    expect(new Date(next).toISOString()).toBe("2024-01-01T14:00:00.000Z");
  });

  test("crosses a DST fall-back correctly (9am NY: 13:00Z then 14:00Z)", () => {
    // Nov 3 2024 02:00 EDT → 01:00 EST. 9am stays 9am local across the change.
    const beforeChange = Date.parse("2024-11-01T14:00:00Z"); // 10:00 EDT, past 9am
    const slot1 = nextSlot("0 9 * * *", "America/New_York", beforeChange);
    expect(new Date(slot1).toISOString()).toBe("2024-11-02T13:00:00.000Z"); // EDT, UTC-4
    const slot2 = nextSlot("0 9 * * *", "America/New_York", slot1);
    expect(new Date(slot2).toISOString()).toBe("2024-11-03T14:00:00.000Z"); // EST, UTC-5
  });

  test("throws on an invalid expression", () => {
    expect(() => nextSlot("nope", "UTC", Date.now())).toThrow();
  });
});
