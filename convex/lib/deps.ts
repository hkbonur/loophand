import type { Doc } from "../_generated/dataModel";

// Dependency lifecycle rules for the task DAG (Phase 5). A task with deps starts
// `blocked` and is released by unblockDependents / unblockCheck once every dep is
// `approved` and its notBefore has passed. A terminally-failed dep fails the
// dependent (dependency_failed). `changes_requested` is NOT a failure — the
// agent reworks it, the dependent stays blocked until it flips to approved.

type DepOutcome = Pick<Doc<"tasks">, "outcome">;

export function isTerminalFailure(task: DepOutcome): boolean {
  return (
    task.outcome === "cancelled" ||
    task.outcome === "expired" ||
    task.outcome === "dependency_failed"
  );
}

export function isApprovedDep(task: DepOutcome): boolean {
  return task.outcome === "approved";
}

// The lifecycle state a new task is born into, given its already-validated deps.
export type InitialState =
  | { status: "done"; outcome: "dependency_failed" }
  | { status: "blocked" }
  | { status: "open" };

export function initialTaskState(
  deps: DepOutcome[],
  notBefore: number | undefined,
  now: number,
): InitialState {
  if (deps.some(isTerminalFailure)) return { status: "done", outcome: "dependency_failed" };
  if (!canUnblock(deps, notBefore, now)) return { status: "blocked" };
  return { status: "open" };
}

// Whether a blocked task may flip to open. Re-evaluated from freshly-read deps in
// the unblock transaction — never from a counter (the crux race fix: two deps
// finishing at once must not leave a dependent stuck blocked).
export function canUnblock(deps: DepOutcome[], notBefore: number | undefined, now: number): boolean {
  if (deps.some(isTerminalFailure)) return false;
  if (notBefore !== undefined && notBefore > now) return false;
  return deps.every(isApprovedDep);
}
