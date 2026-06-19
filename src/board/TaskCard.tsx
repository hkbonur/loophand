import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { outcomeBadge, relativeAge } from "./format";
import type { TaskView } from "./types";

interface Props {
  task: TaskView;
  now: number;
  onOpen: (taskId: TaskView["_id"]) => void;
}

export function TaskCard(props: Props) {
  const task = props.task;
  const badge = task.outcome ? outcomeBadge(task.outcome) : null;
  const waitingOnYou = task.status === "open";

  return (
    <Card interactive onClick={() => props.onOpen(task._id)}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug text-foreground">{task.title}</h4>
        {waitingOnYou ? (
          <span className="mt-1 flex shrink-0 items-center">
            <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
            <span className="sr-only">Waiting on you</span>
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{task.type}</Badge>
        {badge ? <Badge tone={badge.tone}>{`${badge.icon} ${badge.label}`}</Badge> : null}
        {task.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-xs tabular-nums text-muted-foreground">
        {relativeAge(task.createdAt, props.now)}
      </p>
    </Card>
  );
}
