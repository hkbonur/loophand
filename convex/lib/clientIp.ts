// Best-effort client IP from forwarding headers. Used as the rate-limit key on
// the auth-failure path. Falls back to a constant so a missing header doesn't
// throw — it just buckets unknowns together.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
}
