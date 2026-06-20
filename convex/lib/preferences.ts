// Standing rules / preferences hygiene. Preferences are project-scoped key/value
// strings with a user-level fallback — the biggest round-trip reducer: an agent
// reads them before asking the human ("always allow staging migrations",
// "brand color"). Keys are normalized (trim + lowercase) so a project override
// and its user-level fallback compare equal; both key and value are bounded to
// keep the abuse/stored-XSS surface small (preferences render as plain text).
import { ConvexError } from "convex/values";

export const MAX_PREF_KEY_LENGTH = 64;
export const MAX_PREF_VALUE_LENGTH = 512;
// Cap per scope (user-level rows, and each project's rows) to hold sprawl.
export const MAX_PREFS_PER_SCOPE = 64;

export interface PreferenceEntry {
  key: string;
  value: string;
}

export function normalizePrefKey(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Preference key is required." });
  }
  if (key.length > MAX_PREF_KEY_LENGTH) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Preference key exceeds ${MAX_PREF_KEY_LENGTH} characters.`,
    });
  }
  return key;
}

export function normalizePrefValue(raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Preference value is required; remove the preference to clear it.",
    });
  }
  if (value.length > MAX_PREF_VALUE_LENGTH) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Preference value exceeds ${MAX_PREF_VALUE_LENGTH} characters.`,
    });
  }
  return value;
}

// Merge user-level (fallback) and project-level (override) rows into the flat
// map the agent reads. Project wins on a key collision.
export function resolvePreferences(
  userRows: PreferenceEntry[],
  projectRows: PreferenceEntry[],
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const row of userRows) resolved[row.key] = row.value;
  for (const row of projectRows) resolved[row.key] = row.value;
  return resolved;
}
