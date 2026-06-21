import React from "react";
import { LockSimpleIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { TaskCard } from "./TaskCard";
import type { TaskView } from "./types";

interface Props {
  tasks: TaskView[];
  onOpen: (taskId: TaskView["_id"]) => void;
}

// Collapsed lane for blocked cards (waiting on deps or a future not_before). It
// auto-hides when nothing is blocked and empties itself as deps resolve and the
// cards move into the queue.
export function BlockedLane(props: Props) {
  const [open, setOpen] = React.useState(false);
  if (props.tasks.length === 0) return null;

  return (
    <section className="mb-4 rounded-3xl border border-border bg-muted/50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <CaretRightIcon
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <LockSimpleIcon className="h-4 w-4 text-muted-foreground" />
        Blocked
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {props.tasks.length}
        </span>
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-4">
          {props.tasks.map((task) => (
            <TaskCard key={task._id} task={task} onOpen={props.onOpen} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
