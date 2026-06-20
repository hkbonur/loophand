import React from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckIcon, XIcon, MinusIcon } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../types";
import { ItemRail } from "./ItemRail";
import type { ItemStatus, RailItem } from "./types";
import { ItemSurface } from "./ItemSurface";

type ItemView = FunctionReturnType<typeof api.items.list>[number];
type Verdict = "approved" | "changes_requested" | "skipped";

// A locally staged decision on a still-pending item. Held in the client until
// "Submit batch" writes them all through items.setStatus, so the human reviews
// the whole batch before any of it lands (and the task can't half-complete
// mid-review). Items the agent has reopened come back as `pending` and re-enter
// staging; already-settled items from earlier rounds are read-only.
interface Staged {
  status: Verdict;
  comment: string;
}

interface Props {
  task: TaskView;
  onResolved: () => void;
}

export function MultiItemReview(props: Props) {
  const { task } = props;
  const items = useQuery(api.items.list, { taskId: task._id });
  const setStatus = useMutation(api.items.setStatus);
  const [staged, setStaged] = React.useState<Record<number, Staged>>({});
  const [selected, setSelected] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  if (items === undefined) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  const stageVerdict = (order: number, status: Verdict) =>
    setStaged((prev) => ({ ...prev, [order]: { status, comment: prev[order]?.comment ?? "" } }));
  const stageComment = (order: number, comment: string) =>
    setStaged((prev) => ({
      ...prev,
      [order]: { status: prev[order]?.status ?? "changes_requested", comment },
    }));

  // The rail shows the settled backend verdict, or the human's staged choice for
  // a pending item.
  const railItems: RailItem[] = items.map((item) => ({
    order: item.order,
    title: item.title,
    status: effectiveStatus(item, staged[item.order]),
  }));
  const itemCount = items.length;
  const itemsDone = railItems.filter((i) => i.status !== "pending").length;

  const pending = items.filter((i) => i.status === "pending");
  const applyToAll = () =>
    setStaged((prev) => {
      const next = { ...prev };
      for (const item of pending) {
        next[item.order] = { status: "approved", comment: next[item.order]?.comment ?? "" };
      }
      return next;
    });

  const submit = async () => {
    const writes = pending
      .map((item) => ({ item, decision: staged[item.order] }))
      .filter((w): w is { item: ItemView; decision: Staged } => w.decision !== undefined);
    if (writes.length === 0) {
      toast.error("Decide on the remaining items first.");
      return;
    }
    setSubmitting(true);
    try {
      // Concurrent writes are safe: each setStatus recomputes itemsDone under
      // OCC retry (ADR-0002). The last write to land may flip the task to done.
      await Promise.all(
        writes.map(({ item, decision }) =>
          setStatus({
            itemId: item._id,
            status: decision.status,
            result: decision.comment.trim() ? { comment: decision.comment.trim() } : undefined,
          }),
        ),
      );
      setStaged({});
      toast.success("Batch submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit the batch.");
    } finally {
      setSubmitting(false);
    }
  };

  const current = items.find((i) => i.order === selected) ?? items[0];

  // doc_review items own their verdict (Approve uploads the rendered PDF as the
  // item's output), so they act live — no client-side staging or batch submit.
  // Other item kinds stage their verdicts and submit the batch together.
  const ownsVerdict = current.kind === "doc_review";

  return (
    <div className="flex flex-col gap-4">
      <ItemSurface item={current} />
      {ownsVerdict ? null : current.status === "pending" ? (
        <VerdictControls
          value={staged[current.order]}
          onVerdict={(v) => stageVerdict(current.order, v)}
          onComment={(c) => stageComment(current.order, c)}
        />
      ) : (
        <SettledNote status={current.status} />
      )}
      <ItemRail
        items={railItems}
        selectedOrder={current.order}
        onSelect={setSelected}
        itemsDone={itemsDone}
        itemCount={itemCount}
        onApplyToAll={ownsVerdict || pending.length === 0 ? undefined : applyToAll}
        onSubmit={ownsVerdict ? undefined : submit}
        submitting={submitting}
      />
    </div>
  );
}

function effectiveStatus(item: ItemView, staged: Staged | undefined): ItemStatus {
  if (item.status !== "pending") return item.status;
  return staged?.status ?? "pending";
}

function VerdictControls(props: {
  value: Staged | undefined;
  onVerdict: (v: Verdict) => void;
  onComment: (c: string) => void;
}) {
  const active = props.value?.status;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={active === "approved" ? "primary" : "ghost"}
          onClick={() => props.onVerdict("approved")}
        >
          <CheckIcon className="h-4 w-4" /> Approve
        </Button>
        <Button
          variant={active === "changes_requested" ? "danger" : "ghost"}
          onClick={() => props.onVerdict("changes_requested")}
        >
          <XIcon className="h-4 w-4" /> Request changes
        </Button>
        <Button
          variant={active === "skipped" ? "secondary" : "ghost"}
          onClick={() => props.onVerdict("skipped")}
        >
          <MinusIcon className="h-4 w-4" /> Skip
        </Button>
      </div>
      {active === "changes_requested" ? (
        <Textarea
          value={props.value?.comment ?? ""}
          onChange={props.onComment}
          rows={2}
          placeholder="What needs to change on this item?"
        />
      ) : null}
    </div>
  );
}

function SettledNote(props: { status: ItemStatus }) {
  const label =
    props.status === "approved"
      ? "Approved — waiting on the other items or the agent."
      : props.status === "changes_requested"
        ? "Changes requested — the agent will revise and resend this item."
        : "Skipped.";
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
