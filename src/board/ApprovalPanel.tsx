import React from "react";
import { useMutation } from "convex/react";
import { CheckIcon, PencilSimpleIcon, ProhibitIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toaster";
import { SectionLabel } from "./SectionLabel";
import type { TaskView } from "./types";

type Action = "approve" | "request_changes" | "cancel";

interface Props {
  task: TaskView;
  onResolved: () => void;
}

export function ApprovalPanel(props: Props) {
  const resolve = useMutation(api.tasks.resolve);
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState<Action | null>(null);

  const task = props.task;
  const onResolved = props.onResolved;

  const submit = React.useCallback(
    async (action: Action) => {
      if (action === "request_changes" && !comment.trim()) {
        toast.error("Add a note so the agent knows what to change.");
        return;
      }
      setPending(action);
      try {
        await resolve({
          taskId: task._id,
          action,
          comment: comment.trim() || undefined,
          revision: task.revision,
        });
        toast.success(
          action === "approve"
            ? "Approved — sent back to the agent."
            : action === "request_changes"
              ? "Changes requested."
              : "Task cancelled.",
        );
        onResolved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not resolve the task.");
        setPending(null);
      }
    },
    [resolve, task._id, task.revision, comment, onResolved],
  );

  return (
    <div className="flex flex-col gap-4 sm:sticky sm:top-12">
      <div>
        <SectionLabel>Your decision</SectionLabel>
        <Textarea
          value={comment}
          onChange={setComment}
          rows={4}
          placeholder="Add a note for the agent (required for changes, optional otherwise)…"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending !== null} onClick={() => submit("approve")}>
          {pending === "approve" ? (
            <Spinner className="text-primary-foreground" />
          ) : (
            <CheckIcon className="h-4 w-4" />
          )}
          Approve
        </Button>
        <Button
          variant="secondary"
          disabled={pending !== null}
          onClick={() => submit("request_changes")}
        >
          {pending === "request_changes" ? <Spinner /> : <PencilSimpleIcon className="h-4 w-4" />}
          Request changes
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={pending !== null}
        onClick={() => submit("cancel")}
      >
        {pending === "cancel" ? <Spinner /> : <ProhibitIcon className="h-4 w-4" />}
        Cancel task
      </Button>
    </div>
  );
}
