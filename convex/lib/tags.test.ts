import { describe, expect, test } from "vitest";
import { normalizeTags, MAX_TAGS, MAX_TAG_LENGTH } from "./tags";

describe("normalizeTags", () => {
  test("returns an empty array for undefined or empty input", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags([])).toEqual([]);
  });

  test("trims surrounding whitespace and lowercases", () => {
    expect(normalizeTags(["  Docs  ", "FEATURE"])).toEqual(["docs", "feature"]);
  });

  test("drops empty and whitespace-only tags", () => {
    expect(normalizeTags(["", "   ", "docs"])).toEqual(["docs"]);
  });

  test("dedupes case-insensitively, preserving first-seen order", () => {
    expect(normalizeTags(["Docs", "docs", "feature", "Feature"])).toEqual(["docs", "feature"]);
  });

  test("caps each tag to MAX_TAG_LENGTH characters", () => {
    const long = "x".repeat(MAX_TAG_LENGTH + 10);
    expect(normalizeTags([long])).toEqual(["x".repeat(MAX_TAG_LENGTH)]);
  });

  test("caps the number of tags to MAX_TAGS, keeping the first ones", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag-${i}`);
    const result = normalizeTags(many);
    expect(result).toHaveLength(MAX_TAGS);
    expect(result[0]).toBe("tag-0");
    expect(result.at(-1)).toBe(`tag-${MAX_TAGS - 1}`);
  });
});
