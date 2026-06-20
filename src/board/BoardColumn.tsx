import { cn } from "../lib/cn";
import { TaskCard } from "./TaskCard";
import type { AgentDirectory } from "./useAgents";
import type { Column, TaskView } from "./types";

interface Props {
  column: Column;
  tasks: TaskView[];
  now: number;
  agents: AgentDirectory;
  loading?: boolean;
  onOpen: (taskId: TaskView["_id"]) => void;
}

export function BoardColumn(props: Props) {
  const count = props.tasks.length;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-3xl border border-border bg-muted p-3">
      <header className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{props.column.label}</h3>
          <p className="text-xs text-muted-foreground">{props.column.hint}</p>
        </div>
        <span
          className={cn(
            "rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums",
            count === 0 ? "text-muted-foreground/50" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      </header>
      <div className="flex min-h-[4.5rem] flex-col gap-2">
        {props.loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : count === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground/70">
            Nothing here yet
          </p>
        ) : (
          props.tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              now={props.now}
              agents={props.agents}
              onOpen={props.onOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm motion-safe:animate-pulse">
      <div className="h-3.5 w-3/4 rounded-full bg-muted-foreground/15" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-4 w-12 rounded-full bg-muted-foreground/10" />
        <div className="h-4 w-10 rounded-full bg-muted-foreground/10" />
      </div>
      <div className="mt-3 h-3 w-16 rounded-full bg-muted-foreground/10" />
    </div>
  );
}
