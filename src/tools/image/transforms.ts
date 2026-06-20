// Client-side image transforms. The dimension math is pure (and unit-tested);
// applyOps does the actual canvas compositing in the browser. Ops compose: each
// re-applies over the working canvas, so crop → resize → tint chains naturally.

export type ImageOp =
  | { kind: "rotate"; deg: 90 | 180 | 270 }
  | { kind: "flip"; axis: "h" | "v" }
  | { kind: "grayscale" }
  | { kind: "resize"; width: number };

export const OUTPUT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

// Resize to a target width, preserving aspect ratio (rounded, min 1px).
export function resizeDimensions(
  width: number,
  height: number,
  targetWidth: number,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(targetWidth));
  const scale = w / width;
  return { width: w, height: Math.max(1, Math.round(height * scale)) };
}

// 90°/270° swap width and height; 180° keeps them.
export function rotatedDimensions(
  width: number,
  height: number,
  deg: 90 | 180 | 270,
): { width: number; height: number } {
  return deg === 180 ? { width, height } : { width: height, height: width };
}

const EXT: Record<OutputType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extensionFor(type: OutputType): string {
  return EXT[type];
}

// Draw `source` (at natural w×h) through one op into a fresh canvas. Browser-only
// (needs a real 2D context); callers chain these over the working canvas.
export function applyOp(
  source: CanvasImageSource,
  width: number,
  height: number,
  op: ImageOp,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  if (op.kind === "resize") {
    const d = resizeDimensions(width, height, op.width);
    canvas.width = d.width;
    canvas.height = d.height;
    canvas.getContext("2d")?.drawImage(source, 0, 0, d.width, d.height);
    return canvas;
  }

  if (op.kind === "rotate") {
    const d = rotatedDimensions(width, height, op.deg);
    canvas.width = d.width;
    canvas.height = d.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(d.width / 2, d.height / 2);
      ctx.rotate((op.deg * Math.PI) / 180);
      ctx.drawImage(source, -width / 2, -height / 2);
    }
    return canvas;
  }

  if (op.kind === "flip") {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(op.axis === "h" ? width : 0, op.axis === "v" ? height : 0);
      ctx.scale(op.axis === "h" ? -1 : 1, op.axis === "v" ? -1 : 1);
      ctx.drawImage(source, 0, 0);
    }
    return canvas;
  }

  // grayscale
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.filter = "grayscale(1)";
    ctx.drawImage(source, 0, 0);
  }
  return canvas;
}
