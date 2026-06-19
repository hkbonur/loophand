import type { McpTool } from "../types";
import { ALLOWED_VERBS, extractVerb } from "./toolNameLint";

const MIN_LENGTH = 20;

// Every description must include at least one of these terms so it names what
// the tool does to state. Deterministic — no LLM nit has anything to grab once
// this passes.
const SEMANTIC_HINTS = [
  "returns",
  "read-only",
  "creates",
  "create",
  "updates",
  "update",
  "deletes",
  "delete",
  "cancels",
  "cancel",
  "lists",
  "list ",
  "gets",
  "get the",
  "get a",
  "blocks",
  "waits",
  "await",
  "resolves",
  "resolve",
  "consumes",
  "fetches",
  "fetch",
  "idempotent",
  "reversible",
];

export function assertDescriptionQuality(tools: readonly McpTool[]): void {
  const violations: string[] = [];
  const names = new Set(tools.map((t) => t.name));
  for (const t of tools) {
    const desc = t.description.trim();
    if (desc.length === 0) {
      violations.push(`${t.name}: empty description`);
      continue;
    }
    if (desc.length < MIN_LENGTH) {
      violations.push(`${t.name}: too short (${desc.length} chars)`);
      continue;
    }
    if (echoesName(t.name, desc)) violations.push(`${t.name}: echoes name`);
    if (!hasSemanticHint(desc)) {
      violations.push(
        `${t.name}: missing semantic hint (need one of: returns, creates, updates, deletes, lists, blocks, …)`,
      );
    }
    for (const ref of findBrokenCrossRefs(desc, names, t.name)) {
      violations.push(`${t.name}: references unknown tool \`${ref}\``);
    }
  }
  if (violations.length > 0) {
    throw new Error(`MCP tool description violations:\n  ${violations.join("\n  ")}`);
  }
}

function echoesName(name: string, description: string): boolean {
  const tokens = name
    .split("_")
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((t) => t.toLowerCase());
  if (tokens.length < 2) return false;
  const firstSentence = description.split(/[.!?]/)[0]?.toLowerCase() ?? "";
  return firstSentence.startsWith(tokens.join(" "));
}

function hasSemanticHint(description: string): boolean {
  const lower = description.toLowerCase();
  return SEMANTIC_HINTS.some((hint) => lower.includes(hint));
}

const TOOL_REF_RE = /\b([a-z][a-zA-Z]*_[a-zA-Z]+)/g;

function findBrokenCrossRefs(
  description: string,
  names: ReadonlySet<string>,
  selfName: string,
): string[] {
  const broken = new Set<string>();
  for (const match of description.matchAll(TOOL_REF_RE)) {
    const ref = match[1];
    if (match.index === undefined) continue;
    if (description.charAt(match.index + ref.length) === "*") continue;
    if (ref === selfName) continue;
    if (names.has(ref)) continue;
    const verb = extractVerb(ref);
    if (verb === null) continue;
    if (!ALLOWED_VERBS.has(verb)) continue;
    broken.add(ref);
  }
  return Array.from(broken);
}
