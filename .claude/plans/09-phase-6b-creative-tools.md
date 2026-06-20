# Phase 6b — Creative artifact tools (image · PDF · HTML)

**Goal:** turn loophand from "review an agent's output" into "the human (or the agent) *works the artifact* on a canvas." Three media — **image, PDF, HTML** — each with a rich editor/preview, AI generation/edit for images, and the **same annotate + comment overlay on every surface** so a human can draw on the artifact and leave guidance the agent reads back.

**Depends on:** Phase 2 (`AnnotationCanvas` / Konva), Phase 3 (R2 artifacts, `fetch_file`, `ItemRail`), Phase 6 (storage quota + reconcile, `deleteTask`, comments/`guidance`, undo). Tags + schedules + standing-rules were removed (see memory `features-removed`); this plan assumes that state.

**Rough size:** large — 3 media × (preview + tools + overlay) + AI. Ship one medium at a time; each medium is independently useful.

---

## 0. The one principle that unifies everything

> **Every tool surface = `[artifact preview]` + `[annotate overlay]` + `[comment thread]` + `[medium toolbar]`.**

- **Annotate overlay** — the existing Konva `AnnotationCanvas` (box / arrow / pen / pin, severity, per-mark comment) generalized to float over *any* artifact, not just a screenshot. It already stores marks in the artifact's natural pixel space, so it works over an image, a rendered PDF page, or a rendered HTML snapshot unchanged.
- **Comment thread** — the existing `tasks.comments` + `guidance` round-trip (already shipped). Same composer on every surface.
- **Medium toolbar** — the only per-medium part: image transforms, PDF ops, or HTML edit controls.

So the bulk of the work is **one shared shell** + **three toolbars**. Build the shell first; each medium then plugs in.

### Shared shell — `src/tools/studio/`
- `ArtifactStudio.tsx` — layout shell: renders a `preview` slot, the `AnnotateOverlay`, the comment thread (reuse `CommentsSection`), and a `toolbar` slot. Mode switch: **Review** (look + annotate + approve/request-changes) vs **Edit** (run tools, produce a new version).
- `AnnotateOverlay.tsx` — `AnnotationCanvas` lifted out of `visual-review/` to wrap arbitrary content (an `<img>`, a PDF `<canvas>`, an HTML screenshot). Marks keyed by `surface` (`image | pdf | html`) + locator (page for PDF).
- Result contract (reuse the versioned structured-result pattern): on resolve, return `{ result_version, tool, decision, annotations, comment, output_file_id? }`. An edit that produced a new artifact sets `output_file_id` (fetched via `fetch_file`).

### Backend artifact model (reuse, don't reinvent)
- Artifacts are `managedFiles` + `managedFileReferences` (already built; storage quota + reconcile + `deleteTask` purge already cover them).
- Inputs: agent uploads via `upload_screenshot` (rename/generalize to `upload_artifact`) or a signed `startOutputUpload` for big files. Outputs: `recordOutput` (named, task-owned, superseding) — already metered + reclaimable.
- New task types (the medium): **`image`**, **`pdf`**, **`html`**. One per medium keeps the create payload + surface obvious; they share the studio shell. (Alternative considered: one `studio` type + `medium` field — rejected, the type *is* the medium and the board badge should say so.)

---

## 1. Image tools — `src/tools/image/`

A studio over one image. Every op is **client-side canvas** (no server round-trip, no dep on a deployment) producing a new `Blob`, re-uploaded as the next version. All ops are **composable** — they apply to the current working canvas, so crop → tint → watermark → export chains naturally. AI generation drops a new image *into* the same canvas, so generated images feed every transform too.

### Transforms (pure `canvas`/`ImageBitmap` → `Blob`)
| Tool | Notes / dep |
|---|---|
| **Crop** | `react-image-crop` for the handle UI; apply via canvas `drawImage` of the crop rect. |
| **Resize** | width/height (lock aspect), canvas scale. |
| **Rotate / flip** | 90° steps + free angle; canvas transform. |
| **Compress** | `canvas.toBlob(type, quality)`; live size readout (ties into the storage quota). |
| **Convert format** | export as **PNG / JPEG / WEBP** (`toBlob` mime). |
| **Tint / filter** | canvas `filter` (`grayscale/sepia/saturate/contrast/brightness/hue-rotate/invert`) + tint = colored overlay at alpha. Presets + sliders. |
| **Blur** | canvas `filter: blur()`, whole-image or a selected region (region from an annotate box → blur just that rect, e.g. redact). |
| **Watermark** | text or image watermark, position/opacity/scale; canvas composite. |
| **Add chrome** | wrap in a **browser frame** (URL bar) or **device mockup** (phone/laptop); a set of frame templates composited around the image. |
| **Beautify ("pretty image")** | decorative **background mat**: gradient / solid / pattern, padding, rounded corners, drop shadow — the "screenshot beautifier" look. |

