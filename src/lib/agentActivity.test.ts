import { describe, expect, test } from "vitest";
import { lastSeenLabel, isAgentDark, DARK_AFTER_MS } from "./agentActivity";

const NOW = 1_000_000_000_000;
const MIN = 60_000;

describe("lastSeenLabel", () => {
  test("reports never-used tokens", () => {
    expect(lastSeenLabel(undefined, NOW)).toBe("Never used");
  });

  test("reports a fresh call as active", () => {
    expect(lastSeenLabel(NOW - 5_000, NOW)).toBe("Active now");
  });

  test("reports minutes, hours, and days ago", () => {
    expect(lastSeenLabel(NOW - 5 * MIN, NOW)).toBe("5m ago");
    expect(lastSeenLabel(NOW - 3 * 60 * MIN, NOW)).toBe("3h ago");
    expect(lastSeenLabel(NOW - 2 * 24 * 60 * MIN, NOW)).toBe("2d ago");
  });
});

describe("isAgentDark", () => {
  test("a token used within the window is not dark", () => {
    expect(isAgentDark(NOW - (DARK_AFTER_MS - MIN), NOW)).toBe(false);
  });

  test("a token idle past the window is dark", () => {
    expect(isAgentDark(NOW - (DARK_AFTER_MS + MIN), NOW)).toBe(true);
  });

  test("a never-used token is not flagged dark", () => {
    expect(isAgentDark(undefined, NOW)).toBe(false);
  });
});
