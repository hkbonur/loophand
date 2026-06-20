# Phase 3 — Doc render review + storage + multi-item

**Goal:** make agent-authored *documents* visible for review, wire real artifact storage with a safe "fetch by name" contract, and let one card carry many items (`ItemRail`) so the human never switches tickets mid-batch.
**Depends on:** Phase 2 (reuses `AnnotationCanvas`).
**Rough size:** 1.5–2 weeks.

---

## Resolved decisions (grill, 2026-06-20) — supersede conflicting body text

See `CONTEXT.md` (glossary) and `docs/adr/0001`, `docs/adr/0002`.

1. **Naming:** task type is **`doc_review`** (mirrors `visual_review`); the agent supplies a
   **render spec** inside the payload. No `doc_render` task type. Frontend `DocReview`,
   result tag `tool:"doc_review"`.
2. **`fetch_file` returns a short-TTL signed R2 URL** (ADR-0001). Owner-checked at the MCP
   layer (already bearer-authed) + task ownership + name resolution, then `r2.getUrl(key,
   {expiresIn: SIGNED_URL_TTL_SECONDS})`. Never the raw key, never the public proxy, never
   base64 bytes. The public `/api/storage` proxy stays public for board `<img>` embeds.
   `fetch` is already in `ALLOWED_VERBS`/`READ_VERBS` — no rename needed.
3. **Output name** lives in a new optional `name` field on `managedFileReferences` +
   `by_owner_name` index `[ownerType, ownerId, name]`. Outputs are owned by the **task**
   (`ownerType:"task"`, `ownerId: taskId`, `name:"item-{n}.pdf"`). The plan's
   "encode in `ownerKey`" note describes a different schema — ignore it. Existing screenshot
   refs keep `name` undefined.
4. **Multi-item is opt-in** via `items[]` at create. `itemCount`/`taskItems` only exist
   then; single-surface tasks are untouched (no rail, `itemCount` unset).
5. **Doc output is the approved rendered PDF.** Client renders react-pdf → PDF; on approve
   it uploads browser→R2 (`generateUploadUrl` + a session-auth `recordOutput` mutation that
   writes `managedFiles` + a named `managedFileReferences` row owned by the task). This is a
   NEW human-side upload path (today only agents upload).
6. **Render spec, Phase 3 = `react_pdf` only**: a whitelisted, serializable JSON tree
   (`Document > Page > (View|Text|Image|Link)` + a style subset) mapped to
   `@react-pdf/renderer` on the client. No server render, no `eval`. `kind:"xsl_fo"` is
   reserved in the union but rejected `NOT_IMPLEMENTED` (no FOP action this phase).
7. **Annotations are a discriminated union** keyed on `surface`:
   `{surface:"screenshot", viewport, …}` | `{surface:"doc", page, …}`. New visual_review
   annotations carry `surface:"screenshot"`. `resolve()` validates the right variant per type.
8. **Item loop = continuous-open** (ADR-0002). Multi-item tasks stay `open` across rounds.
   `items.setStatus` bumps `itemsDone` (OCC-safe); when `itemsDone === itemCount` the rollup
   wakes `await_task`. All `approved` → task `done`; any `changes_requested` → stays `open`
   and the agent patches those items back to `pending` (drops `itemsDone`, re-arms await).
   `itemsDone` (not task `status`) drives both the await signal and completion. `await_task`
   gains an item-count predicate for multi-item tasks.

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
