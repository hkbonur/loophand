---
name: forge
description: Disciplined feature implementation. Isolates work in a git worktree, decomposes the task into small components built test-first (TDD), runs the cleanup pass between components, optionally fans out to sub-agents for independent work, runs a strict quality review before merge, and only merges to main once type-checking and unit tests pass cleanly. Composes with @.claude/skills/tdd/ (red-green-refactor loop), @.claude/skills/cleanup/ (between commits), @.claude/skills/coding-rules/ (consulted during implementation), and @.claude/skills/review/ (thermo-nuclear quality gate before merge).
---

Turn a feature request into small, test-first commits on an isolated branch, then gate the merge on green type-check + tests.

**Flow**: pre-flight → decompose → worktree → per-component TDD (+cleanup) → optional parallel → pre-merge gate → quality review (+user decision) → merge.

**Composition**: `coding-rules` = what good looks like (consulted while writing). `tdd` = how to write tests (red-green-refactor philosophy, vertical slices, mocking guidelines). `cleanup` = what to inspect after a change (run between commits). `review` = strict maintainability gate run on the full diff before merge. `forge` = how to build.

Skip this skill for one-line tweaks, dependency bumps, deletable spikes, or pure refactors with no behavior change.

Always conduct `CONTEXT.md` and related ADR reviews before implementation to get better understanding of the domain, but use `forge` for the implementation itself.

---

## Step 0 — Pre-flight

- `main` is clean (no uncommitted changes, no in-progress merge).
- Project's unit-test command is green on `main`. If already red, surface to user before adding to the mess.
- **Prefactor** — survey the code the change will touch and look for restructurings that make the implementation easier _before_ writing any new behavior. "Make the change easy, then make the easy change." Land each prefactor as its own behavior-preserving commit (tests stay green) so the feature diff that follows is small and obvious. If no prefactor pays off, say so and move on.
- Cache two commands for later:
  - **Scoped tests** — runs only files you touched (e.g. `pnpm vitest run <paths>`). Used between commits.
  - **Full suite** — repo-root test command. Used only at the pre-merge gate.

---

## Step 1 — Decompose

Write a short plan. A component = ~30–150 LOC + tests. Bigger → split. Smaller → fold into next.

For each component capture:

- **Name** — verb-phrase
- **Public surface** — the function/route/component a caller hits (becomes the first test)
- **Depends on** — other components in plan, or none
- **Parallelizable?** — yes only if no in-plan dep AND no shared file edits

Sequence: leaves first, then dependents. Mark parallel groups.

If plan exceeds ~6 components, ask user whether to scope down.

---

## Step 2 — Worktree

Use `EnterWorktree` if available, otherwise:

```bash
git worktree add ../<repo>-<slug> -b feat/<slug>
cd ../<repo>-<slug>
```

Branch prefix: `feat/` / `fix/` / `refactor/`. The worktree is the only place this skill writes code until merge.

---

## Step 3 — Per-Component TDD Loop

For each component, in plan order, follow `@.claude/skills/tdd/` for the red-green-refactor cycle:

**3a–3c. Red → Green → Refactor** — follow the tdd skill's vertical-slice workflow. One test at a time, minimal code to pass, refactor only when green. Consult `@.claude/skills/coding-rules/` for relevant patterns; apply HIGH-impact rules during green, MEDIUM/CONSISTENCY during refactor.

**3d. Cleanup + commit** — invoke `@.claude/skills/cleanup/` on changed files (auto-routes TS/React passes). Re-run scoped tests. Commit with conventional-commit format. One concern per commit.

---

## Step 4 — Parallel Fan-Out (optional)

Spawn sub-agents only when components are flagged parallel AND combined work is large enough (≥3 components or >~30 min serial) to outweigh orchestration cost.

**Skip parallel for**: shared files, security-sensitive code (auth/crypto/payment), UX iteration with user.

**Brief each sub-agent**: component plan row verbatim, scoped test command, type-check command, conventional-commit format, and "STOP and report if any gate fails — do not improvise around failure."

Cap at 3 concurrent. Verify each sub-agent's diff before accepting — don't trust the report. After all return, run scoped tests across the union of touched files.

---

## Step 5 — Pre-Merge Gate

On the worktree branch:

1. **Type-check** — zero errors.
2. **Full test suite** — first and only run; scoped runs miss cross-package regressions.
3. **Lint / format** — if repo has them.
4. **Manual smoke** for UI — start dev server, exercise golden path + one edge case. Type-check ≠ "it works."
5. **Diff review** — `git diff main...HEAD`, read it. Look for stray logs, debug code, commented blocks, accidental moves.

Any gate fails → fix, re-run from #1. Do not merge a partially-passing branch.

If branch has been alive >1 day, pull `main` into the worktree before re-running gates.

---

## Step 6 — Quality Review Gate

Type-check and tests prove the branch is _correct_. This gate proves it is _maintainable_ before it touches `main`. Run only after Step 5 is fully green.

1. **Run the review** — invoke `@.claude/skills/review/` (thermo-nuclear code quality review) against `git diff main...HEAD`. Apply its full standards: abstraction quality, file-size creep past 1k lines, spaghetti-condition growth, boundary/type cleanliness, and "code judo" simplifications.

2. **Summarize findings for the user** — group by severity (structural regression > missed simplification > spaghetti > boundary/type > file-size > nits). Keep it high-conviction; do not flood with cosmetic notes.

3. **Ask the user what to do** — use `AskUserQuestion`. Do not act on findings unilaterally. Offer choices such as:
   - **Apply all** — make every suggested restructuring, then loop back to Step 5.
   - **Apply selected** — user picks which findings to address; apply those, then loop back to Step 5.
   - **Merge as-is** — accept remaining findings as known debt and proceed to Step 7.
   - **Hold** — stop without merging (e.g. needs discussion or a bigger rethink).

4. **Loop on fixes** — if the user chooses to apply anything, make the changes in the worktree, re-run Step 5 (type-check + full suite), then re-run the review on the new diff. Repeat until the user clears the review.

Do not advance to merge until the user has explicitly chosen **Merge as-is** or the review comes back clean and the user confirms.

---

## Step 7 — Merge

```bash
cd <original repo>
git checkout main
git pull --ff-only origin main
git merge --no-ff feat/<slug>
git worktree remove ../<repo>-<slug>
git branch -d feat/<slug>
```

`--no-ff` preserves per-component history — that history is the value of the TDD loop.

For PR flow: push branch, `gh pr create`. Never push directly to `main` without explicit per-push authorization.

---

## Pitfalls

- **Component bloat** past ~200 LOC → split before continuing.
- **Test theater** (`expect(x).toBeDefined()` with no behavior assertion) → rewrite to pin actual behavior.
- **Flaky test on first run** → fix the flake, never "retry until green."
- **Tests pinning implementation, not behavior** → test return value or user-visible effect, not which helper got called.
- **Mocking your own modules** → tests the mocks, not the system. Mock only at boundaries (network, fs, time).
- **Cleanup suggests removing a test** → reject. The test exists for a reason.
- **Sub-agent gate failure** → stop fan-out for this feature, finish serially.
- **Silent fallbacks** → component must throw/return error when it can't do its job, never a stub value.
- **`--no-verify` or `--amend` after first commit** → never. Fix the hook cause; preserve commit history.
