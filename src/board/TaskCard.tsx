import { LockSimpleIcon } from "@phosphor-icons/react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { outcomeBadge, relativeAge } from "./format";
import { AgentChip } from "./AgentChip";
import { TaskCardMenu } from "./TaskCardMenu";
import type { AgentDirectory } from "./useAgents";
import type { TaskView } from "./types";

interface Props {
  task: TaskView;
  now: number;
  agents: AgentDirectory;
  onOpen: (taskId: TaskView["_id"]) => void;
  // Keyboard-navigation focus (ring highlight).
  focused?: boolean;
}

export function TaskCard(props: Props) {
  const task = props.task;
  const badge = task.outcome ? outcomeBadge(task.outcome) : null;
  const waitingOnYou = task.status === "open";

  return (
    <Card
      interactive
      onClick={() => props.onOpen(task._id)}
      className={props.focused ? "ring-2 ring-primary ring-offset-2 ring-offset-muted" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {task.title}
        </h4>
        <div className="mt-0.5 flex shrink-0 items-center gap-1">
          {waitingOnYou ? (
            <span className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-teal-500 dark:bg-teal-400 motion-safe:animate-pulse" />
              <span className="sr-only">Waiting on you</span>
            </span>
          ) : null}
          <TaskCardMenu taskId={task._id} taskTitle={task.title} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{task.type}</Badge>
        {task.status === "blocked" ? (
          <Badge tone="neutral">
            <LockSimpleIcon className="h-3 w-3" />
            {task.depCount > 0
              ? `${task.depCount} ${task.depCount === 1 ? "dep" : "deps"}`
              : "scheduled"}
          </Badge>
        ) : null}
        {badge ? <Badge tone={badge.tone}>{`${badge.icon} ${badge.label}`}</Badge> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {relativeAge(task.createdAt, props.now)}
        </p>
        {task.createdByTokenId ? (
          <AgentChip agent={props.agents.get(task.createdByTokenId) ?? null} now={props.now} />
        ) : null}
      </div>
    </Card>
  );
}
