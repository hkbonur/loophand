// Tag hygiene for the kanban. Tags are agent/user-supplied strings used for
// grouping and board filtering, so every write path normalizes them through here
// — trim, lowercase, drop empties, cap length, dedupe, cap count. Bounding both
// length and count keeps the stored-XSS / abuse surface small (tags render as
// plain text only) and holds tag sprawl in check.

export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS = 12;

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}