- **Pipeline UX:** a non-destructive op stack ("Crop → Resize 1200w → Tint warm → Browser chrome → WEBP 80%"). Re-orderable, each step re-applies from the source. Final **Export** flattens to a Blob → `recordOutput`. (v1 can be destructive-apply with undo via the op stack; non-destructive stack is the stretch.)
- **Region ops** reuse the annotate overlay: draw a box, then "blur region" / "crop to box".

### AI generate / edit — server-side actions (`convex/ai/`)
Keys are **server-side only**, never in the client. Provider-agnostic interface; **OpenAI first** (user confirmed), **Gemini/Nano Banana Pro 2 deferred** until that key is ready.
- **OpenAI** — `gpt-image-1` (generate from prompt; edit with an optional **mask** painted via the annotate overlay). Env `OPENAI_API_KEY`. **Build this one.**
- **Google "Nano Banana Pro 2"** — Gemini image model via the Google AI API. Env `GEMINI_API_KEY`. **Deferred** — slot into the same `generateImage` interface later behind a `provider` arg.
- `convex/ai/image.ts` (node action): `generateImage({ prompt, provider, baseImageFileId?, maskFileId? })` → bytes → R2 → returns a new `file_id`. Generate-new (no base) or **modify-existing** (base image + prompt, optionally a mask from a drawn region).
- **Composable:** the returned image is just another image artifact → flows straight into crop/resize/tint/etc. A typical flow: agent uploads a rough image → human "AI: make the sky dramatic" (Gemini) → crop → add browser chrome → export → agent fetches the result.
- Provider picker in the toolbar; per-call cost/rate guard (reuse `enforceLimit`, add an `aiImage` bucket).

### MCP
- `create_task type:"image"` with `tool_payload.image_file_id` (the source, optional — omit for a pure generate task) + an instruction ("crop to 16:9 and add a browser frame").
- Result: the edited/generated image via `fetch_file(task_id, name)` + the annotations/comment.

---

## 2. PDF tools — `src/tools/pdf/`

A studio over one or more PDFs. Preview every page; run page-level ops; annotate any page.

### Preview
- **Render** with `pdfjs-dist` (arbitrary PDFs → `<canvas>` per page). (`@react-pdf/renderer` is for *generating* PDFs — already used by doc_review — not for previewing arbitrary ones; `pdfjs-dist` is the viewer.)
- The annotate overlay floats over the rendered page canvas (marks keyed by page) — same component as images.

### Ops (`pdf-lib`, pure JS, client-side)
| Tool | Notes |
|---|---|
| **Merge** | combine N PDFs (multi-input task) into one. |
| **Split** | extract a page range / split each page to its own file. |
| **Reorder / delete pages** | drag pages (reuse `@dnd-kit`), drop pages. |
| **Rotate pages** | per-page 90° steps. |
| **Compress** | re-encode / drop embedded fonts where safe (`pdf-lib` save options); size readout vs quota. |
| **Stamp / watermark** | text or image stamp across pages. |

- Output → `recordOutput` as a named PDF artifact; multi-input merge consumes several inputs, produces one.

### MCP
- `create_task type:"pdf"` with `items[]` of `{ pdf_file_id }` (one or many) + instruction ("merge these three, then compress").
- Result: output PDF via `fetch_file` + annotations/comment.

---

## 3. HTML tools — `src/tools/html/`

Preview + lightly edit HTML — aimed at **email templates** and small fragments.

