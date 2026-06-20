// Agent liveness, derived from an API token's `lastUsedAt` (stamped on every
// authenticated tool call). Shared by the Agents panel and the board's
// attribution chips.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Idle longer than this and an agent is treated as "went dark". Generous enough
// that an agent blocked in await_task between calls isn't flagged on a blink.
export const DARK_AFTER_MS = 10 * MINUTE;

// Human-readable "last seen", e.g. "Active now", "5m ago", "Never used".
export function lastSeenLabel(lastUsedAt: number | undefined, now: number): string {
  if (lastUsedAt === undefined) return "Never used";
  const delta = Math.max(0, now - lastUsedAt);
  if (delta < MINUTE) return "Active now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  return `${Math.floor(delta / DAY)}d ago`;
}

// True once an agent has been idle past the dark threshold. A never-used token
// is not "dark" — it simply hasn't connected yet.
export function isAgentDark(lastUsedAt: number | undefined, now: number): boolean {
  if (lastUsedAt === undefined) return false;
  return now - lastUsedAt > DARK_AFTER_MS;
}
