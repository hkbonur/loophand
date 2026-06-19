# loophand — Implementation Plan Index

Phase-by-phase build plan for **loophand**, a human-in-the-loop kanban for terminal/MCP agents. Each phase is its own file with concrete backend, MCP, frontend, security, and acceptance criteria.

**Repo layout — single app, not a monorepo.** Everything lives in two top-level folders:
- **`/convex`** — the Convex backend (schema, functions, `http/mcp`, crons).
- **`/src`** — the frontend, organized as `src/ui`, `src/auth-ui`, `src/convex-client`, `src/hooks`, plus app code (`src/board`, `src/tools`, `src/routes`).

**Reuse = copy, not import.** formbase is the *source* we vendor from: copy the needed components/functions **into** loophand's `/src` and `/convex` and adapt them — no `@formbase/*` package imports.

> **Reference repo:** formbase lives beside loophand at `../formbase` (both under `~/git`). Treat it as the **reference implementation / how-to** — read its `packages/convex/src` (auth, `http/mcp`, `http/oauthServer`, `lib/apiTokenAuth`, `lib/managedFiles`, `http/storage`, `crons`) and `packages/ui` when implementing each phase, and copy + adapt the relevant pieces. Don't import it; mirror it.

## Standing decisions (carried into every phase)
- **Fresh project:** loophand is a brand-new Convex deployment with a new frontend — **no migrations, no existing data.** Define the schema clean (right fields from day one); fresh R2 bucket + OAuth/VAPID credentials are loophand's own.
- **Backend (copy from formbase into `/convex`):** MCP-over-`httpAction` + OAuth 2.1 / API-key auth (`apiTokens`) + R2 storage (`managedFiles`) + crons + rate-limiter.
- **UI (copy needed components into `src/ui` / `src/auth-ui`):** build only the gaps (board, `CardDialog`, `ItemRail`, `AnnotationCanvas`, tool surfaces). Bring `@dnd-kit` and `sonner` along as direct deps.
- **Deployment:** cloud SaaS on hosted Convex; responsive web + PWA + web push.
- **Security is not deferred:** per-function `workspaceId` assertion + `tasks:*` scope checks land in Phase 1, not later (a field-name-based workspace gate does NOT isolate our tables).

## Phases
| # | File | Outcome |
|---|---|---|
| 0 | `01-phase-0-scaffold.md` | Repo scaffold (`/src` + `/convex`), copy backend/UI from formbase, schema tables, MCP tool stubs, auth, deploy. |
| 1 | `02-phase-1-core-loop.md` | The end-to-end loop (approval) + onboarding to a connected agent. **The acceptance test.** |
| 2 | `03-phase-2-visual-review-push.md` | Hero tool (screenshot annotation) + reliable background web push. |
| 3 | `04-phase-3-docs-storage-multiitem.md` | Doc render review, R2 artifacts + `fetch_file`, multi-item `ItemRail`. |
| 4 | `05-phase-4-multi-agent-user.md` | Shared team board: members/roles, attribution, claim conflict, presence, search. |
| 5 | `06-phase-5-deps-scheduling.md` | Task dependencies (DAG) + cron scheduling, race/dup-free. |
| 6 | `07-phase-6-breadth-polish.md` | Remaining tools (input/sketch/image studio/diff), glass-box, round-trip reducers, rate limits. |
| 7 | `08-phase-7-dogfood-launch.md` | Dogfood multi-hour loops, metrics, Claude Code plugin, security/perf pass. |

## Sequencing rule
Ship **Phase 1** and live with it before widening. Phases 1–2 (security + onboarding + push) are non-negotiable; 4–5 only matter once 1 is loved.

## Conventions used in each file
- **Paths** are relative to the loophand repo root: backend `convex/…`, frontend `src/…`.
- Each phase lists: Goal · Depends on · Backend · MCP · Frontend (reuse vs build) · Security · Testing · **Definition of Done** · Risks.
- "DoD" = the checklist that must pass before the phase is considered shippable.
