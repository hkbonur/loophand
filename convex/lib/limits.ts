// Abuse-backstop caps + quota for Phase 6 hardening. One source of truth for the
// limits that bound the create/upload surface (depends_on is capped separately
// in lib/deps; screenshot inputs in lib/screenshots). Generous enough to never
// bite normal use — each is a backstop against a runaway agent or a
// storage-growth abuse, not a product limit.
import { ConvexError } from "convex/values";

export const MAX_ITEMS_PER_TASK = 50;
export const MAX_OUTPUT_BYTES = 25 * 1024 * 1024; // 25 MB per human-produced artifact
export const MAX_STORAGE_BYTES_PER_USER = 500 * 1024 * 1024; // 500 MB of referenced blobs

export function assertItemCount(count: number): void {
  if (count > MAX_ITEMS_PER_TASK) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `A task carries at most ${MAX_ITEMS_PER_TASK} items (got ${count}).`,
    });
  }
}

export function assertOutputSize(bytes: number): void {
  if (bytes <= 0) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Output size must be positive." });
  }
  if (bytes > MAX_OUTPUT_BYTES) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Output is ${bytes} bytes; the limit is ${MAX_OUTPUT_BYTES}.`,
    });
  }
}

export function assertWithinStorageQuota(currentBytes: number, addBytes: number): void {
  if (currentBytes + addBytes > MAX_STORAGE_BYTES_PER_USER) {
    throw new ConvexError({
      code: "LIMIT_EXCEEDED",
      message: `Storage quota of ${MAX_STORAGE_BYTES_PER_USER} bytes would be exceeded. Delete some artifacts first.`,
    });
  }
}
