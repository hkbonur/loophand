import { ConvexError } from "convex/values";

// Thin wrapper around a rate-limiter `.limit()` call. Two deliberate behaviours,
// both matching the magic-link limiter in lib/auth.ts:
//   - over budget  → throw RATE_LIMITED so the caller (an agent tool) gets a
//     clear, retryable error instead of a silent drop;
//   - limiter error → FAIL OPEN, so a limiter hiccup never strands a legit
//     write. The limit is an abuse backstop, not a correctness gate.
// The `.limit()` call is injected so the policy is unit-testable without the
// Convex rate-limiter component.
export async function enforceLimit(
  limit: () => Promise<{ ok: boolean }>,
  action: string,
): Promise<void> {
  let status: { ok: boolean };
  try {
    status = await limit();
  } catch {
    return;
  }
  if (!status.ok) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `Rate limit reached for ${action}. Wait a moment and retry.`,
    });
  }
}
