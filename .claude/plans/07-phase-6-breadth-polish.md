# Phase 6 — Breadth + polish

**Goal:** complete the tool surface (input, sketch, image studio, diff), the glass-box auto mode, the round-trip reducers (counter-propose / standing rules / asset shelf / bundled items), and the hardening (rate limits, quotas, undo, keyboard, batch).
**Depends on:** Phases 2–3 (AnnotationCanvas, ItemRail) and 5 (scheduling for some auto tasks).
**Rough size:** 2–3 weeks.

---

## Backend (Convex)

1. **Rate-limiting & quotas:** apply the reused `@convex-dev/rate-limiter` (mirror formbase's `internal/rateLimiterComponent.ts` wrapper) to `create_task`, upload-URL minting, and `schedules.tick`. Cap attachment size/count, `depends_on` length, active schedules per user. **Per-user R2 storage quota** + a real **delete path** that purges R2 (not just refs).
2. **Standing rules / preferences:** `preferences` table (**project-scoped key/value with a user-level fallback**, e.g. "always allow staging migrations", "brand color"). `get_task` (and the agent) can read them before asking — the biggest round-trip reducer.
3. **Comments / guidance:** `taskComments` write + surfaced in `get_task` (`comments[]`, `guidance`) — makes "ask the agent back" real.
4. **Auto/assisted mode:** `taskActivity` append API for workers; `mode` drives board placement; "take over" converts `auto → manual`.

## MCP
- `get_task` returns `comments[]` + `guidance` + relevant `preferences`.
- Document `mode` and the result `outcome`/`result_version` discriminators for all tools.

## Frontend — build (tool surfaces)

| Tool | Build notes | Dep |
|---|---|---|
| **Input** | dynamic form from JSON-Schema | `@rjsf/core` |
| **Sketch** | embed Excalidraw; return `{ scene, png, svg }` | `@excalidraw/excalidraw` |
| **Image studio** | crop/resize/rotate/compress/format/tint/annotate **+ replace image** + upload-first; batch via `ItemRail`; output via `fetch_file` | `react-image-crop` |
| **Diff review** | per-hunk approve; destructive ops require an explicit typed confirm (no roles — single owner) | (syntax highlighter) |
| **Glass-box** | `ProcessView`: before/after compare slider, size stat, `taskActivity` timeline, "looks good / redo / take over" | — |

**Round-trip reducers:**
- **Counter-propose** ("fix & return") across approval / diff / doc / visual — return the corrected value, not just `request_changes`.
- **Standing rules UI** (manage `preferences`).
- **Asset shelf** — reusable human-provided files at known names (via `fetch_file`).
- **Bundled mixed-item cards** — `ItemRail` holds approval + input + image together.

**Polish:** undo toast (`sonner`) on approve / request-changes / batch; full keyboard flow (`j/k` move, `a` approve / `r` request-changes / `c` comment, `g`+col); **batch review queue** (cross-card keyboard flow); touch support for `AnnotationCanvas`; email notifications (Resend); offline/reconnecting banner that blocks submit.

## Security
- Rate limits + quotas now enforced (the abuse surface: create-storms, oversized uploads, schedule/dep fan-out, storage growth).
- Excalidraw SVG export + any agent SVG/PDF served sandboxed, never inline (stored-XSS).

## Testing
- Each tool: create → resolve → structured result parsed by a test agent.
- Rate-limit: a `create_task` storm is throttled; oversized attachment rejected; storage quota enforced; delete purges R2.
- Undo reverts before the agent polls; batch queue handles 40 cards via keyboard.
- Glass-box auto task streams activity live and settles to Done.

## Definition of Done
- [ ] All six tools function end-to-end with versioned structured results.
- [ ] Glass-box `auto`/`assisted` tasks stream + allow "take over".
- [ ] Round-trip reducers (fix-and-return, standing rules, comments, asset shelf, bundled items) work.
- [ ] Rate limits, attachment/schedule caps, storage quota + real delete enforced.
- [ ] Undo, full keyboard flow, batch queue, touch annotation, offline guard shipped.

## Risks / watch-outs
- This phase is large — keep tools independent so they can ship incrementally; don't block on the last one.
- Excalidraw/react-image-crop/pdf are heavy — code-split each tool surface.
- Validate **frequency** (does the artifact work happen often enough?) with the Phase 7 metrics before over-investing here.
