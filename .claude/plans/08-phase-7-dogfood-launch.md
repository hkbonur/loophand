# Phase 7 — Dogfood, distribution & launch

**Goal:** prove the thing with real multi-hour usage, ship the frictionless on-ramp (Claude Code plugin), and pass the security/perf bars before opening up.
**Depends on:** Phases 1–6.
**Rough size:** 1.5–2 weeks (ongoing).

---

## Dogfood
1. Run a **real multi-hour Claude Code loop** against a live board; handle tasks without breaking flow; confirm the loop resumes correctly. Then run a **second, headless agent** (cron/CI) concurrently to exercise multi-agent + scheduling.
2. Recruit a handful of Claude Code users for a closed test.

## Metrics & instrumentation
- Instrument and dashboard the three numbers from the plan's success criteria:
  - **Time-to-first-resolved-task** (onboarding friction).
  - **Tab-retention** (did they come back the next day?).
  - **`await_task` round-trips / re-polls** per task (loop health).
- Per-tool usage + **frequency** (validate which tools earn their keep before further investment).
- Add a minimal analytics events table (or reuse formbase analytics).

## Distribution — Claude Code plugin + skill
3. **Claude Code plugin** bundling: the MCP server config (one-click connect, no manual `.mcp.json`), a **skill** encoding the "when to pull in a human" admission filter (§4.5), and **slash commands** (`/ask-human`, `/await-review`). Publish to a marketplace.
4. **CLI fallback** (thin) for non-MCP environments.
5. Docs: connect snippet, tool reference, result schemas (`result_version`).

## Security & compliance pass
6. Run the **§11 checklist** end-to-end as a release gate:
   - Per-function workspace assertions + scope on **every** tool (automated test that fuzzes foreign IDs).
   - `fetch_file` IDOR test (no raw-key access, no cross-tenant).
   - SSRF (no server URL fetch), stored-XSS (agent strings as text, sandboxed SVG/PDF), `frame-ancestors 'none'`.
   - Rate limits + quotas under load.
7. Commission an external review (or the security-review subagent) on the diff. Begin **SOC 2** groundwork (the paid-tier requirement).

## Performance pass
8. **Reactive fan-out** on a busy board: split `taskActivity`/`taskItems` streams from the board list query so item churn doesn't invalidate columns; verify index coverage; load-test a 200-card board with several humans.
9. PWA/push reliability across the browser/OS matrix; bundle-size budget (lazy-load tool surfaces).

## Definition of Done
- [ ] A dev runs a real multi-hour loop, resolves tasks in-flow, and **returns the next day** (tab-retention > 0 in the cohort).
- [ ] Metrics dashboards live (TTF-resolved-task, retention, round-trips, per-tool frequency).
- [ ] Claude Code plugin installable from a marketplace; CLI fallback works.
- [ ] §11 security checklist passes as a release gate; external review clean.
- [ ] Busy-board performance acceptable; push reliable on the target matrix.

## Risks / watch-outs
- **Frequency is the real uncertainty** (per the verdict): if artifact work is rare per session, retention suffers — let the metrics decide whether to deepen tools or double down on the high-frequency approval/visual-review path.
- A bigger player could absorb the basic loop — lean on depth (work-surfaces) + the OSS-core/plugin distribution as the moat.
- Don't gate launch on every tool; the approval + visual-review loop is the wedge.

---

## After v1 (parked, from the plan)
Native mobile apps · public tool-SDK / marketplace · full audit/provenance · **human-gated ephemeral credential grants** (scoped, short-lived, never a standing vault) · on-prem/self-host tier (Convex is self-hostable).
