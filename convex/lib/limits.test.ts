import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MAX_ITEMS_PER_TASK,
  MAX_OUTPUT_BYTES,
  MAX_STORAGE_BYTES_PER_USER,
  assertItemCount,
  assertOutputSize,
  assertWithinStorageQuota,
} from "./limits";

describe("assertItemCount", () => {
  it("accepts a task at the item cap", () => {
    expect(() => assertItemCount(MAX_ITEMS_PER_TASK)).not.toThrow();
  });

  it("rejects a task over the item cap", () => {
    expect(() => assertItemCount(MAX_ITEMS_PER_TASK + 1)).toThrow(ConvexError);
  });
});

describe("assertOutputSize", () => {
  it("accepts an output at the size cap", () => {
    expect(() => assertOutputSize(MAX_OUTPUT_BYTES)).not.toThrow();
  });

  it("rejects an output over the size cap", () => {
    expect(() => assertOutputSize(MAX_OUTPUT_BYTES + 1)).toThrow(ConvexError);
  });

  it("rejects a non-positive size", () => {
    expect(() => assertOutputSize(0)).toThrow(ConvexError);
  });
});

describe("assertWithinStorageQuota", () => {
  it("accepts an add that lands exactly on the quota", () => {
    expect(() => assertWithinStorageQuota(MAX_STORAGE_BYTES_PER_USER - 10, 10)).not.toThrow();
  });

  it("rejects an add that would exceed the quota", () => {
    expect(() => assertWithinStorageQuota(MAX_STORAGE_BYTES_PER_USER, 1)).toThrow(ConvexError);
  });
});
