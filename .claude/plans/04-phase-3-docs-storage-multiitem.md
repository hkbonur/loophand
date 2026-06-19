# Phase 3 — Doc render review + storage + multi-item

**Goal:** make agent-authored *documents* visible for review, wire real artifact storage with a safe "fetch by name" contract, and let one card carry many items (`ItemRail`) so the human never switches tickets mid-batch.
**Depends on:** Phase 2 (reuses `AnnotationCanvas`).
**Rough size:** 1.5–2 weeks.

---

## Backend (Convex)

1. **Artifact outputs via R2 (`managedFiles`/`managedFileReferences`):**
   - Store each output object under a **random UUID** key (formbase pattern). The **stable name** (`outputName`/`item-{n}.{ext}`) is a `managedFileReferences` row keyed by `(taskId, name)`. **Never** put workspace/task ids in the R2 key.
   - `fetch_file(task_id, name)` HTTP endpoint: resolve name → file via reference rows, assert workspace + `tasks:read`, return a **short-TTL signed URL**. Never accepts a raw key.
2. **Multi-item:**
   - `taskItems` create on `tasks.create` when `items[]` is supplied; `itemCount` set.
   - `items.setStatus(itemId, status, result?, resultFileId?)` — writes the item **and** bumps `tasks.itemsDone` **in the same mutation** (OCC-retry safe). Auto-`complete` the task when `itemsDone === itemCount`.
   - Nightly `internal.reconcile.itemCounts` cron as a drift backstop.
3. **Doc render path:** prefer **react-pdf trees** (client-rendered, no server code). If XSL-FO is needed, a `"use node"` action runs Apache FOP with **external entities/DTDs + network disabled** (XXE/SSRF), output stored in R2.

## MCP
- `create_task` accepts `items[]` (multi-item) and `tool:"doc_render"` with `{ reactPdf }` or `{ xslFo }`.
- `fetch_file(task_id, name)` tool (wraps the endpoint).
- Result rollup for multi-item: `{ items:[{ name, status }], partial: bool }` so the agent re-issues only failures.

## Frontend — build

1. **`ItemRail` primitive:** bottom filmstrip; per-item state (done/pending/failed/skipped); keyboard `[`/`]`; running `itemsDone/itemCount` chip; **Apply to all** + **Submit batch**. Surface-agnostic (used by doc + image tools).
2. **`DocRender` tool:** render react-pdf / FOP output to a **PDF.js** canvas (`pdfjs` dep) with a page-thumbnail rail; overlay the **reused `AnnotationCanvas`**; **render-error fallback** (raw-download). On approve, store the rendered PDF as the card's output.
3. **Conflict / loading states (from review):**
   - "Agent still attaching…" — gate the tool surface on attachment readiness, not just task existence.
   - Stale-task banner — if the task changed/expired/was cancelled under an open dialog (driven by the same reactive `useQuery`).
   - Claim-rejected → "taken by X / steal" (full conflict UI lands Phase 4; stub here).

**Deps added:** `@react-pdf/renderer`, `pdfjs-dist`.

## Security
- The **stable-key IDOR is closed** (random UUID + authenticated `fetch_file`).
- FOP hardening (entities/network off) if used.
- Signed URLs are short-TTL and workspace-scoped.

## Testing
- Multi-item: 5-item doc task → review/annotate each → submit → `itemsDone` consistent under concurrent item writes (race test).
- `fetch_file` returns only the caller's workspace files; foreign `task_id`/`name` rejected; raw-key access impossible.
- Render-error path shows fallback, not a crash.

## Definition of Done
- [ ] Agent creates a multi-item doc review; human handles all items in one card; outputs stored in R2.
- [ ] Agent fetches a human-made artifact **later** via `fetch_file(task_id, name)`; no guessable keys exist.
- [ ] `itemsDone` never drifts (race + reconcile tested); task auto-completes at full count.
- [ ] "Agent still attaching" + stale-task states behave.

## Risks / watch-outs
- Don't reintroduce a deterministic R2 key "for convenience" — that's the IDOR the review caught.
- PDF.js + react-pdf are heavy; lazy-load. Large/many-page PDFs need virtualization.
- Keep `ItemRail` generic so the image studio (Phase 6) reuses it unchanged.
