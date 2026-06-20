import { describe, expect, test } from "vitest";
import { addTag } from "./tagEdit";

describe("addTag", () => {
  test("appends a trimmed tag", () => {
    expect(addTag(["docs"], "  feature ")).toEqual(["docs", "feature"]);
  });

  test("ignores an empty or whitespace-only entry", () => {
    expect(addTag(["docs"], "")).toEqual(["docs"]);
    expect(addTag(["docs"], "   ")).toEqual(["docs"]);
  });

  test("skips a case-insensitive duplicate", () => {
    expect(addTag(["Docs"], "docs")).toEqual(["Docs"]);
  });
});
