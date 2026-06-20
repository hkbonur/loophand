import type { Id } from "../../convex/_generated/dataModel";

// A standing-rule row as the board reads it (api.preferences.list).
export interface PrefEntry {
  _id: Id<"preferences">;
  projectId: Id<"projects"> | null;
  key: string;
  value: string;
}

export interface PrefGroup {
  // Stable grouping key: "user" for the fallback scope, else the project id.
  scope: "user" | Id<"projects">;
  label: string;
  entries: PrefEntry[];
}

const USER_LABEL = "All projects (fallback)";
const UNKNOWN_PROJECT = "Unknown project";

// Group preferences for display: the user-level fallback first, then one group
// per project that has rules, alphabetised by project name. Empty scopes are
// omitted — the panel renders its own empty state.
export function groupPreferences(
  prefs: PrefEntry[],
  projects: { _id: Id<"projects">; name: string }[],
): PrefGroup[] {
  const nameById = new Map(projects.map((p) => [p._id, p.name]));
  const byKey = (a: PrefEntry, b: PrefEntry) => a.key.localeCompare(b.key);

  const userEntries = prefs.filter((p) => p.projectId === null).sort(byKey);
  const groups: PrefGroup[] = [];
  if (userEntries.length > 0) {
    groups.push({ scope: "user", label: USER_LABEL, entries: userEntries });
  }

  const projectScopes = new Map<Id<"projects">, PrefEntry[]>();
  for (const pref of prefs) {
    if (pref.projectId === null) continue;
    const list = projectScopes.get(pref.projectId) ?? [];
    list.push(pref);
    projectScopes.set(pref.projectId, list);
  }

  const projectGroups: PrefGroup[] = [];
  for (const [projectId, entries] of projectScopes) {
    projectGroups.push({
      scope: projectId,
      label: nameById.get(projectId) ?? UNKNOWN_PROJECT,
      entries: entries.sort(byKey),
    });
  }
  projectGroups.sort((a, b) => a.label.localeCompare(b.label));

  return [...groups, ...projectGroups];
}
