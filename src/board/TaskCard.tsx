import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../lib/cn";
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
        <h4 className="text-sm font-semibold leading-snug text-[var(--sea-ink)]">{task.title}</h4>
        <span
          className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", {
            "animate-pulse bg-[var(--lagoon-deep)]": waitingOnYou,
            "bg-transparent": !waitingOnYou,
          })}
          aria-hidden="true"
        />
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
      <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">
        {relativeAge(task.createdAt, props.now)}
      </p>
    </Card>
  );
}
