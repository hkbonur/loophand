import { describe, expect, test } from "vitest";
import { urlBase64ToUint8Array } from "./vapid";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("urlBase64ToUint8Array", () => {
  test("round-trips arbitrary bytes through the URL-safe alphabet", () => {
    const original = new Uint8Array([0, 1, 62, 63, 250, 255, 128, 7]); // exercises +/- and / _
    expect(Array.from(urlBase64ToUint8Array(toBase64Url(original)))).toEqual(Array.from(original));
  });

  test("decodes an unpadded key (real VAPID keys drop the padding)", () => {
    // "Zm9vYmE" is base64url for "fooba" with the trailing "=" stripped.
    const bytes = urlBase64ToUint8Array("Zm9vYmE");
    expect(String.fromCharCode(...bytes)).toBe("fooba");
  });

  test("produces the 65-byte uncompressed EC point length for a real VAPID key", () => {
    const key = "BOgP6QayvLB5j2JyD4ChhwL75CvxAmkhugYYrGNQgClRVLjq0ApmKuU8FmRExiSEtgUL73rwf7zL00l8ZyEwNjU";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
