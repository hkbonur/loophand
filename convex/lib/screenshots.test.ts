import { describe, expect, test } from "vitest";
import { decodeScreenshotUpload } from "./screenshots";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);

describe("decodeScreenshotUpload", () => {
  test("decodes a PNG and sniffs its content type", () => {
    const out = decodeScreenshotUpload(toBase64(PNG));
    expect(out.contentType).toBe("image/png");
    expect(out.size).toBe(PNG.byteLength);
    expect(Array.from(out.bytes)).toEqual(Array.from(PNG));
  });

  test("sniffs JPEG and WEBP magic bytes", () => {
    expect(decodeScreenshotUpload(toBase64(JPEG)).contentType).toBe("image/jpeg");
    expect(decodeScreenshotUpload(toBase64(WEBP)).contentType).toBe("image/webp");
  });

  test("strips a data: URL prefix", () => {
    const out = decodeScreenshotUpload(`data:image/png;base64,${toBase64(PNG)}`);
    expect(out.contentType).toBe("image/png");
  });

  test("rejects bytes that are not a known image", () => {
    expect(() => decodeScreenshotUpload(toBase64(new Uint8Array([1, 2, 3, 4])))).toThrow(
      /not a PNG|image/i,
    );
  });

  test("rejects invalid base64", () => {
    expect(() => decodeScreenshotUpload("not valid base64 @@@")).toThrow();
  });

  test("rejects an empty payload", () => {
    expect(() => decodeScreenshotUpload("")).toThrow();
  });

  test("rejects a payload over the byte cap", () => {
    const big = toBase64(new Uint8Array([...PNG, ...new Uint8Array(50)]));
    expect(() => decodeScreenshotUpload(big, { maxBytes: 8 })).toThrow(/limit|bytes/i);
  });
});
