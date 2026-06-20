# loophand — Domain Language

loophand is a kanban board where coding **agents** open **tasks** for a **human** to
review, and block until the human resolves them. This file is the shared glossary —
the canonical word for each concept. It is not a spec.

## Tasks & review

**Task**:
One kanban ticket an agent opens for a human to act on. Has a `type` (the kind of
review), a `status` (kanban column), and an `outcome` (badge). Resolved in-place — no
`in_progress` column.
_Avoid_: ticket (UI word only), card (the rendered task), job.

**Task type**:
The review surface a task carries: `approval` (decide yes/no), `visual_review`
(annotate a screenshot), `doc_review` (annotate a rendered document). One open enum,
validated in the tool layer.

**doc_review**:
A task type where the agent supplies a **render spec**, the client renders it to a PDF,
and the human annotates it page-by-page (reusing the visual_review annotation canvas).
Frontend component is `DocReview`. The result is tagged `tool: "doc_review"`.
_Avoid_: doc_render (that names the production step, not the task type), document review.

**Render spec**:
The agent-supplied description of a document, carried in a doc_review task's
`toolPayload`. Produced into a PDF on the client. Two kinds: a `react_pdf` tree
(constrained, serializable) or `xsl_fo` source. Never executable code.
_Avoid_: template, doc payload.

**Item**:
One reviewable unit within a multi-item task, rendered as a cell in the `ItemRail`
filmstrip. A task has `itemCount` items and tracks `itemsDone`; each item has its own
status (`pending`/`approved`/`changes_requested`/`skipped`). A single-surface task has
no items. Items are opt-in — only created when the agent supplies `items[]` at create.
_Avoid_: row, entry, sub-task.

**Item loop**:
The multi-item review cycle. A multi-item task stays `open` across rounds — it does not
hand off to `awaiting_agent`. The human resolves each item; when `itemsDone === itemCount`
the rollup wakes `await_task`. If every item is `approved` the task flips to `done`;
otherwise it stays `open` and the agent patches the `changes_requested` items back to
`pending` (dropping `itemsDone`), which silently re-arms the human's next pass. This is
the loop the product is named for, and it deliberately overrides the single-task rule
that `done` is terminal and review is one-shot (see ADR-0002).
_Avoid_: batch retry, reopen, resubmit.

**Rollup**:
The agent-facing result of a multi-item task: `{ items: [{ name, order, status, result? }],
partial }`, where `partial` is true iff any item is not `approved`. The agent reads it to
decide which items to revise.
_Avoid_: summary, digest.

## Storage & artifacts

**Artifact**:
A stored file attached to a task — either an agent-supplied input (a screenshot) or a
human-produced output (a rendered, approved PDF). Lives in R2 under a random key.
_Avoid_: file (too generic), blob (the R2 object specifically), attachment.

**Output name**:
The stable, human-meaningful name an agent uses to fetch an artifact later
(e.g. `item-1.pdf`). Distinct from the unguessable R2 key. `fetch_file(task_id, name)`
resolves an output name to its artifact after an owner check.
_Avoid_: filename, key, path.

**Storage proxy**:
The public `…/api/storage/<r2Key>` endpoint that 302-redirects to a freshly signed R2
URL. Unauthenticated by design — safe because R2 keys are random UUIDs. Used for board
image embeds. NOT the agent fetch path.
_Avoid_: CDN, signed URL (that is what it redirects to).