### Preview (security-critical)
- Render in a **sandboxed `<iframe srcdoc>` with `sandbox` (no `allow-same-origin`, no scripts)** — never inline into the app DOM (stored-XSS). This matches the standing rule "agent SVG/PDF served sandboxed, never inline."
- Desktop/mobile width toggle; the annotate overlay floats over a **rasterized snapshot** of the iframe (annotate on a captured image of the render, so marks land in pixel space like the other media). (Capturing the iframe to a canvas is the tricky bit — `html2canvas`-style; v1 can annotate over the iframe's bounding frame with coarse coords if capture is unreliable.)

### Edit
- A code pane (`codemirror` + `@codemirror/lang-html`) beside the live sandboxed preview. Edit raw HTML; preview updates on change (debounced).
- Email-template niceties (stretch): inline-CSS helper, a few starter templates. Keep v1 to **raw HTML edit + safe preview**.

### MCP
- `create_task type:"html"` with `tool_payload.html` (inline string) or an `html_file_id` + instruction ("tweak this welcome email's CTA color").
- Result: edited HTML returned in the structured result (and/or saved as an artifact).

---

## 4. Backend / schema / MCP (shared)

- **Schema:** extend the task `type` set with `image | pdf | html`. Reuse `toolPayload` (widen its validator to a discriminated union per type: `{ kind, image_file_id }` / `{ kind, pdfs[] }` / `{ kind, html | html_file_id }`). Annotations validator gains `surface: "image" | "pdf" | "html"` (already a union; add the members).
- **Upload:** generalize `upload_screenshot` → `upload_artifact` (content-type aware: image/*, application/pdf, text/html), same R2 + claim + size-cap path (raise the per-artifact cap for PDFs; keep images at 8 MB).
- **Result:** the versioned structured result already exists; add `output_file_id` for edit outputs. `fetch_file` already serves them with short-TTL signed URLs.
- **AI actions:** `convex/ai/image.ts` (OpenAI + Gemini), keyed server-side, output to R2, rate-limited (`aiImage` bucket). No client key exposure.
- **MCP tools:** `create_task` accepts the new types + payloads; document the `outcome` / `result_version` discriminators per type. `fetch_file` unchanged.

## 5. Security
- Image/PDF transforms are **client-side canvas/pdf-lib** — no new server attack surface.
- **AI keys server-side only**; rate + cost guard per user.
- **HTML preview sandboxed** (`iframe sandbox`, no same-origin, no scripts); never inline. Any agent-supplied SVG/PDF served via the storage proxy, sandboxed, never inline.
- All outputs metered by the existing storage quota; `deleteTask` already purges them from R2.
- AI-generated content provenance: tag outputs with the provider + prompt in the result for auditability.

## 6. Dependencies (add per medium, code-split each surface)
- Image: `react-image-crop` (crop UI). Everything else = native Canvas API. AI = `openai` SDK + Google GenAI SDK (or REST `fetch` to keep deps light).
- PDF: `pdf-lib` (ops) + `pdfjs-dist` (preview).
- HTML: `codemirror` + `@codemirror/lang-html` (+ `@codemirror/view`/`state`).
- Already in: `konva`/`react-konva` (overlay), `@dnd-kit` (page reorder), `sonner` (undo toasts).
- **Code-split** each studio (`React.lazy`) — these are heavy and only load when a card of that type opens.

## 7. Build sequence (one slice per row; gate + your live verification each)
1. **Studio shell + AnnotateOverlay extraction** — lift `AnnotationCanvas` into the reusable shell; re-point visual_review at it (no behavior change). *Foundation; everything else plugs in.*
2. **Image: core transforms** — crop, resize, rotate, compress, convert format. Export → `recordOutput`. New `image` type + MCP.
3. **Image: styling** — tint/filter, blur (+ region blur from a box), watermark, browser/device chrome, beautify background.
4. **Image: AI** — OpenAI + Nano Banana Pro 2 generate/edit, composable into the transforms.
5. **PDF: preview + merge/split** — `pdfjs-dist` viewer + `pdf-lib` merge/split, annotate per page. New `pdf` type.
6. **PDF: page ops + compress** — reorder/delete/rotate pages, compress, stamp/watermark.
7. **HTML: sandboxed preview + edit** — iframe srcdoc + CodeMirror, annotate over snapshot. New `html` type.
8. **Reducers (carry-over from Phase 6):** counter-propose (return the corrected artifact, not just request_changes — falls out naturally since edit tools already produce an output), asset shelf (reusable human files by name via `fetch_file`), bundled mixed-item cards (ItemRail holding image + pdf + approval together).

## 8. Definition of Done
- [ ] One shared studio shell: artifact preview + annotate overlay + comment thread on **every** medium.
- [ ] Image: crop, resize, rotate, compress, convert (png/jpg/webp), tint/filter, blur (+region), watermark, browser/device chrome, beautify — all composable, export to a versioned artifact.
- [ ] Image AI: generate-new and modify-existing via **OpenAI** and **Nano Banana Pro 2**, output composable with the transforms.
- [ ] PDF: preview (pdfjs), merge, split, reorder/delete/rotate pages, compress — output artifact.
- [ ] HTML: sandboxed preview + CodeMirror edit, annotate over the render.
- [ ] Annotate + comment overlay works on image, PDF page, and HTML snapshot.
- [ ] All outputs metered by storage quota; AI keys server-side; HTML/SVG/PDF never served inline.

## 9. Risks / watch-outs
- **Heaviest deps in the app** (pdfjs, codemirror, AI SDKs) — code-split hard; lazy-load per surface.
- **HTML iframe → canvas capture** for annotation is the flakiest piece — fall back to annotating a coarse frame if capture is unreliable; don't block the medium on it.
- **AI cost** — rate + per-user cap from day one; show the provider + a spend hint.
- **These surfaces need a human's eyes** — build interactively against a live `convex dev` + `pnpm run dev`, verify each tool in-browser before commit (no headless smoke covers a canvas/AI render).
- **`@react-pdf/renderer` (generate) vs `pdfjs-dist` (preview)** are different libs — don't conflate; doc_review keeps the generator, the PDF studio adds the viewer.
