import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { ApprovalPanel } from "./ApprovalPanel";
import { ResultPanel } from "./ResultPanel";
import { VisualReview } from "./visual-review/VisualReview";
import { MultiItemReview } from "./item-rail/MultiItemReview";
import { SectionLabel } from "./SectionLabel";
import type { TaskView } from "./types";

interface Props {
  taskId: Id<"tasks">;
  onClose: () => void;
}

export function CardDialog(props: Props) {
  const task = useQuery(api.tasks.get, { taskId: props.taskId });
  // Surfaces that need the full dialog width: the annotation canvas and the
  // multi-item rail.
  const isWide = !!task && (task.type === "visual_review" || task.itemCount !== null);

  return (
    <Dialog
      open
      onClose={props.onClose}
      title={task?.title}
      className={isWide ? "max-w-5xl" : undefined}
    >
      {task === undefined ? (
        <div className="flex items-center justify-center p-12">
          <Spinner />
        </div>
      ) : task === null ? (
        <div className="p-8 text-sm text-muted-foreground">This task is no longer available.</div>
      ) : isWide ? (
        // Wide surfaces stack details on top, then the full-width review surface.
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
  // A multi-item task lives in the rail across rounds while it stays open
  // (ADR-0002); only once it completes does it fall through to the result.
  if (task.itemCount !== null && task.status !== "done") {
    return <MultiItemReview task={task} onResolved={onResolved} />;
  }
  if (task.status !== "open") return <ResultPanel task={task} />;
  if (task.type === "visual_review") return <VisualReview task={task} onResolved={onResolved} />;
  return <ApprovalPanel task={task} onResolved={onResolved} />;
}
