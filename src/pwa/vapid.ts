// The PushManager wants the VAPID public key as a Uint8Array, but the server
// hands it out as a base64url string. Convert (pad, swap the URL-safe alphabet,
// decode).
// Returns a Uint8Array over a plain ArrayBuffer (not ArrayBufferLike) so it
// satisfies PushManager's applicationServerKey: BufferSource.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
