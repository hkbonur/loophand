# Phase 2 — Hero tool (visual review) + reliable attention (web push)

**Goal:** the daily-open hook — annotate an agent's screenshot — and make sure the human actually *learns* a task is waiting even with the tab backgrounded/closed (web push). Browser `Notification` alone is insufficient (fires only while loaded).
**Depends on:** Phase 1.
**Rough size:** 1–1.5 weeks.

---

## Backend (Convex)

1. **`tool_task` + `tool:"visual_review"`** in `tasks.create`; accept `attachmentIds` (screenshot via reused `managedFiles` upload flow, `ownerType:"task"`).
2. **Web push:**
   - `pushSubscriptions` table (per user/device endpoint + keys).
   - `internal.notify.push(taskId)` action using Web Push + VAPID keys (env). Fired from `tasks.create` (and assignment later), throttled per user.
   - Mutations `push.subscribe` / `push.unsubscribe`.
3. (Optional) email notify via reused Resend path as fallback.

## MCP
- No new tools. Document `tool_payload` for `visual_review`: `{ screenshotFileId, viewports?: ["desktop","mobile"] }`. **No live-URL fetch** server-side.

## Frontend — build

1. **`AnnotationCanvas` primitive** (`react-konva`, net-new dep): tools = select / box / arrow / pen / numbered pin; each mark anchors a comment + `severity` (`blocker`/`nit`). Renders over any raster surface. Returns structured geometry. This is reused by Phases 3 (PDF) and 6 (image studio).
2. **`VisualReview` tool surface:** show the agent-uploaded screenshot; **viewport switcher** (desktop / mobile 375px); annotate; decide in `ResultPanel`. Result:
   ```json
   { "result_version":1, "tool":"visual_review", "decision":"changes_requested",
     "annotations":[{ "box":[x,y,w,h], "viewport":"mobile", "severity":"blocker", "comment":"…" }] }
   ```
   If a URL is ever shown, render **client-side in a `sandbox`ed iframe** (no `allow-same-origin`), with a "couldn't reach this URL" fallback — never a server fetch.
3. **PWA push:** finish the service worker — subscribe to push, handle `push` events → OS notification → deep-link to the card. Permission prompt in onboarding.

## Security (§11.2)
- **SSRF:** screenshots are agent-uploaded; no server-side URL fetch.
- **Stored-XSS:** render annotation text + instructions as text only; never `dangerouslySetInnerHTML`.
- Push payloads carry only IDs, not task content.

## Testing
- Annotation round-trip: draw → submit → agent `get_task` receives structured annotations.
- Push: with the tab **closed**, `create_task` triggers an OS notification that deep-links to the card (test on desktop Chrome + Android PWA).
- Konva canvas works at desktop sizes; degrade gracefully on touch (full touch support is Phase 6 polish).

## Definition of Done
- [ ] Agent submits a screenshot task; human annotates; structured feedback returns to the agent.
- [ ] Viewport switch works; URL path (if shown) is sandboxed, no server fetch.
- [ ] **Web push fires with the tab backgrounded/closed** and deep-links to the card.
- [ ] `AnnotationCanvas` is a reusable primitive (consumed later by PDF + image tools).

## Risks / watch-outs
- Push reliability varies by browser/OS — test the real matrix; iOS PWA push has caveats.
- Keep `AnnotationCanvas` surface-agnostic from day one (don't hard-code to images) or Phase 3/6 will refactor it.
- Konva bundle size — lazy-load the tool surface.
