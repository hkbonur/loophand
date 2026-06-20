import { describe, expect, test } from "vitest";
import { nextRunLabel } from "./scheduleFormat";

const NOW = 1_000_000_000_000;
const MIN = 60_000;

describe("nextRunLabel", () => {
  test("due now / in the past reads as due", () => {
    expect(nextRunLabel(NOW - 1000, NOW)).toBe("due now");
    expect(nextRunLabel(NOW, NOW)).toBe("due now");
  });

  test("formats minutes, hours, and days out", () => {
    expect(nextRunLabel(NOW + 5 * MIN, NOW)).toBe("in 5m");
    expect(nextRunLabel(NOW + 3 * 60 * MIN, NOW)).toBe("in 3h");
    expect(nextRunLabel(NOW + 2 * 24 * 60 * MIN, NOW)).toBe("in 2d");
  });
});
