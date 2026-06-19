import type { McpTool } from "../types";

// Tool-name verb vocabulary. `await`, `cancel`, `fetch`, and `resume` are in
// the set so await_task / cancel_task / fetch_file register without renaming.
export const ALLOWED_VERBS: ReadonlySet<string> = new Set([
  "create",
  "delete",
  "destroy",
  "restore",
  "disconnect",
  "get",
  "list",
  "update",
  "replace",
  "clear",
  "reset",
  "publish",
  "unpublish",
  "attach",
  "detach",
  "insert",
  "format",
  "test",
  "retry",
  "set",
  "load",
  "await",
  "cancel",
  "fetch",
  "resume",
]);

// Verbs that read state without mutating. `await` is a read (it long-polls for a
// result the human produces) so it shouldn't count as a write.
export const READ_VERBS: ReadonlySet<string> = new Set(["get", "list", "await", "fetch"]);

export function isReadTool(name: string): boolean {
  const verb = extractVerb(name);
  return verb !== null && READ_VERBS.has(verb);
}

export function extractVerb(name: string): string | null {
  const underscoreIdx = name.indexOf("_");
  if (underscoreIdx === -1) return null;
  const prefix = name.slice(0, underscoreIdx);
  if (ALLOWED_VERBS.has(prefix)) return prefix;
  const match = name.slice(underscoreIdx + 1).match(/^[a-z]+/);
  return match ? match[0] : null;
}

export function assertVerbVocabulary(tools: readonly McpTool[]): void {
  const violations: string[] = [];
  for (const t of tools) {
    if (!t.name.includes("_")) {
      violations.push(`${t.name} (missing prefix)`);
      continue;
    }
    const verb = extractVerb(t.name);
    if (verb === null) {
      violations.push(`${t.name} (unparseable)`);
      continue;
    }
    if (!ALLOWED_VERBS.has(verb)) {
      violations.push(`${t.name} (verb: ${verb})`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`MCP tool verb violations:\n  ${violations.join("\n  ")}`);
  }
}
