# Phase 5 — Task dependencies (DAG) + scheduling

**Goal:** an agent can fan out a DAG of human tasks and `await_task` only the leaf; recurring/delayed cards via cron — all **race- and duplicate-free** (the concurrency edge cases from the review).
**Depends on:** Phase 1 (lifecycle), Phase 4 (multi-agent makes deps useful).
**Rough size:** 1.5–2 weeks.

---

## Backend (Convex)

1. **Dependencies:**
   - `tasks.create` with `depends_on[]` → write **`taskDeps`** edges (`taskId`, `dependsOnId`); set initial `status = blocked` if any dep is non-terminal or `notBefore` is future, else `open`.
   - **Validation at create:** reject self-deps, **cross-project deps** (and any cross-user, which can't occur but assert anyway), and **cycles** (walk the DAG via `taskDeps`); a dep already terminally failed (`outcome` `cancelled`/`expired`/`dependency_failed`) fails the dependent immediately. (`changes_requested` is **not** a failure — the agent reworks it; the dependent stays blocked until that dep is `approved` or fails.)
   - **`unblockDependents(taskId)`** (internal): read `taskDeps.by_dependsOn(taskId)`; for each dependent, **re-read all its deps fresh in this transaction** (never trust counters) → flip to `open` only when **every dep has `outcome:"approved"`** and `notBefore` passed. Avoids the "two deps finish at once → stuck blocked" race.
   - **Transitive cascade:** if a task ends terminally failed (`outcome` `cancelled`/`expired`/`dependency_failed`), auto-fail dependents (`outcome:"dependency_failed"`, status `done`) and recurse, batched to limit reactive fan-out.
2. **Delayed tasks:** `not_before` → start `blocked`; `scheduler.runAt(notBefore, unblockCheck)`.
3. **Scheduling:**
   - `schedules` CRUD; `tick()` registered in `convex/crons.ts` (1-min interval) scanning `by_next_run` for due+enabled rows.
   - **Idempotent:** advance `lastMaterializedSlot`/`nextRunAt` **before** creating the task (key = `scheduleId + slot`); honor `skipIfPrevOpen`; store IANA `timezone`; on **backfill** jump to the next future slot (no burst replay); **auto-disable** schedules whose board/token is gone.

## MCP
- `create_task` gains `depends_on[]`, `not_before`, `schedule_cron` (the last creates a `schedules` row instead of a one-off).
- Document the DAG pattern: create children, then a parent with `depends_on`, then `await_task(parent)`.

## Frontend — build
- **`BlockedLane`** — collapsed lane showing blocked cards with a lock + dep count; auto-empties as deps resolve.
- **Dep mini-view** in `CardDialog` — lists blockers/blocked-by; optional small DAG visual (reuse Konva).
- **`SchedulesPanel`** — create/enable/disable recurring templates: cron builder, timezone, next-run preview, `skipIfPrevOpen` toggle.

## Security
- Cross-project (and cross-user) dep references are an isolation leak — the create-time validation (above) is a **security** check, not just UX.
- Cap `depends_on` length and active schedules per user (full quotas in Phase 6).

## Testing
- **Concurrency:** complete two deps of one blocked task near-simultaneously → it unblocks exactly once (no stuck-blocked). Cycle/self/cross-project deps rejected at create.
- **Cascade:** A→B→C; fail A → B and C both fail with `dependency_failed`.
- **Schedules:** a daily schedule materializes exactly one card per slot; simulate downtime → no duplicate burst; deleted board → schedule auto-disables.
- DST boundary test for timezone correctness.

## Definition of Done
- [ ] Agent fans out a DAG, `await_task`s only the leaf, gets the rolled-up result.
- [ ] Concurrent dep completion never wedges a task; cycles/self/cross-project rejected.
- [ ] Transitive failure cascade works.
- [ ] Cron schedules fire idempotently (no dupes after downtime), respect timezone, auto-disable on dead board/token.

## Risks / watch-outs
- The unblock **fresh-read in-transaction** rule is the crux — a counter-based shortcut reintroduces the race.
- Schedule idempotency must advance `nextRunAt` *before* materializing, or a slow/failed tick double-fires.
- Deep cascades fan out reactively — batch the writes.
