import { describe, expect, test } from "vitest";
import { getAllTools, getCoreTools, getTool } from "./index";
import { isReadTool } from "../lib/toolNameLint";

// Importing ./index runs the registration lints (duplicate names, verb
// vocabulary, description quality) at module load — a malformed tool would throw
// here, failing the build rather than a request.

describe("MCP task tool catalog", () => {
  test("exposes the Phase 3 tools", () => {
    const names = new Set(getAllTools().map((t) => t.name));
    expect(names.has("create_task")).toBe(true);
    expect(names.has("fetch_file")).toBe(true);
    expect(names.has("resume_items")).toBe(true);
  });

  test("Phase 3 tools are advertised in the core catalog", () => {
    const core = new Set(getCoreTools().map((t) => t.name));
    expect(core.has("fetch_file")).toBe(true);
    expect(core.has("resume_items")).toBe(true);
  });

  test("fetch_file reads, resume_items writes (verb classification)", () => {
    expect(isReadTool("fetch_file")).toBe(true);
    expect(isReadTool("resume_items")).toBe(false);
  });

  test("create_task advertises items[] for multi-item review", () => {
    const tool = getTool("create_task");
    const props = tool?.inputSchema?.properties as Record<string, unknown> | undefined;
    expect(props && "items" in props).toBe(true);
  });
});
