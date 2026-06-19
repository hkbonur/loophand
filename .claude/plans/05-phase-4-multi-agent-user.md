# Phase 4 — Multi-agent project board (tags, attribution, search)

**Goal:** many agent tokens write to one human's projects cleanly — attribution (which agent raised a card), **ticket tags** for grouping work (e.g. a feature name), board search/filter, and agent last-seen. **Single human user — no teams.** Multi-user (members / roles / invites / presence / assignment) is explicitly **parked to After v1** (see Phase 7).
**Depends on:** Phase 1 (auth/tenancy already enforced per-function on `userId`/`projectId`).
**Rough size:** 1–1.5 weeks.

---

## Backend (Convex)

1. **Agents = API tokens:** a user mints multiple named tokens, each a distinct "agent." `apiTokens.lastUsedAt` is stamped on every tool call (already in `apiTokenAuth`) → drives an "agent went dark" signal. `tokens.list` / `tokens.mint` / `tokens.revoke` (owner-scoped).
2. **Tags:** `tasks.tags: string[]` (defined Phase 0). `tasks.setTags(taskId, tags)`; a `projects.distinctTags(projectId)` query (distinct tags in a project) for the filter UI. **Normalize** on write — trim, lowercase, dedupe, cap count + length.
3. **Attribution:** surface `createdByTokenId` (raising agent → `apiTokens.name`) and `resumedByTokenId` (which agent re-picked the result). The human resolver is implicit (single user).
4. **Audit:** `taskAudit` writes on every resolve (approve / request-changes / cancel) and close (server-only).
5. **No claim/lock** — review is in-place while the card is `open` (no `in_progress` state, no cross-tab steal to build). The reactive `useQuery` already keeps every open board/dialog live.

## MCP

- **No new task verbs.** `list_projects` / `list_tasks(project?, status?, tags?, mine?)` already cover multi-agent recovery + tag filtering; `create_task` already accepts `tags`.
- Enforce the **read-only vs writer** distinction via the Phase 1 scope check (`tasks:read` token can list/get but not create/resolve).

## Frontend — build

**Reuse (`src/ui`):** `filter-menu`/`filter-select` (board search), `badge` (tag chips), `avatar` (agent), `dropdown-menu`, `command`, `dialog`, `sonner`.

**Build:**
- **`AgentsPanel`** (settings) — list tokens/agents: name, last-seen, scopes, revoke; mint (plaintext once). (Stubbed in Phase 1 onboarding — complete it here.)
- **Tags UI** — tag chips on `Card`; add/edit tags in `CardDialog`; a **tag filter** in the board toolbar fed by `projects.distinctTags`.
- **Board search/filter** — by **tag**, agent, type, status (essential once an agent fills the board).
- **Card attribution** — raising-agent avatar + name; in **Agent working**, show which agent re-picked it (`resumedByTokenId`).
- **Agent activity** — "went dark" indicator derived from `lastUsedAt`.

## Security
- Per-function **owner assertions** (`userId` + project) already in place (Phase 1) — nothing role-shaped to add (single owner).
- **Tags are agent/user-supplied strings** → render as text only (never `dangerouslySetInnerHTML`); cap length/count (stored-XSS + abuse surface).
- Begin rate-limiting groundwork (full limits in Phase 6): wrap `create_task` with the reused `@convex-dev/rate-limiter` per **token / user**.

## Testing
- Two agent tokens on one project: attribution correct; each card shows the right agent name.
- Tag filter: tasks tagged `feature-x` filter correctly; the distinct-tag list is accurate; tag normalization holds (dupes/case collapsed).
- A `tasks:read`-only token cannot create/resolve (scope enforced); a writer can.
- Agent last-seen updates on each call; "went dark" appears after idle.

## Definition of Done
- [ ] Multiple agent tokens write to one project; each card shows which agent raised it.
- [ ] Tickets are taggable; the board filters by tag (+ agent / type / status).
- [ ] Read-only vs writer token scopes enforced server-side; `taskAudit` records decisions.
- [ ] Agent last-seen / "went dark" visible.

## Risks / watch-outs
- **Multi-user is OUT for now** — don't build members/roles/invites/presence/assignment. Park it; revisit only if real teams ask (Phase 7 After-v1).
- **Tag sprawl** — normalize + cap; a per-project suggested-tag list can come later.
- Reactive fan-out grows with card count; measure board query cost (optimize in Phase 7).
