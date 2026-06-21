import React from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { menuRowClass } from "./TaskCardMenu";

interface Props {
  taskTitle: string;
  onConfirm: () => void;
  deleting: boolean;
}

// Typed-confirm guard for the irreversible task delete: the human must retype the
// task title before the destructive button enables. Presentational — the
// container owns the deleteTask mutation.
export function ConfirmDeleteTask(props: Props) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const matches = typed.trim() === props.taskTitle.trim() && props.taskTitle.trim().length > 0;

  const cancel = () => {
    setOpen(false);
    setTyped("");
  };

  if (!open) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => setOpen(true)}
        className={cn(
          menuRowClass,
          "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        <TrashIcon className="h-4 w-4" />
        Delete task
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
      <p className="text-xs leading-snug text-muted-foreground">
        This permanently deletes the task and its files. Type the title to confirm.
      </p>
      <input
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={props.taskTitle}
        aria-label="Confirm task title"
        className="h-9 w-full rounded-full border border-border bg-card px-3 text-sm text-foreground focus:border-destructive focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!matches || props.deleting}
          onClick={props.onConfirm}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
