// Append a tag to a list, trimming and skipping empties and case-insensitive
// duplicates. The server re-normalizes on save (lib/tags.normalizeTags); this
// keeps the editor's optimistic state tidy in the meantime.
export function addTag(tags: string[], raw: string): string[] {
  const tag = raw.trim();
  if (!tag) return tags;
  if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}
