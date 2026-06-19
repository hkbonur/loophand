import { describe, expect, test } from "vitest";
import { requireTaskScope } from "./scope";
import type { McpContext } from "../../types";

function ctxWithScope(scope: string | undefined): McpContext {
  return {
    ctx: {} as McpContext["ctx"],
    userId: "u" as McpContext["userId"],
    tokenId: "t" as McpContext["tokenId"],
    scope,
  };
}

describe("requireTaskScope", () => {
  test("tasks:write grants both read and write", () => {
    const ctx = ctxWithScope("tasks:write");
    expect(() => requireTaskScope(ctx, "read")).not.toThrow();
    expect(() => requireTaskScope(ctx, "write")).not.toThrow();
  });

  test("tasks:read grants read but not write", () => {
    const ctx = ctxWithScope("tasks:read");
    expect(() => requireTaskScope(ctx, "read")).not.toThrow();
    expect(() => requireTaskScope(ctx, "write")).toThrow();
  });

  test("an empty scope grants nothing", () => {
    const ctx = ctxWithScope(undefined);
    expect(() => requireTaskScope(ctx, "read")).toThrow();
    expect(() => requireTaskScope(ctx, "write")).toThrow();
  });
});
