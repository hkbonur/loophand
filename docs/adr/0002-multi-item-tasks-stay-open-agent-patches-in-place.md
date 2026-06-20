# Multi-item tasks stay open; the agent patches items in place

Single-surface tasks follow a one-shot, in-place model: the human resolves, the task
moves `open → awaiting_agent → resumed → done`, and `done` is terminal. Multi-item
tasks deliberately break that model.

A multi-item task stays `open` for its whole life — across as many human/agent rounds as
it takes. The human resolves items individually (`items.setStatus`), each write bumping
`tasks.itemsDone` in the same OCC-safe mutation. When `itemsDone === itemCount`,
`await_task` wakes and returns the **rollup**. The same `setStatus` that trips the count
checks the verdicts: all `approved` flips the task to `done` (the only terminal trigger);
any `changes_requested` leaves it `open`. The agent then patches the failed items back to
`pending` — `itemsDone` drops below `itemCount`, which silently re-arms `await_task` for
the human's next pass.

So `itemsDone` (not task `status`) drives both the await signal and completion, and the
review loop lives entirely on one `task_id`.

**Considered and rejected:**
- *Retry-as-new-task* (rollup on a `done` task; agent creates a fresh task with only the
  failed items). Cleanest fit for the existing terminal-`done` model, but scatters one
  logical review across many task ids and cards.
- *Reopen via an `awaiting_agent` handoff* (partial → `awaiting_agent`; agent calls
  `resume_items` to reset failed items and flip back to `open`). Keeps one id but adds a
  status round-trip and a dedicated reopen verb.

**Consequences:** `await_task` for multi-item tasks fires on `itemsDone === itemCount`,
not on a status change — a second, item-count-based await predicate the long-poll must
support. The card persists and visibly evolves across rounds (the "loop" the product is
named for). `done` is no longer universally terminal-on-first-resolve; any code asserting
that invariant must special-case multi-item tasks. A nightly `reconcile.itemCounts` cron
backstops `itemsDone` drift.
