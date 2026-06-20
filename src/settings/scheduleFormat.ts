const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Compact "next run" label, e.g. "in 5m", "in 3h", "in 2d", or "due now" once
// the slot has arrived (the minute tick will pick it up).
export function nextRunLabel(nextRunAt: number, now: number): string {
  const delta = nextRunAt - now;
  if (delta <= 0) return "due now";
  if (delta < HOUR) return `in ${Math.max(1, Math.floor(delta / MINUTE))}m`;
  if (delta < DAY) return `in ${Math.floor(delta / HOUR)}h`;
  return `in ${Math.floor(delta / DAY)}d`;
}
