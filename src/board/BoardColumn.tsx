import { TaskCard } from "./TaskCard";
import type { Column, TaskView } from "./types";

interface Props {
  column: Column;
  tasks: TaskView[];
  now: number;
  onOpen: (taskId: TaskView["_id"]) => void;
}

export function BoardColumn(props: Props) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-3xl border border-border bg-muted p-3">
      <header className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{props.column.label}</h3>
          <p className="text-xs text-muted-foreground">{props.column.hint}</p>
        </div>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {props.tasks.length}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {props.tasks.map((task) => (
          <TaskCard key={task._id} task={task} now={props.now} onOpen={props.onOpen} />
        ))}
      </div>
    </section>
  );
}
