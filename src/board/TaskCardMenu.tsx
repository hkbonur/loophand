import React from "react";
import { useMutation } from "convex/react";
import { DotsThreeVerticalIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/cn";
import { toast } from "../ui/toaster";
import { ConfirmDeleteTask } from "./ConfirmDeleteTask";
import type { TaskStatus } from "./types";

interface Props {
  taskId: Id<"tasks">;
  taskTitle: string;
  status: TaskStatus;
}

// Shared row shape for every menu entry, so neutral and destructive actions line
// up to the same height, padding, and icon gutter.
export const menuRowClass =
  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition";

// The kanban card's overflow (⋮) menu. Card-level actions that don't belong in
// the review dialog live here: move the card back to the Queue, and the
// typed-confirm delete. The Convex-bound rows only mount once opened, so the
// card itself needs no Convex provider.
export function TaskCardMenu(props: Props) {
  const [open, setOpen] = React.useState(false);
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  // Offer "move back" only from a later column. Already-queued has nowhere to go;
  // a blocked card is gated on its dependencies, not on the human.
  const canRequeue = props.status !== "open" && props.status !== "blocked";

  return (
    <div className="relative shrink-0" onClick={stop}>
      <button
        type="button"
        aria-label="Task actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "-mr-1.5 -mt-1.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition",
          open ? "bg-muted text-foreground" : "hover:bg-muted hover:text-foreground",
        )}
      >
        <DotsThreeVerticalIcon className="h-4 w-4" weight="bold" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <MenuPanel>
            {canRequeue ? (
              <>
                <RequeueMenuItem taskId={props.taskId} onDone={() => setOpen(false)} />
                <span className="mx-1 my-1 h-px bg-border" />
              </>
            ) : null}
            <DeleteMenuItem taskId={props.taskId} taskTitle={props.taskTitle} />
          </MenuPanel>
        </>
      ) : null}
    </div>
  );
}

// The floating panel, with a quiet scale + fade entrance (transform/opacity only,
// flattened under reduced motion). Mounts when the menu opens.
function MenuPanel(props: { children: React.ReactNode }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="menu"
      className={cn(
        "absolute right-0 top-8 z-20 flex w-60 origin-top-right flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-xl",
        "transition duration-150 ease-out motion-reduce:transition-none",
        shown ? "scale-100 opacity-100" : "scale-95 opacity-0",
      )}
    >
      {props.children}
    </div>
  );
}

// Sends the task back to the Queue (status → open). The card hops to the Queue
// column on success via the live board query, so there's nothing to update here
// beyond closing the menu.
function RequeueMenuItem(props: { taskId: Id<"tasks">; onDone: () => void }) {
  const requeue = useMutation(api.tasks.requeue);
  const [pending, setPending] = React.useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      await requeue({ taskId: props.taskId });
      toast.success("Moved back to the Queue.");
      props.onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move the task.");
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={pending}
      onClick={onClick}
      className={cn(menuRowClass, "text-foreground hover:bg-muted disabled:opacity-50")}
    >
      <ArrowCounterClockwiseIcon className="h-4 w-4 text-muted-foreground" />
      Move to Queue
    </button>
  );
}

// Owns the deleteTask mutation; mounted only while the menu is open. The card
// vanishes from the board query when the task is gone, so there's nothing to do
// on success.
function DeleteMenuItem(props: { taskId: Id<"tasks">; taskTitle: string }) {
  const deleteTask = useMutation(api.tasks.deleteTask);
  const [deleting, setDeleting] = React.useState(false);

  const onConfirm = async () => {
    setDeleting(true);
    try {
      await deleteTask({ taskId: props.taskId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the task.");
      setDeleting(false);
    }
  };

  return (
    <ConfirmDeleteTask taskTitle={props.taskTitle} onConfirm={onConfirm} deleting={deleting} />
  );
}
