# Phase 1 — Core loop + onboarding (the acceptance test)

**Goal:** the full round-trip from §2 — agent creates a task → card appears live → human approves → `await_task` returns — **and a brand-new user can reach it from an empty board.** Single-user, `approval` type only. This is the phase that proves the product; sit with it before widening.
**Depends on:** Phase 0.
**Rough size:** 1–1.5 weeks.

---

## Backend (Convex) — `tasks.*`

Each function **asserts `row.workspaceId === ctx.workspaceId`** and **checks `tasks:read`/`tasks:write` scope**. Isolation is not free.

| Function | Logic |
|---|---|
| `tasks.create` | Idempotent on `(workspaceId, idempotencyKey)` — return existing row if present. Stamp `createdByTokenId`, `workspaceId`, `revision=0`, `status=open` (deps/scheduling come in Phase 5). Default `board` to the workspace's default folder if omitted. |
| `tasks.get` | Assert workspace; return `{ status, outcome, result, resultVersion, rejectionReason, comments: [] }` (comments populate in Phase 6). |
| `tasks.list` | Reactive board query (`by_board_status`) **and** `mine` filter (`by_token`) for agent recovery; always workspace-scoped. |
| `tasks.claim` | `open → in_progress`; set `claimedByUserId`; reject if already claimed; extend `expiresAt`. |
| `tasks.complete` / `reject` / `cancel` | Guard on `revision` (reject stale); set `outcome` (`completed`/`rejected_by_human`/`cancelled`); write `result`; append `taskAudit`. |
| `tasks.expire` (internal) | Scheduler TTL handler; no-op unless still `open`/`blocked`. Scheduled from `create` via `scheduler.runAt(expiresAt)`. |

## MCP tools (`http/mcp/tools/tasks/`)

Promote stubs to full tools; register all in `MCP_ALL_TOOLS`:
- `create_task(board?, type, title, instructions, acceptance_criteria?, idempotency_key?)` → `{ task_id }`.
- `get_task(task_id)` → status payload.
- `await_task(task_id, timeout_seconds)` → bounded long-poll (≤ ~3 min ceiling), returns `{ status:"pending", resume, poll_after_ms }` when unresolved. **Self-documenting** so agents re-poll.
- `cancel_task(task_id, reason?)`, `list_tasks(board?, status?, mine?)`, `list_boards()`.
- Every handler: scope check + workspace assert + (later) rate-limit hook.

## Frontend — `src`

**Reuse (`src/ui`):** `sidebar`, `card`, `badge`, `avatar`, `dialog`, `button`, `empty`, `spinner`, `status-state`, `sonner`, `tabs`, `scroll-area`, `kbd`.

**Build:**
- `Board` + `Column` (by status: Open / In progress / Completed / Rejected). Live via `useQuery(api.tasks.list)`. (DnD optional this phase; clicking drives status.)
- `Card` — title, age, "waiting on you" pulse for `open`, type badge. Click → opens dialog (fires `tasks.claim`).
- `CardDialog` (compose `dialog` + `sidebar` + `tabs`): left = agent context (instructions/acceptance/attachments); center = tool surface; right/bottom = `ResultPanel`.
- `ApprovalPanel` — approve / reject / comment → `tasks.complete`/`reject`.
- `ResultPanel` — shows the JSON that will return to the agent.
- **Onboarding (critical):**
  - `AgentsPanel` (settings) — mint an API key (plaintext shown once), list/revoke.
  - **Empty-board state** with the MCP connect snippet (`.mcp.json` + the minted key) and a "waiting for your first task" affordance that resolves the instant a card arrives.
- **GitHub login** — add `github` to `socialProviders` in `lib/auth.ts` + a button in `src/auth-ui`.

## Security
- Per-function workspace assertion + `tasks:*` scope (above). Fail closed.
- `revision` guard prevents double-resolution.
- Mint-key shows plaintext once; store only the hash (reuse `apiTokenAuth`).

## Testing
- **Integration:** mint key → `create_task(approval)` → `await_task` → simulate human `complete` → `await_task` returns within the ceiling; `pending` path exercised when slow.
- Foreign-workspace `get_task`/`complete` rejected.
- Idempotent `create_task` retry returns same `task_id`.
- **Manual acceptance:** run real Claude Code with the minted key against a local board; approve from the UI; confirm the loop resumes.

## Definition of Done
- [ ] A new user signs up → empty board → mints a key → connects an agent → first task resolved, **without leaving docs.**
- [ ] `create_task`/`await_task`/`get_task`/`cancel_task`/`list_tasks`/`list_boards` all work with scope + workspace enforcement.
- [ ] Card appears **live** (< ~1s) on `create_task`; approve/reject round-trips to the agent.
- [ ] `await_task` returns self-documenting `pending`; agent re-poll works.
- [ ] Idempotency + revision guards covered by tests.

## Risks / watch-outs
- **The whole product lives here** — optimize the card-appearance latency + animation; this *is* the demo.
- Don't let onboarding slip to a later phase; without mint-key the acceptance test can't run.
- Keep `await_task` ceiling under the Convex action timeout; rely on re-poll for long human turns.
