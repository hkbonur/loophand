import React from "react";
import { useMutation, useQuery } from "convex/react";
import { TrashIcon } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/cn";
import { Textarea } from "../../ui/textarea";
import { toast } from "../../ui/toaster";
import { SectionLabel } from "../../board/SectionLabel";
import { CommentsSection, type BoardComment } from "../../board/comments/CommentsSection";
import { DepMiniView } from "../../board/DepMiniView";
import type { TaskView } from "../../board/types";
import type { Mark, Severity } from "../../board/visual-review/types";

interface Props {
  task: TaskView;
  comments: BoardComment[] | undefined;
  marks: Mark[];
  pinLabels: Record<string, number>;
  selectedId: string | null;
  onSelectMark: (id: string) => void;
  onSetSeverity: (id: string, severity: Severity) => void;
  onUpdateMarkComment: (id: string, comment: string) => void;
  onRemoveMark: (id: string) => void;
  onOpenTask?: (taskId: Id<"tasks">) => void;
}

// Always-visible panel down the canvas's right edge: the comment thread with the
// agent, the marks the human has drawn (severity + per-mark note), and the task's
// details (acceptance criteria, dependencies). A theme-surface column beside the
// canvas — the same skin the PDF / HTML studios use.
export function ImageDock(props: Props) {
  return (
    <aside className="flex w-full flex-none flex-col border-l border-border bg-card sm:w-[360px]">
      <header className="flex h-14 flex-none items-center border-b border-border px-4 pr-12">
        <h2 className="text-sm font-bold text-foreground">Comments &amp; marks</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {props.marks.length > 0 ? (
          <MarksList
            marks={props.marks}
            pinLabels={props.pinLabels}
            selectedId={props.selectedId}
            onSelectMark={props.onSelectMark}
            onSetSeverity={props.onSetSeverity}
            onUpdateMarkComment={props.onUpdateMarkComment}
            onRemoveMark={props.onRemoveMark}
          />
        ) : null}

        <DockComments taskId={props.task._id} comments={props.comments} />

        <TaskDetails task={props.task} onOpenTask={props.onOpenTask} />
      </div>
    </aside>
  );
}

function MarksList(props: {
  marks: Mark[];
  pinLabels: Record<string, number>;
  selectedId: string | null;
  onSelectMark: (id: string) => void;
  onSetSeverity: (id: string, severity: Severity) => void;
  onUpdateMarkComment: (id: string, comment: string) => void;
  onRemoveMark: (id: string) => void;
}) {
  return (
    <div>
      <SectionLabel>Marks</SectionLabel>
      <ul className="flex flex-col gap-2">
        {props.marks.map((mark) => (
          <li
            key={mark.id}
            className={cn(
              "rounded-xl border p-2",
              mark.id === props.selectedId ? "border-accent" : "border-border",
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => props.onSelectMark(mark.id)}
                className="text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
              >
                {mark.shape === "pin" ? `Pin ${props.pinLabels[mark.id]}` : mark.shape}
              </button>
              <SeverityToggle
                value={mark.severity}
                onChange={(s) => props.onSetSeverity(mark.id, s)}
              />
              <button
                type="button"
                aria-label="Delete mark"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => props.onRemoveMark(mark.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={mark.comment}
              onChange={(v) => props.onUpdateMarkComment(mark.id, v)}
              rows={2}
              placeholder="What needs to change here?"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeverityToggle(props: { value: Severity; onChange: (s: Severity) => void }) {
  const next: Severity = props.value === "blocker" ? "nit" : "blocker";
  return (
    <button
      type="button"
      onClick={() => props.onChange(next)}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        props.value === "blocker"
          ? "bg-destructive/10 text-destructive"
          : "bg-warning/10 text-warning",
      )}
    >
      {props.value === "blocker" ? "Blocker" : "Nit"}
    </button>
  );
}

// Owns the addComment mutation; the thread itself is queried once at the studio
// root (it also drives the dock-tab badge) and passed in.
function DockComments(props: { taskId: Id<"tasks">; comments: BoardComment[] | undefined }) {
  const addComment = useMutation(api.tasks.addComment);
  const [submitting, setSubmitting] = React.useState(false);

  const onAdd = async (body: string) => {
    setSubmitting(true);
    try {
      await addComment({ taskId: props.taskId, body });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the comment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (props.comments === undefined) return null;
  return (
    <CommentsSection comments={props.comments} onAdd={onAdd} submitting={submitting} now={Date.now()} />
  );
}

// Acceptance criteria + dependency edges. Deletion lives on the board card's ⋮
// menu, not in the review dialog. Renders nothing when there's nothing to show.
function TaskDetails(props: { task: TaskView; onOpenTask?: (taskId: Id<"tasks">) => void }) {
  const deps = useQuery(api.deps.forTask, { taskId: props.task._id });
  const hasDeps = !!deps && (deps.blockedBy.length > 0 || deps.blocks.length > 0);
  if (!props.task.acceptanceCriteria && !hasDeps) return null;
  return (
    <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
      {props.task.acceptanceCriteria ? (
        <div>
          <SectionLabel>Acceptance criteria</SectionLabel>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {props.task.acceptanceCriteria}
          </p>
        </div>
      ) : null}
      {hasDeps ? (
        <DepMiniView blockedBy={deps.blockedBy} blocks={deps.blocks} onOpen={props.onOpenTask} />
      ) : null}
    </div>
  );
}
