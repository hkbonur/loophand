import { z } from "zod";
import { mcpError } from "./responses";

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: ReturnType<typeof mcpError> };

// Some MCP hosts serialize nested object/array args as JSON strings. Parse once,
// and on a type-mismatch JSON.parse the offending string values and retry once.
function safeParseWithJsonCoercion<S extends z.ZodType>(schema: S, input: unknown) {
  const first = schema.safeParse(input);
  if (first.success) return first;
  const coerced = coerceStringifiedJsonArgs(input, first.error.issues);
  return coerced.changed ? schema.safeParse(coerced.input) : first;
}

export function parseMcpInput<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = safeParseWithJsonCoercion(schema, input);
  if (result.success) return { ok: true, data: result.data };

  const issues = result.error.issues;
  if (issues.length === 0) return { ok: false, error: mcpError("Invalid input") };

  const details = issues.map((issue) => {
    const received = renderReceived(getAtPath(input, issue.path));
    return {
      path: issue.path.length === 0 ? "input" : issue.path.map(String).join("."),
      message: issue.message,
      ...(received !== undefined ? { received } : {}),
    };
  });
  const summary = details
    .map(
      (d) =>
        `${d.path}: ${d.message}${d.received !== undefined ? ` (received ${d.received})` : ""}`,
    )
    .join("; ");
  return {
    ok: false,
    error: mcpError("Invalid input", summary, details, {
      suggestion:
        "Fix the listed fields and retry the same tool call with all other arguments unchanged. Pass numbers, booleans, arrays, and objects as native JSON values — not as quoted strings.",
      recoverable: true,
    }),
  };
}

const RECEIVED_MAX_LENGTH = 80;

function renderReceived(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  let rendered: string;
  try {
    rendered = JSON.stringify(value) ?? String(value);
  } catch {
    rendered = String(value);
  }
  return rendered.length > RECEIVED_MAX_LENGTH
    ? `${rendered.slice(0, RECEIVED_MAX_LENGTH)}…`
    : rendered;
}

function coerceStringifiedJsonArgs(
  input: unknown,
  issues: readonly z.core.$ZodIssue[],
): { input: unknown; changed: boolean } {
  let next = input;
  let changed = false;
  for (const issue of issues) {
    if (issue.code !== "invalid_type") continue;
    if (issue.expected !== "object" && issue.expected !== "array") continue;
    const current = getAtPath(next, issue.path);
    if (typeof current !== "string") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch {
      continue;
    }
    const isObject = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    if (issue.expected === "object" && !isObject) continue;
    if (issue.expected === "array" && !Array.isArray(parsed)) continue;
    next = setAtPath(next, issue.path, parsed);
    changed = true;
  }
  return { input: next, changed };
}

function getAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let cur = root;
  for (const seg of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[seg];
  }
  return cur;
}

function setAtPath(root: unknown, path: readonly PropertyKey[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = root.slice();
    copy[Number(head)] = setAtPath(copy[Number(head)], rest, value);
    return copy;
  }
  if (root !== null && typeof root === "object") {
    const copy = { ...(root as Record<PropertyKey, unknown>) };
    copy[head] = setAtPath(copy[head], rest, value);
    return copy;
  }
  return root;
}
