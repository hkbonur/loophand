# Phase 4 — Multi-agent / multi-user (shared team board)

**Goal:** several agents and several humans share one board cleanly and safely — attribution, roles, claim conflicts, presence, search.
**Depends on:** Phase 1 (auth/tenancy already enforced per-function).
**Rough size:** 1.5–2 weeks.

---

## Backend (Convex)

1. **Members & roles:** `workspaceMembers.role` (`owner|admin|member`) now enforced. Reuse `workspaceInvites` for invite flow; `members.invite/list/setRole/remove`.
2. **Authorization helpers:** `requireRole(ctx, ["owner","admin"])`; gate **destructive approvals** (a `diff_review` migration/force-push — Phase 6 tool, but gate defined here) to owner/admin/assignee. `claim`/`complete` require workspace membership.
3. **Attribution:** `createdByTokenId` surfaced; join to a friendly agent name (the `apiTokens.name`).
4. **Presence:** lightweight `presence` (ephemeral table or heartbeat) — who's viewing the board + which card each has open. `presence.heartbeat(boardId, taskId?)` every ~15s; stale rows pruned by cron.
5. **Audit:** `taskAudit` writes on every approve/reject/cancel/assign (server-only).
6. **Agent last-seen:** stamp `apiTokens.lastUsedAt` on any tool call (already in `apiTokenAuth`) — surface "agent went dark."

## MCP
- No new tools. `list_boards`/`list_tasks(mine)` already support multi-agent recovery.
- Ensure scope checks distinguish a read-only agent token from a writer.

## Frontend — build

**Reuse:** `src/ui` `filter-menu`/`filter-select` (board search), `avatar`, `dropdown-menu`, `command`, `dialog`, `sonner`.

**Build:**
- **`AgentsPanel`** (settings) — list tokens/agents: name, last-seen, scopes, revoke; mint (plaintext once).
- **`MembersPanel`** — invite (link/code), list, role select, remove.
- **`PresenceBar`** — avatars of who's on the board; per-card "X is viewing".
- **Claim-conflict UI** — claim rejected (someone grabbed it) → "Taken by Alex" read-only state with a **steal** option; live-driven by the reactive query.
- **Assignee** — assign a card to a member (`tasks.assign`); assignee avatar on the card; notifications route to the assignee only.
- **Board search/filter** — by agent, type, status (essential once multi-agent boards fill up).
- **Card attribution** — raising-agent avatar + assignee/claimer avatar.

## Security (§11.1, §11.4 start)
- Per-function workspace assertions already in place; add **role gates** for destructive ops + member-only actions.
- Begin rate-limiting groundwork (full limits in Phase 6): wrap `create_task` with the reused `@convex-dev/rate-limiter` per token/workspace.

## Testing
- Two agents + two humans on one board: attribution correct; assignment routes notifications.
- **Claim race:** two humans open the same card; one wins, the other sees "taken/steal" (no silent failure).
- A `member` cannot approve a destructive op; an `owner` can.
- Presence shows/clears correctly on tab close (ghost tolerance noted).

## Definition of Done
- [ ] Invite a teammate; both see the same live board with presence.
- [ ] Cards show which agent raised them and who's working them.
- [ ] Claim conflicts resolved in-UI; assignment + assignee-scoped notifications work.
- [ ] Role-gated destructive approvals enforced server-side; `taskAudit` records decisions.
- [ ] Board search/filter usable on a busy board.

## Risks / watch-outs
- Presence is easy to get subtly wrong (ghosts on tab-close) — keep it a *soft* signal; `claim` is the hard lock.
- Don't let role logic live only in the UI — enforce in Convex.
- Reactive fan-out grows with members × cards; measure board query cost (optimize in Phase 7).
