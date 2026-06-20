import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { ApprovalPanel } from "./ApprovalPanel";
import { ResultPanel } from "./ResultPanel";
import { VisualReview } from "./visual-review/VisualReview";
import { SectionLabel } from "./SectionLabel";
import type { TaskView } from "./types";

interface Props {
  taskId: Id<"tasks">;
  onClose: () => void;
}

export function CardDialog(props: Props) {
  const task = useQuery(api.tasks.get, { taskId: props.taskId });
  const isVisualReview = task?.type === "visual_review";

  return (
    <Dialog
      open
      onClose={props.onClose}
      title={task?.title}
      className={isVisualReview ? "max-w-5xl" : undefined}
    >
      {task === undefined ? (
        <div className="flex items-center justify-center p-12">
          <Spinner />
        </div>
      ) : task === null ? (
        <div className="p-8 text-sm text-muted-foreground">This task is no longer available.</div>
      ) : isVisualReview ? (
        // Visual review needs the full width for the canvas: stack details, then the surface.
        <div className="flex flex-col gap-6 p-6">
          <TaskDetails task={task} />
          <TaskPanel task={task} onResolved={props.onClose} />
        </div>
      ) : (
        <div className="grid gap-6 p-6 sm:grid-cols-[1.2fr_1fr]">
          <TaskDetails task={task} />
          <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <TaskPanel task={task} onResolved={props.onClose} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function TaskDetails(props: { task: TaskView }) {
  const task = props.task;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{task.type}</Badge>
        {task.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>
      <h2 className="text-lg font-bold text-foreground">{task.title}</h2>
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
    </div>
  );
}

function TaskPanel(props: { task: TaskView; onResolved: () => void }) {
  const { task, onResolved } = props;
  if (task.status !== "open") return <ResultPanel task={task} />;
  if (task.type === "visual_review") return <VisualReview task={task} onResolved={onResolved} />;
  return <ApprovalPanel task={task} onResolved={onResolved} />;
}
