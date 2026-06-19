# Phase 0 — Scaffold

**Goal:** stand up the **fresh loophand Convex project** wired into the existing TanStack Start app so a token can create a row (in a default project) and a signed-in human sees an (empty) board. No product behavior yet — just the schema defined, types flowing, deploy green.
**Depends on:** nothing.
**Rough size:** 2–4 days.

> **Fresh project — no migrations, no backfill.** loophand is a brand-new Convex deployment. We *copy* the patterns/code we want from formbase into `/convex` and define the whole schema clean (with the right fields from the start). There is no existing data to migrate.

## Backend (Convex) — `convex/`

1. **`convex/convex.config.ts`** — set up the components we use: better-auth, R2, rate-limiter (and Polar later). Copy from formbase, trim to what loophand needs.
2. **`convex/schema.ts` — define the whole schema fresh.** Two groups, all defined from scratch:
   - **Foundation (port shapes from formbase, keep only what we need — NO workspace/team tables):** `users`; `apiTokens` (**bind to `userId` — drop formbase's `workspaceId` field**; keep `name`/`tokenHash`/`tokenPrefix`/`lastUsedAt`/`scope`); `oauthClients`/`oauthAuthCodes`/`oauthRefreshTokens` (**drop their `workspaceId` columns — bind to `userId` only**); `managedFiles`/`managedFileReferences`/`pendingR2Uploads` (**`ownerType` lives on `managedFileReferences`, NOT `managedFiles` — add `"task"`/`"taskItem"` to that union from day one; `managedFiles` stays owner-agnostic, keyed by random `r2Key`**). **Skip `workspaces`, `workspaceMembers`, `workspaceInvites`, `folders` entirely.**
   - **Net-new domain tables:** `projects` (`{ name, userId, createdByTokenId?, isDefault, createdAt }` — the isolated kanban board; replaces workspace+folder), `tasks` (stamp `userId` + `projectId` + `tags: string[]`; **`status: "open" | "awaiting_agent" | "resumed" | "done" | "blocked"`** = the kanban column axis, **no `in_progress`**; **`outcome: "approved" | "changes_requested" | "cancelled" | "expired" | "dependency_failed" | null`** = a separate badge; plus `revision`, `resumedByTokenId`, `resultConsumedAt`, `expiresAt`), `taskItems`, `taskDeps`, `taskActivity`, `taskComments`, `taskAudit`, `schedules`, `pushSubscriptions`. Indexes: `projects.by_user`; `tasks.by_project_status`/`by_user_status`/`by_token`/`by_idempotency`/`by_expires` (tag filtering: index `by_project` + filter `tags` in-query for v1); `taskItems.by_task_order`; `taskDeps.by_dependsOn`/`by_task`; `schedules.by_next_run`.
3. **Copy the auth/MCP/storage code** from formbase into `convex/` and adapt: `lib/apiTokenAuth.ts`, `lib/auth.ts`, `http/oauthServer/*`, `http/mcp/*`, `lib/managedFiles.ts`, `http/storage.ts`, `crons.ts`.
4. **Scope vocabulary (NET-NEW authz layer):** formbase stores `apiTokens.scope` (a single space-delimited OAuth string) but **never checks it** in tool execution — there is no `requireScope` helper to extend. Build scope enforcement: define the `tasks:read`/`tasks:write` vocabulary and a checker that reads the token's `scope` from the MCP auth context. This is new code, not an edit to an existing scope set.
5. `npx convex dev` to generate `_generated/` types.

## MCP — `convex/http/mcp/`

6. Create `tools/tasks/`. Add **stub** `defineTool` entries `create_task` and `get_task` (Zod `schema` + `execute(mcpCtx, input)`) that call thin `tasks.create`/`tasks.get` (insert + read only). **Registration mechanism (verified):** export a `taskTools` array and add it to `ALL_TOOLS` in `tools/index.ts` (which feeds `getAllTools()` → `MCP_ALL_TOOLS` in `server.ts`); also add the names to the eager-advertise `CORE_TOOL_NAMES` set or they're only discoverable via `load_tools`. Tools must pass the registration lints (`assertVerbVocabulary`, `assertDescriptionQuality`, `assertNoDuplicateToolNames`).
   - **⚠ Verb-lint gotcha:** `ALLOWED_VERBS` (in `tools/lib/toolNameLint.ts`) is `create/delete/destroy/restore/disconnect/get/list/update/replace/clear/reset/publish/unpublish/republish/attach/detach/insert/format/test/retry/set/load`. It has **no `await`, `cancel`, or `fetch`** — so `await_task`/`cancel_task` (Phase 1) and `fetch_file` (Phase 3) will fail the lint. Either extend `ALLOWED_VERBS` in loophand's copy (and `READ_VERBS` for reads) or rename (e.g. `get_file`). Decide here so naming is stable from the first tool.
7. Wire **scope + owner assertion helpers** (used everywhere later): `requireTaskScope(ctx, "write")` (the net-new scope checker from step 4) and `assertTaskOwner(ctx, row)` in `tools/tasks/lib.ts` — asserts `row.userId === ctx.userId` (and the row's `projectId` belongs to that user). formbase's gate (`assertCallerWorkspaceScope`) is workspace-shaped and irrelevant; this is net-new but the *idea* mirrors `verifyWorkspaceAccess`. Even stubs call both — establishes the pattern.

## Frontend — `src/`

8. **Scaffold already exists** — the repo is a live **TanStack Start** app (React 19, Vite, Tailwind v4, Cloudflare/wrangler, oxlint/oxfmt) with `src/` + an empty `convex/`. This step is just wiring Convex into it (`convex dev`, providers), **not** a fresh `create-vite`.
9. **Copy the UI we need from formbase into the repo:** `src/ui/` (the 17 reuse-list components — all verified to exist under `packages/ui/src/components/{layout,navigation,actions,feedback,misc,form}`), `src/auth-ui/` (from `packages/auth-ui`: `AuthLoginPage`/`AuthCallbackPage`), `src/convex-client/` (better-auth client + provider), `src/hooks/`, `src/styles/` (port `@formbase/tailwind-css/index.css` — a Tailwind **v4 `@theme` token file**, not a v3 preset — + dark-mode `theme-provider`). Adapt imports to relative paths; both repos are Tailwind v4 so tokens transfer directly.
10. **Providers:** `ConvexProvider` + `BetterAuthProvider` (`src/convex-client`) + `ThemeProvider`, mounted in the TanStack Start root route.
11. **Routing** (TanStack Router, file-based — already wired via `tsr`): `/login`, `/` (board), `/settings/agents`. Guard `/` behind auth.
12. **Screens (shells only):** `src/auth-ui` sign-in on `/login`; authenticated layout = `src/ui` `sidebar` (projects placeholder) + an `empty` board state.
13. **PWA base:** `manifest.webmanifest` + a no-op service-worker registration (push wired in Phase 2).

## Infra
14. Create the loophand Convex deployments (dev + prod). **Provision every integration fresh — all loophand-owned, none shared with formbase:** new R2 bucket + keys, new Google OAuth app (`GOOGLE_CLIENT_ID/SECRET`), new GitHub OAuth app (`GITHUB_CLIENT_ID/SECRET`, used Phase 1), new **Resend** account (`RESEND_API_KEY`), new VAPID keypair (Phase 2). Set env: `API_TOKEN_PEPPER`, the above, plus better-auth secret. 
15. Seed script: one user, one default project (`projects` row, `isDefault: true`), one minted API key (printed once) for local agent testing.
16. CI: typecheck + build `convex` + `src`.

## Security
- Establish the **assert-in-every-function** pattern now (helpers in step 7) so it's not retrofitted. No tool ships without a scope check, even stubs.

## Testing
- Convex function unit test: `tasks.create` inserts with `userId` + `projectId` stamped; `tasks.get` rejects a foreign-user id (and a project not owned by the caller).
- App boots, sign-in works, empty board renders in light + dark.

## Definition of Done
- [ ] Full schema (foundation + domain tables) + indexes live on a fresh deployment; `_generated` types compile.
- [ ] `managedFileReferences.ownerType` includes `task`/`taskItem`; `projects` table + a default project + `tasks.tags` present — defined from the start, no backfill. No workspace tables exist.
- [ ] `create_task`/`get_task` stubs callable over MCP with a real token; unauthorized scope is rejected.
- [ ] New user can sign in (Google + magic-link — the providers formbase ships; **GitHub is added in Phase 1**) and land on an empty board (light/dark).
- [ ] Seed script produces a user + default project + API key; CI green.

## Risks / watch-outs
- **Copy deliberately:** pull only the formbase code loophand needs and adapt imports — don't drag in form-builder-specific tables/functions.
- Confirm the MCP `httpAction` route is reachable with the new tools registered (smoke test with `curl` + bearer token).
- Fresh R2 bucket + VAPID/OAuth credentials are loophand's own — don't point at formbase's.
