import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";

// loophand-owned R2 bucket. Configure the component's keys via
// `npx convex env set R2_*` (see @convex-dev/r2 docs).
export const r2 = new R2(components.r2);

export const SIGNED_URL_TTL_SECONDS = 60 * 15;

// R2 keys are random UUIDs — unguessable. The storage proxy validates the key
// shape before signing so the bucket can't be probed with arbitrary paths.
const R2_KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function isValidR2Key(key: string): boolean {
  return R2_KEY_RE.test(key);
}

export function generateR2Key(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// Permanent, embeddable URL for a stored blob. Points at the storage proxy on
// the Convex site domain (`registerStorageRoutes`), which signs a fresh R2 URL
// per request. CONVEX_SITE_URL is injected by the deployment; if absent (tests)
// the path is relative.
export function storageProxyUrl(r2Key: string): string {
  const base = process.env.CONVEX_SITE_URL ?? "";
  return `${base}/api/storage/${r2Key}`;
}
