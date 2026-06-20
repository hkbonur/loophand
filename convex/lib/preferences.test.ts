import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MAX_PREF_KEY_LENGTH,
  MAX_PREF_VALUE_LENGTH,
  normalizePrefKey,
  normalizePrefValue,
  resolvePreferences,
} from "./preferences";

describe("normalizePrefKey", () => {
  it("trims and lowercases so lookups are case-insensitive", () => {
    expect(normalizePrefKey("  Brand-Color  ")).toBe("brand-color");
  });

  it("rejects an empty/whitespace key", () => {
    expect(() => normalizePrefKey("   ")).toThrow(ConvexError);
  });

  it("rejects a key over the length cap", () => {
    expect(() => normalizePrefKey("k".repeat(MAX_PREF_KEY_LENGTH + 1))).toThrow(ConvexError);
  });

  it("accepts a key at exactly the cap", () => {
    const key = "k".repeat(MAX_PREF_KEY_LENGTH);
    expect(normalizePrefKey(key)).toBe(key);
  });
});

describe("normalizePrefValue", () => {
  it("trims the value", () => {
    expect(normalizePrefValue("  #ff0000  ")).toBe("#ff0000");
  });

  it("rejects an empty value (use remove to clear)", () => {
    expect(() => normalizePrefValue("   ")).toThrow(ConvexError);
  });

  it("rejects a value over the length cap", () => {
    expect(() => normalizePrefValue("v".repeat(MAX_PREF_VALUE_LENGTH + 1))).toThrow(ConvexError);
  });
});

describe("resolvePreferences", () => {
  it("returns an empty object for no rows", () => {
    expect(resolvePreferences([], [])).toEqual({});
  });

  it("unions user and project keys", () => {
    const resolved = resolvePreferences(
      [{ key: "brand-color", value: "#000" }],
      [{ key: "deploy-target", value: "staging" }],
    );
    expect(resolved).toEqual({ "brand-color": "#000", "deploy-target": "staging" });
  });

  it("lets a project preference override the user-level fallback", () => {
    const resolved = resolvePreferences(
      [{ key: "brand-color", value: "#000" }],
      [{ key: "brand-color", value: "#fff" }],
    );
    expect(resolved).toEqual({ "brand-color": "#fff" });
  });
});
