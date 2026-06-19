import { ConvexError } from "convex/values";

// Image types loophand stores for visual_review. The browser only ever renders
// these as <img> data — never executes them — but we still sniff magic bytes so
// a caller can't smuggle a non-image blob in under an image label.
export const ALLOWED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ScreenshotContentType = (typeof ALLOWED_SCREENSHOT_TYPES)[number];

// 8 MB cap on the decoded image. Base64 inflates ~33%, so the inbound JSON-RPC
// argument stays comfortably under Convex's request-size ceiling.
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

export interface DecodedScreenshot {
  bytes: Uint8Array;
  contentType: ScreenshotContentType;
  size: number;
}

function fail(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message });
}

// Agents may send a raw base64 string or a full `data:image/png;base64,…` URL.
function stripDataUrlPrefix(value: string): string {
  if (!value.startsWith("data:")) return value;
  const comma = value.indexOf(",");
  return comma === -1 ? value : value.slice(comma + 1);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Identify the image format from its leading bytes. Returns null for anything
// that isn't one of the allowed raster formats.
function sniffImageType(b: Uint8Array): ScreenshotContentType | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Decode and validate an inbound screenshot. The content type is derived from
 * the bytes themselves (not a caller-supplied label), so a mismatch is
 * impossible. Throws a VALIDATION_ERROR ConvexError on any malformed input.
 */
export function decodeScreenshotUpload(
  dataBase64: string,
  opts?: { maxBytes?: number },
): DecodedScreenshot {
  const maxBytes = opts?.maxBytes ?? MAX_SCREENSHOT_BYTES;
  const normalized = stripDataUrlPrefix(dataBase64.trim());
  if (normalized.length === 0) fail("Screenshot is empty.");

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(normalized);
  } catch {
    fail("data_base64 is not valid base64.");
  }
  if (bytes.byteLength === 0) fail("Screenshot is empty.");
  if (bytes.byteLength > maxBytes) {
    fail(`Screenshot is ${bytes.byteLength} bytes; the limit is ${maxBytes}.`);
  }

  const contentType = sniffImageType(bytes);
  if (!contentType) fail("Screenshot is not a PNG, JPEG, or WEBP image.");

  return { bytes, contentType, size: bytes.byteLength };
}
