# Phase 3 — Doc render review + storage + multi-item

**Goal:** make agent-authored *documents* visible for review, wire real artifact storage with a safe "fetch by name" contract, and let one card carry many items (`ItemRail`) so the human never switches tickets mid-batch.
**Depends on:** Phase 2 (reuses `AnnotationCanvas`).
**Rough size:** 1.5–2 weeks.

---

## Backend (Convex)

1. **Artifact outputs via R2 (`managedFiles`/`managedFileReferences`):**
   - Store each output object under a **random UUID** key (formbase's `generateR2Key()` → `crypto.randomUUID()`). The **stable name** (`outputName`/`item-{n}.{ext}`) is a `managedFileReferences` row. **Match formbase's actual shape:** that table keys on `(ownerType, ownerKey)` — set `ownerType:"task"` (or `"taskItem"`) and encode the stable name in `ownerKey` (e.g. `` `${taskId}/${name}` ``); it does **not** have separate `taskId`/`name` columns. **Never** put user/project/task ids in the R2 key itself.
   - `fetch_file(task_id, name)` (⚠ rename `get_file` or extend `ALLOWED_VERBS` — `fetch` is not a permitted verb) HTTP endpoint: resolve name → reference row → file, assert **owner** (`userId` + the task's project) + `tasks:read`, return access. **Note:** formbase doesn't hand out short-TTL signed URLs to clients — `http/storage.ts` is a **302-proxy** that mints a fresh signed URL (default `SIGNED_URL_TTL_SECONDS = 3600`) per request behind a stable proxy URL. Either reuse that proxy (authenticated for tasks) or mint a short-TTL signed URL directly; pick one and state it. Never accept a raw R2 key.
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
3. **Loading / staleness states:**
   - "Agent still attaching…" — gate the tool surface on attachment readiness, not just task existence.
   - Stale-task banner — if the task was resolved/expired/cancelled (or moved to `resumed`) under an open dialog (driven by the same reactive `useQuery`).

**Deps added:** `@react-pdf/renderer`, `pdfjs-dist`.

## Security
- The **stable-key IDOR is closed** (random UUID + authenticated `fetch_file`).
- FOP hardening (entities/network off) if used.
- Signed URLs are short-TTL and owner-scoped (`userId` + project).

## Testing
- Multi-item: 5-item doc task → review/annotate each → submit → `itemsDone` consistent under concurrent item writes (race test).
- `fetch_file` returns only the caller's own files (`userId`-scoped); foreign `task_id`/`name` rejected; raw-key access impossible.
- Render-error path shows fallback, not a crash.

## Definition of Done
- [ ] Agent creates a multi-item doc review; human handles all items in one card; outputs stored in R2.
- [ ] Agent fetches a human-made artifact **later** via `fetch_file(task_id, name)`; no guessable keys exist.
- [ ] `itemsDone` never drifts (race + reconcile tested); task auto-completes at full count.
- [ ] "Agent still attaching" + stale-task states behave.

## Risks / watch-outs
- Don't reintroduce a deterministic R2 key "for convenience" — that's an IDOR (guessable cross-user/project keys).
- PDF.js + react-pdf are heavy; lazy-load. Large/many-page PDFs need virtualization.
- Keep `ItemRail` generic so the image studio (Phase 6) reuses it unchanged.
