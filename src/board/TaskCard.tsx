import { Card } from "../ui/card";
import { cardStatus } from "./format";
import { StatusPill } from "./StatusPill";
import { TaskCardMenu } from "./TaskCardMenu";
import type { TaskView } from "./types";

interface Props {
  task: TaskView;
  onOpen: (taskId: TaskView["_id"]) => void;
  // Keyboard-navigation focus (ring highlight).
  focused?: boolean;
}

export function TaskCard(props: Props) {
  const task = props.task;
  const status = cardStatus(task);

  return (
    <Card
      interactive
      onClick={() => props.onOpen(task._id)}
      className={props.focused ? "ring-2 ring-primary ring-offset-2 ring-offset-muted" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={status} />
        <TaskCardMenu taskId={task._id} taskTitle={task.title} status={task.status} />
      </div>

      <h4 className="mt-3 line-clamp-2 text-base font-bold leading-tight tracking-[-0.01em] text-foreground">
        {task.title}
      </h4>

      <p className="mt-4 truncate text-[0.69rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {task.type.replace(/_/g, " ")} task
      </p>
    </Card>
  );
}
