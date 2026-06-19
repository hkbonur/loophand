import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { ApprovalPanel } from "./ApprovalPanel";
import { ResultPanel } from "./ResultPanel";
import { SectionLabel } from "./SectionLabel";

interface Props {
  taskId: Id<"tasks">;
  onClose: () => void;
}

export function CardDialog(props: Props) {
  const task = useQuery(api.tasks.get, { taskId: props.taskId });

  return (
    <Dialog open onClose={props.onClose} title={task?.title}>
      {task === undefined ? (
        <div className="flex items-center justify-center p-12">
          <Spinner />
        </div>
      ) : task === null ? (
        <div className="p-8 text-sm text-muted-foreground">
          This task is no longer available.
        </div>
      ) : (
        <div className="grid gap-6 p-6 sm:grid-cols-[1.2fr_1fr]">
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
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {task.instructions}
              </p>
            </div>
            {task.acceptanceCriteria ? (
              <div>
                <SectionLabel>Acceptance criteria</SectionLabel>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {task.acceptanceCriteria}
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            {task.status === "open" ? (
              <ApprovalPanel task={task} onResolved={props.onClose} />
            ) : (
              <ResultPanel task={task} />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
