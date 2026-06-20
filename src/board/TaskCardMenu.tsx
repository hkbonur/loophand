import React from "react";
import { useMutation } from "convex/react";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "../ui/toaster";
import { ConfirmDeleteTask } from "./ConfirmDeleteTask";

interface Props {
  taskId: Id<"tasks">;
  taskTitle: string;
}

// The kanban card's overflow (⋮) menu. Deletion lives here — on the board, not
// inside the review dialog — behind the typed-confirm guard. The convex-bound
// panel only mounts once opened, so the card itself needs no Convex provider.
export function TaskCardMenu(props: Props) {
  const [open, setOpen] = React.useState(false);
  const stop = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <div className="relative shrink-0" onClick={stop}>
      <button
        type="button"
        aria-label="Task actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <DotsThreeVerticalIcon className="h-4 w-4" weight="bold" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-60 rounded-2xl border border-border bg-card p-2 shadow-xl">
            <DeleteMenuItem taskId={props.taskId} taskTitle={props.taskTitle} />
          </div>
        </>
      ) : null}
    </div>
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

  return <ConfirmDeleteTask taskTitle={props.taskTitle} onConfirm={onConfirm} deleting={deleting} />;
}
