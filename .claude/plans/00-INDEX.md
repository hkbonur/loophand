# loophand — Implementation Plan Index

Phase-by-phase build plan for **loophand**, a human-in-the-loop kanban for terminal/MCP agents. Each phase is its own file with concrete backend, MCP, frontend, security, and acceptance criteria.

**Repo layout — single app, not a monorepo.** Everything lives in two top-level folders:
- **`/convex`** — the Convex backend (schema, functions, `http/mcp`, crons).
- **`/src`** — the frontend, organized as `src/ui`, `src/auth-ui`, `src/convex-client`, `src/hooks`, plus app code (`src/board`, `src/tools`, `src/routes`).

**Reuse = copy, not import.** formbase is the *source* we vendor from: copy the needed components/functions **into** loophand's `/src` and `/convex` and adapt them — no `@formbase/*` package imports.

> **Reference repo:** formbase lives beside loophand at `../formbase` (both under `~/git`). Treat it as the **reference implementation / how-to** — read its `packages/convex/src` (auth, `http/mcp`, `http/oauthServer`, `lib/apiTokenAuth`, `lib/managedFiles`, `http/storage`, `crons`) and `packages/ui` when implementing each phase, and copy + adapt the relevant pieces. Don't import it; mirror it.

## Standing decisions (carried into every phase)
- **Fresh project — everything provisioned from scratch:** loophand is a brand-new Convex deployment with a new frontend — **no migrations, no existing data.** Define the schema clean (right fields from day one). **Every external service and credential is loophand's own, set up new — not shared with or pointed at formbase:** its own Google OAuth app, its own GitHub OAuth app, its own R2 bucket + keys, its own **Resend** account/API key for email, its own VAPID keypair. formbase is a **code/pattern reference only** (how the wiring looks) — loophand owns the accounts.
- **Email = Resend.** loophand uses **Resend** for all transactional/notification email (magic-link, push-fallback notify). Ignore formbase's email stack (it uses AWS SES) — wire Resend fresh (`RESEND_API_KEY` env; `@convex-dev/resend` component or the REST API).
- **Tenancy = user + project (NO workspaces/teams for now).** loophand drops workspaces entirely. A **single human account** (the signed-in user) owns everything. Work is grouped into **`projects`** — each project is one isolated kanban board; an agent can **reuse an existing project or create a new isolated one**. **`projects` replaces both `workspaces` (old tenant) and `folders` (old board).** Isolation is enforced per-row on **`userId`** (hard security boundary) + **`projectId`** (logical board isolation — tasks/deps never cross projects). Multi-user / members / roles / invites / presence are **parked to After v1** (see Phase 4).
- **Tickets are taggable.** A task carries `tags: string[]` (e.g. a feature name) so agents can group/label work within a project; the board filters by tag. No separate tags table needed for v1.
- **Backend (copy *patterns* from formbase into `/convex`):** MCP-over-`httpAction` + OAuth 2.1 / API-key auth (`apiTokens`) + R2 storage (`managedFiles`) + crons + rate-limiter. Mirror the shapes; the credentials/buckets behind them are loophand's. **Drop everything workspace/team-shaped** when copying (members, invites, roles, workspace gate).
- **UI (copy needed components into `src/ui` / `src/auth-ui`):** build only the gaps (board, `CardDialog`, `ItemRail`, `AnnotationCanvas`, tool surfaces). Bring `@dnd-kit` and `sonner` along as direct deps.
- **Frontend already scaffolded:** the repo is a **TanStack Start** app (React 19, Vite, file-based TanStack Router, Tailwind **v4**, oxlint/oxfmt) — Phase 0 adds Convex + auth + the vendored UI, it does **not** re-scaffold.
- **Deployment:** cloud SaaS on hosted Convex; frontend deploys to **Cloudflare Workers** (`wrangler deploy`, see `wrangler.jsonc`); responsive web + PWA + web push.
- **Security is not deferred:** per-function **`userId` ownership assertion** (+ `projectId` scoping) + `tasks:*` scope checks land in Phase 1, not later. **Caveat (verified against formbase):** formbase's `assertCallerWorkspaceScope` (`http/mcp/workspaceGate.ts`) gates a `workspaceId`/`formId` input field and **does not enforce token scopes at all** (`apiTokens.scope` exists but is unused). loophand has no workspaces, so both the per-row **owner assert** (`row.userId === ctx.userId`, and the row's `projectId` belongs to that user) *and* the entire `tasks:*` scope layer are **net-new** — borrow the *idea* of `verifyWorkspaceAccess` (`lib/authorization.ts`) but key on `userId`/`projectId`.

## Phases
| # | File | Outcome |
|---|---|---|
| 0 | `01-phase-0-scaffold.md` | Repo scaffold (`/src` + `/convex`), copy backend/UI from formbase, schema tables, MCP tool stubs, auth, deploy. |
| 1 | `02-phase-1-core-loop.md` | The end-to-end loop (approval) + onboarding to a connected agent. **The acceptance test.** |
| 2 | `03-phase-2-visual-review-push.md` | Hero tool (screenshot annotation) + reliable background web push. |
| 3 | `04-phase-3-docs-storage-multiitem.md` | Doc render review, R2 artifacts + `fetch_file`, multi-item `ItemRail`. |
| 4 | `05-phase-4-multi-agent-user.md` | Multi-**agent** project board (one human, many agent tokens): attribution, **ticket tags**, board search/filter, agent last-seen. *(Multi-user/members/roles/presence parked to After v1.)* |
| 5 | `06-phase-5-deps-scheduling.md` | Task dependencies (DAG) + cron scheduling, race/dup-free. |
| 6 | `07-phase-6-breadth-polish.md` | Remaining tools (input/sketch/image studio/diff), glass-box, round-trip reducers, rate limits. |
| 7 | `08-phase-7-dogfood-launch.md` | Dogfood multi-hour loops, metrics, Claude Code plugin, security/perf pass. |

## Sequencing rule
Ship **Phase 1** and live with it before widening. Phases 1–2 (security + onboarding + push) are non-negotiable; multi-agent/tags (4) and deps/scheduling (5) only matter once 1 is loved.

## Conventions used in each file
- **Paths** are relative to the loophand repo root: backend `convex/…`, frontend `src/…`.
- Each phase lists: Goal · Depends on · Backend · MCP · Frontend (reuse vs build) · Security · Testing · **Definition of Done** · Risks.
- "DoD" = the checklist that must pass before the phase is considered shippable.
