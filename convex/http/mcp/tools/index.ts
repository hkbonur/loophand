import type { McpTool } from "../types";
import { assertDescriptionQuality } from "../lib/descriptionLint";
import { assertVerbVocabulary } from "../lib/toolNameLint";
import { taskTools } from "./tasks";

export function assertNoDuplicateToolNames(tools: McpTool[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) duplicates.add(tool.name);
    seen.add(tool.name);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate MCP tool names detected: ${Array.from(duplicates).sort().join(", ")}`,
    );
  }
}

const ALL_TOOLS: McpTool[] = [...taskTools];

// Registration lints run at module load — a malformed tool fails the build,
// not a request.
assertNoDuplicateToolNames(ALL_TOOLS);
assertVerbVocabulary(ALL_TOOLS);
assertDescriptionQuality(ALL_TOOLS);

const TOOL_MAP = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

// Tool names eagerly advertised on `tools/list`. With a small surface, every
// tool is core; the set exists so the catalog can be trimmed as tools grow.
const CORE_TOOL_NAMES = new Set<string>([
  "create_task",
  "await_task",
  "get_task",
  "cancel_task",
  "list_tasks",
  "list_projects",
  "create_project",
  "upload_screenshot",
  "fetch_file",
  "resume_items",
]);

const CORE_TOOLS = ALL_TOOLS.filter((t) => CORE_TOOL_NAMES.has(t.name));

export function getAllTools(): McpTool[] {
  return ALL_TOOLS;
}

export function getCoreTools(): McpTool[] {
  return CORE_TOOLS;
}

export function getTool(name: string): McpTool | undefined {
  return TOOL_MAP.get(name);
}

export function isMcpTool(name: string): boolean {
  return TOOL_MAP.has(name);
}
