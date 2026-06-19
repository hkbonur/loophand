# Phase 1 — Core loop + onboarding (the acceptance test)

**Goal:** the full round-trip — agent creates a task → card appears live → human approves → `await_task` returns — **and a brand-new user can reach it from an empty board.** Single-user, `approval` type only. This is the phase that proves the product; sit with it before widening.
**Depends on:** Phase 0.
**Rough size:** 1–1.5 weeks.

---

## Backend (Convex) — `tasks.*`

Each function **asserts `row.userId === ctx.userId`** (and the row's `projectId` belongs to the caller) and **checks `tasks:read`/`tasks:write` scope**. Isolation is not free.

| Function | Logic |
|---|---|
| `tasks.create` | Idempotent on `(userId, idempotencyKey)` — return existing row if present. Stamp `createdByTokenId`, `userId`, `projectId`, `tags`, `revision=0`, `status=open` (deps/scheduling come in Phase 5). Default `projectId` to the user's default project if omitted. |
| `tasks.get` | Assert owner; return `{ status, outcome, result, resultVersion, comments: [] }` (comments populate in Phase 6). **If the task is `awaiting_agent`, consuming it here flips it to `resumed`** (see lifecycle). |
| `tasks.list` | Reactive board query (`by_project_status`) **and** `mine` filter (`by_token`) for agent recovery; always owner-scoped. |
| `tasks.resolve` (`approve` / `request_changes` / `cancel`) | **Human action — review happens in-place; there is no claim/`in_progress`.** Guard on `revision` (reject stale). Status `open → awaiting_agent`; set `outcome` (`approved` / `changes_requested` / `cancelled`); write `result`; append `taskAudit`. |
| consume (inside `await_task`/`get_task`) | First time the agent reads a resolved (`awaiting_agent`) task, flip `awaiting_agent → resumed` and stamp `resumedByTokenId`/`resultConsumedAt`. This is the **"Agent working"** column. |
| `tasks.close` | `resumed → done`. Trigger: an agent ack, a human archive, or a grace-period auto-close after consumption. |
| `tasks.expire` (internal) | Scheduler TTL handler; no-op unless still `open`/`blocked`. Sets `outcome=expired`, status `done`. Scheduled from `create` via `scheduler.runAt(expiresAt)`. |

**Status = column axis; outcome = badge.** `open` (**Queue**) → `awaiting_agent` (**Awaiting agent**, set when you resolve; `await_task` returns) → `resumed` (**Agent working**, set when the agent consumes the result) → `done` (**Done**). `blocked` (Phase 5) shows in a collapsed lane. Outcome is a **separate field rendered as a badge**: `approved` / `changes_requested` / `cancelled` / `expired` / `dependency_failed`. **`changes_requested` is NOT terminal** — it returns a result the agent reworks (rides Awaiting agent → Agent working); only `cancelled`/`expired` dead-end in Done.

**Projects** (`projects.*`, all owner-scoped): `projects.list`; `projects.create(name)` (a fresh isolated board); `projects.ensureDefault` (called by `tasks.create` when no project is given). An agent thus **reuses** a project (by id/name) or **creates** a new isolated one.

## MCP tools (`http/mcp/tools/tasks/`)

Promote stubs to full tools; register via `tools/index.ts` (→ `MCP_ALL_TOOLS`):
- `create_task(project?, type, title, instructions, acceptance_criteria?, tags?, idempotency_key?)` → `{ task_id }`. `project` = an existing project id/name; omitted → the user's default project.
- `get_task(task_id)` → status payload.
- `await_task(task_id, timeout_seconds)` → bounded long-poll (≤ ~3 min ceiling), returns `{ status:"pending", resume, poll_after_ms }` when unresolved. **Self-documenting** so agents re-poll. On resolve it returns the result **and flips the card to `resumed` (Agent working)**. **Net-new pattern** — formbase has no long-poll/await tool; the bounded wait + re-poll contract is loophand's own.
- `cancel_task(task_id, reason?)`, `list_tasks(project?, status?, tags?, mine?)`, `list_projects()`, `create_project(name)` → `{ project_id }` (an agent spins up a fresh isolated board).
- **⚠ Verb-lint:** `await` and `cancel` are NOT in formbase's `ALLOWED_VERBS` — extend the vocabulary in loophand's `toolNameLint.ts` (and add `await` to `READ_VERBS` if it shouldn't count as a write) before these tools register, or the build-time lint throws.
- Every handler: scope check + owner assert + (later) rate-limit hook.

## Frontend — `src`

**Reuse (`src/ui`):** `sidebar`, `card`, `badge`, `avatar`, `dialog`, `button`, `empty`, `spinner`, `status-state`, `sonner`, `tabs`, `scroll-area`, `kbd`.

**Build:**
- `Board` — **4 columns: Queue (`open`) · Awaiting agent (`awaiting_agent`) · Agent working (`resumed`) · Done (`done`)** — for the **active project**. Outcome shows as a card **badge** (approved ✔ / changes-requested ✗ / cancelled ⊘ / expired ⏱). Live via `useQuery(api.tasks.list, { projectId })`. (DnD optional this phase; resolving from the dialog drives status.)
- **Project switcher** in `sidebar` (list the user's projects via `projects.list`; "new project" action). Default project selected on first load.
- `Card` — title, age, "waiting on you" pulse in **Queue**, type badge, outcome badge. Click → opens the dialog for **in-place review** (no claim/lock — single human).
- `CardDialog` (compose `dialog` + `sidebar` + `tabs`): left = agent context (instructions/acceptance/attachments); center = tool surface; right/bottom = `ResultPanel`.
- `ApprovalPanel` — approve / **request changes** / comment → `tasks.resolve`. ("Request changes" returns a result the agent reworks — not a dead reject.)
- `ResultPanel` — shows the JSON that will return to the agent.
- **Onboarding (critical):**
  - `AgentsPanel` (settings) — mint an API key (plaintext shown once), list/revoke.
  - **Empty-board state** with the MCP connect snippet (`.mcp.json` + the minted key) and a "waiting for your first task" affordance that resolves the instant a card arrives.
- **GitHub login** — add `github` to `socialProviders` in `lib/auth.ts` + a button in `src/auth-ui`.

## Security
- Per-function **owner assertion** (`row.userId === ctx.userId` + the row's project is the caller's) + `tasks:*` scope (above). Fail closed.
- `revision` guard prevents double-resolution.
- Mint-key shows plaintext once; store only the hash (reuse `apiTokenAuth`).

## Testing
- **Integration:** mint key → `create_task(approval)` → `await_task` → simulate human `resolve(approve)` → `await_task` returns the result within the ceiling and the card flips to `resumed`; `pending` path exercised when slow.
- Foreign-user `get_task`/`complete` rejected; a task in another user's project is invisible; `create_task` into a project you don't own is rejected.
- Idempotent `create_task` retry returns same `task_id`.
- **Manual acceptance:** run real Claude Code with the minted key against a local board; approve from the UI; confirm the loop resumes.

## Definition of Done
- [ ] A new user signs up → empty board → mints a key → connects an agent → first task resolved, **without leaving docs.**
- [ ] `create_task`/`await_task`/`get_task`/`cancel_task`/`list_tasks`/`list_projects`/`create_project` all work with scope + owner enforcement.
- [ ] An agent can reuse an existing project or `create_project` a fresh isolated one; tasks land in the right project; `tags` round-trip on `create_task`.
- [ ] Card appears **live** (< ~1s) on `create_task` in **Queue**; approve / request-changes round-trips to the agent; the card moves Queue → Awaiting agent → Agent working as the agent consumes the result.
- [ ] `await_task` returns self-documenting `pending`; agent re-poll works.
- [ ] Idempotency + revision guards covered by tests.

## Risks / watch-outs
- **The whole product lives here** — optimize the card-appearance latency + animation; this *is* the demo.
- Don't let onboarding slip to a later phase; without mint-key the acceptance test can't run.
- Keep `await_task` ceiling under the Convex action timeout; rely on re-poll for long human turns.
