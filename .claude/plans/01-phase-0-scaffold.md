# Phase 0 — Scaffold

**Goal:** stand up the **fresh loophand Convex project** + a new Vite app so a token can create a row and a signed-in human sees an (empty) board. No product behavior yet — just the schema defined, types flowing, deploy green.
**Depends on:** nothing.
**Rough size:** 2–4 days.

> **Fresh project — no migrations, no backfill.** loophand is a brand-new Convex deployment. We *copy* the patterns/code we want from formbase into `/convex` and define the whole schema clean (with the right fields from the start). There is no existing data to migrate.

## Backend (Convex) — `convex/`

1. **`convex/convex.config.ts`** — set up the components we use: better-auth, R2, rate-limiter (and Polar later). Copy from formbase, trim to what loophand needs.
2. **`convex/schema.ts` — define the whole schema fresh.** Two groups, all defined from scratch:
   - **Foundation (port the shapes from formbase, keep only what we need):** `users`, `workspaces`, `workspaceMembers` (**with `role: "owner"|"admin"|"member"` from day one**), `workspaceInvites`, `apiTokens`, `oauthClients`/`oauthAuthCodes`/`oauthRefreshTokens`, `managedFiles`/`managedFileReferences`/`pendingR2Uploads` (**`ownerType` includes `"task"`/`"taskItem"` from day one**), `folders` (= boards).
   - **Net-new domain tables:** `tasks`, `taskItems`, `taskDeps`, `taskActivity`, `taskComments`, `taskAudit`, `schedules`, `pushSubscriptions`. Indexes: `tasks.by_board_status`/`by_workspace_status`/`by_token`/`by_idempotency`/`by_expires`; `taskItems.by_task_order`; `taskDeps.by_dependsOn`/`by_task`; `schedules.by_next_run`.
3. **Copy the auth/MCP/storage code** from formbase into `convex/` and adapt: `lib/apiTokenAuth.ts`, `lib/auth.ts`, `http/oauthServer/*`, `http/mcp/*`, `lib/managedFiles.ts`, `http/storage.ts`, `crons.ts`.
4. **Scope vocabulary:** include `tasks:read` / `tasks:write` in the API-token scope set in `lib/apiTokenAuth.ts`.
5. `npx convex dev` to generate `_generated/` types.

## MCP — `convex/http/mcp/`

6. Create `tools/tasks/`. Add **stub** `defineTool` entries `create_task` and `get_task` that call thin `tasks.create`/`tasks.get` (insert + read only). Register them in `MCP_ALL_TOOLS` (`server.ts`).
7. Wire **scope + workspace assertion helpers** (used everywhere later): `requireTaskScope(ctx, "write")` and `assertSameWorkspace(ctx, row)` in `tools/tasks/lib.ts`. Even stubs call them — establishes the pattern.

## Frontend — `src/`

8. **Scaffold** Vite + React + TS + Tailwind at the repo root (frontend in `src/`, single `package.json` shared with `convex/`).
9. **Copy the UI we need from formbase into the repo:** `src/ui/` (the components in the reuse list), `src/auth-ui/` (sign-in / OAuth / callback), `src/convex-client/` (better-auth client + provider), `src/hooks/`, `src/styles/` (tokens/Tailwind preset + dark-mode `theme-provider`). Adapt imports to relative paths.
10. **Providers:** `ConvexProvider` + `BetterAuthProvider` (`src/convex-client`) + `ThemeProvider`.
11. **Routing** (TanStack Router or React Router): `/login`, `/` (board), `/settings/agents`. Guard `/` behind auth.
12. **Screens (shells only):** `src/auth-ui` sign-in on `/login`; authenticated layout = `src/ui` `sidebar` (boards placeholder) + an `empty` board state.
13. **PWA base:** `manifest.webmanifest` + a no-op service-worker registration (push wired in Phase 2).

## Infra
14. Create the loophand Convex deployments (dev + prod); set env (`API_TOKEN_PEPPER`, fresh R2 bucket + creds, `GITHUB_CLIENT_ID/SECRET`, VAPID keys for Phase 2). 
15. Seed script: one workspace, one board (`folders` row), one owner `member`, one minted API key (printed once) for local agent testing.
16. CI: typecheck + build `convex` + `src`.

## Security
- Establish the **assert-in-every-function** pattern now (helpers in step 7) so it's not retrofitted. No tool ships without a scope check, even stubs.

## Testing
- Convex function unit test: `tasks.create` inserts with `workspaceId` stamped; `tasks.get` rejects a foreign-workspace id.
- App boots, sign-in works, empty board renders in light + dark.

## Definition of Done
- [ ] Full schema (foundation + domain tables) + indexes live on a fresh deployment; `_generated` types compile.
- [ ] `managedFiles.ownerType` includes `task`/`taskItem`; `workspaceMembers.role` present — defined from the start, no backfill.
- [ ] `create_task`/`get_task` stubs callable over MCP with a real token; unauthorized scope is rejected.
- [ ] New user can sign in (Google/GitHub/magic-link) and land on an empty board (light/dark).
- [ ] Seed script produces a workspace + board + API key; CI green.

## Risks / watch-outs
- **Copy deliberately:** pull only the formbase code loophand needs and adapt imports — don't drag in form-builder-specific tables/functions.
- Confirm the MCP `httpAction` route is reachable with the new tools registered (smoke test with `curl` + bearer token).
- Fresh R2 bucket + VAPID/OAuth credentials are loophand's own — don't point at formbase's.
