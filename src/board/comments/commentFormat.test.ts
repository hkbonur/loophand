import { describe, it, expect } from "vitest";
import { commentTimeLabel } from "./commentFormat";

const now = 10_000_000_000;

describe("commentTimeLabel", () => {
  it("shows 'just now' under a minute", () => {
    expect(commentTimeLabel(now - 30_000, now)).toBe("just now");
  });

  it("shows minutes", () => {
    expect(commentTimeLabel(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("shows hours", () => {
    expect(commentTimeLabel(now - 3 * 3_600_000, now)).toBe("3h ago");
  });

  it("shows days", () => {
    expect(commentTimeLabel(now - 2 * 86_400_000, now)).toBe("2d ago");
  });

  it("clamps a future timestamp to 'just now'", () => {
    expect(commentTimeLabel(now + 5000, now)).toBe("just now");
  });
});
