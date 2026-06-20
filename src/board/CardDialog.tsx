import React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog } from "../ui/dialog";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toaster";
import { ApprovalPanel } from "./ApprovalPanel";
import { ResultPanel } from "./ResultPanel";
import { VisualReview } from "./visual-review/VisualReview";
import { MultiItemReview } from "./item-rail/MultiItemReview";
import { SectionLabel } from "./SectionLabel";
import { staleNotice } from "./staleNotice";
import { AgentChip } from "./AgentChip";
import { DepMiniView } from "./DepMiniView";
import { CommentsSection } from "./comments/CommentsSection";
import { ConfirmDeleteTask } from "./ConfirmDeleteTask";
import { useAgents } from "./useAgents";
import type { TaskView } from "./types";

interface Props {
  taskId: Id<"tasks">;
  onClose: () => void;
  // Navigate the dialog to a dependency neighbour.
  onOpenTask?: (taskId: Id<"tasks">) => void;
}

export function CardDialog(props: Props) {
  const task = useQuery(api.tasks.get, { taskId: props.taskId });
  // Surfaces that need the full dialog width: the annotation canvas and the
  // multi-item rail.
  const isWide = !!task && (task.type === "visual_review" || task.itemCount !== null);

  // Remember the status the card had when it was opened, so we can tell a task
  // that went stale under the dialog (expired / agent-cancelled) from one the
  // human is simply reopening after the fact.
  const firstStatus = React.useRef<TaskView["status"] | null>(null);
  if (task && firstStatus.current === null) firstStatus.current = task.status;
  const stale = task && firstStatus.current ? staleNotice(firstStatus.current, task) : null;

  return (
    <Dialog open onClose={props.onClose} title={task?.title} size="full">
      {task === undefined ? (
        <div className="flex flex-1 items-center justify-center p-12">
          <Spinner />
        </div>
      ) : task === null ? (
        <div className="p-8 text-sm text-muted-foreground">This task is no longer available.</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {stale ? <StaleBanner message={stale} /> : null}
          {isWide ? (
            // Wide surfaces stack details on top, then the full-width surface.
            // Extra top padding on desktop clears the corner close button.
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-6 sm:pt-12">
              <TaskDetails task={task} onOpenTask={props.onOpenTask} onClose={props.onClose} />
              <TaskPanel task={task} onResolved={props.onClose} />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 pb-6 pt-6 sm:pt-12 sm:grid-cols-[1.2fr_1fr]">
              <TaskDetails task={task} onOpenTask={props.onOpenTask} onClose={props.onClose} />
              <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                <TaskPanel task={task} onResolved={props.onClose} />
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function StaleBanner(props: { message: string }) {
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-3 text-sm text-warning">
      {props.message}
    </div>
  );
}

function TaskDetails(props: {
  task: TaskView;
  onOpenTask?: (taskId: Id<"tasks">) => void;
  onClose: () => void;
}) {
  const task = props.task;
  const agents = useAgents();
  const deps = useQuery(api.deps.forTask, { taskId: task._id });
  const now = Date.now();
  // undefined = no attribution recorded (hide the row); null = the token is gone
  // (show "Unknown agent").
  const creator = task.createdByTokenId ? (agents.get(task.createdByTokenId) ?? null) : undefined;
  const resumer = task.resumedByTokenId ? (agents.get(task.resumedByTokenId) ?? null) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="island-kicker mb-1.5">{task.type.replace(/_/g, " ")}</p>
        <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
          {task.title}
        </h2>
      </div>
      {creator !== undefined || resumer !== undefined ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {creator !== undefined ? (
            <AgentChip agent={creator} now={now} caption="raised by" />
          ) : null}
          {task.status === "resumed" && resumer !== undefined ? (
            <AgentChip agent={resumer} now={now} caption="resumed by" />
          ) : null}
        </div>
      ) : null}
      <div>
        <SectionLabel>Instructions</SectionLabel>
        <p className="whitespace-pre-wrap text-sm text-foreground">{task.instructions}</p>
      </div>
      {task.acceptanceCriteria ? (
        <div>
          <SectionLabel>Acceptance criteria</SectionLabel>
          <p className="whitespace-pre-wrap text-sm text-foreground">{task.acceptanceCriteria}</p>
        </div>
      ) : null}
      {deps ? (
        <DepMiniView blockedBy={deps.blockedBy} blocks={deps.blocks} onOpen={props.onOpenTask} />
      ) : null}
      <TaskComments taskId={task._id} />
      <div className="mt-1 border-t border-border pt-4">
        <DeleteTaskAction taskId={task._id} taskTitle={task.title} onDeleted={props.onClose} />
      </div>
    </div>
  );
}

// Container: owns the deleteTask mutation; the typed-confirm UX lives in
// ConfirmDeleteTask. Closes the dialog once the task is gone.
function DeleteTaskAction(props: {
  taskId: Id<"tasks">;
  taskTitle: string;
  onDeleted: () => void;
}) {
  const deleteTask = useMutation(api.tasks.deleteTask);
  const [deleting, setDeleting] = React.useState(false);

  const onConfirm = async () => {
    setDeleting(true);
    try {
      await deleteTask({ taskId: props.taskId });
      props.onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the task.");
      setDeleting(false);
    }
  };

  return (
    <ConfirmDeleteTask taskTitle={props.taskTitle} onConfirm={onConfirm} deleting={deleting} />
  );
}

// Container: owns the comments query + addComment mutation, hands the rest to the
// presentational CommentsSection.
function TaskComments(props: { taskId: Id<"tasks"> }) {
  const comments = useQuery(api.tasks.comments, { taskId: props.taskId });
  const addComment = useMutation(api.tasks.addComment);
  const [submitting, setSubmitting] = React.useState(false);

  const onAdd = async (body: string) => {
    setSubmitting(true);
    try {
      await addComment({ taskId: props.taskId, body });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the comment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (comments === undefined) return null;
  return (
    <CommentsSection
      comments={comments}
      onAdd={onAdd}
      submitting={submitting}
      now={Date.now()}
    />
  );
}

function TaskPanel(props: { task: TaskView; onResolved: () => void }) {
  const { task, onResolved } = props;
  // A multi-item task lives in the rail across rounds while it stays open
  // (ADR-0002); only once it completes does it fall through to the result.
  if (task.itemCount !== null && task.status !== "done") {
    return <MultiItemReview task={task} onResolved={onResolved} />;
  }
  if (task.status !== "open") return <ResultPanel task={task} />;
  if (task.type === "visual_review") return <VisualReview task={task} onResolved={onResolved} />;
  return <ApprovalPanel task={task} onResolved={onResolved} />;
}
