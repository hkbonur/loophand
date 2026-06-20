import { CronExpressionParser } from "cron-parser";

// Cron evaluation for recurring schedules (Phase 5). Wraps cron-parser so the
// rest of the codebase deals in epoch-ms slots, not parser objects. Timezone is
// an IANA name; the parser handles DST (a daily 9am slot stays 9am local across
// the change). Standard 5-field expressions (min hour dom mon dow).

// Next slot strictly after `after` (epoch ms), in the given IANA timezone.
export function nextSlot(cron: string, tz: string, after: number): number {
  const it = CronExpressionParser.parse(cron, { tz, currentDate: new Date(after) });
  return it.next().toDate().getTime();
}

export function isValidCron(cron: string): boolean {
  // cron-parser treats "" as all-wildcards; an empty schedule cron is never
  // intended, so reject it explicitly.
  if (!cron.trim()) return false;
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}

// An IANA timezone the runtime's Intl can resolve (e.g. "America/New_York").
export function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
