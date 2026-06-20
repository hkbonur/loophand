import { describe, it, expect } from "vitest";
import { groupPreferences, type PrefEntry } from "./preferenceGroups";
import type { Id } from "../../convex/_generated/dataModel";

const pid = (s: string) => s as Id<"projects">;
const entry = (over: Partial<PrefEntry>): PrefEntry => ({
  _id: "p" as Id<"preferences">,
  projectId: null,
  key: "k",
  value: "v",
  ...over,
});

describe("groupPreferences", () => {
  it("returns nothing for no preferences", () => {
    expect(groupPreferences([], [])).toEqual([]);
  });

  it("puts the user-level fallback first, then projects alphabetically", () => {
    const groups = groupPreferences(
      [
        entry({ key: "brand", projectId: null }),
        entry({ key: "deploy", projectId: pid("proj_b") }),
        entry({ key: "deploy", projectId: pid("proj_a") }),
      ],
      [
        { _id: pid("proj_a"), name: "Alpha" },
        { _id: pid("proj_b"), name: "Beta" },
      ],
    );
    expect(groups.map((g) => g.label)).toEqual(["All projects (fallback)", "Alpha", "Beta"]);
    expect(groups[0].scope).toBe("user");
  });

  it("sorts entries within a group by key", () => {
    const groups = groupPreferences(
      [entry({ key: "zeta" }), entry({ key: "alpha" })],
      [],
    );
    expect(groups[0].entries.map((e) => e.key)).toEqual(["alpha", "zeta"]);
  });

  it("labels a project with no matching name as unknown", () => {
    const groups = groupPreferences([entry({ key: "k", projectId: pid("gone") })], []);
    expect(groups[0].label).toBe("Unknown project");
  });

  it("omits a scope with no entries", () => {
    const groups = groupPreferences([entry({ key: "k", projectId: pid("proj_a") })], [
      { _id: pid("proj_a"), name: "Alpha" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].scope).toBe(pid("proj_a"));
  });
});
