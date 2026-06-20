import React from "react";
import { useMutation } from "convex/react";
import { CheckIcon, XIcon, ProhibitIcon, CursorIcon, SquareIcon, ArrowUpRightIcon, PencilIcon, MapPinIcon, TrashIcon } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../types";
import type { Severity, Tool, Viewport } from "./types";
import { useAnnotations, marksToAnnotations, pinNumbers } from "./useAnnotations";

// Konva is heavy and browser-only — load the canvas lazily and only on the client.
const AnnotationCanvas = React.lazy(() =>
  import("./AnnotationCanvas").then((m) => ({ default: m.AnnotationCanvas })),
);

type Action = "approve" | "request_changes" | "cancel";

const TOOLS: { tool: Tool; label: string; Icon: typeof SquareIcon }[] = [
  { tool: "select", label: "Select", Icon: CursorIcon },
  { tool: "box", label: "Box", Icon: SquareIcon },
  { tool: "arrow", label: "Arrow", Icon: ArrowUpRightIcon },
  { tool: "pen", label: "Pen", Icon: PencilIcon },
  { tool: "pin", label: "Pin", Icon: MapPinIcon },
];

// On-screen width for each viewport frame: mobile renders at its true 375px,
// desktop is capped so the screenshot fits the dialog.
const DISPLAY_WIDTH: Record<Viewport, number> = {
  mobile: 375,
  desktop: 560,
};

interface Props {
  task: TaskView;
  onResolved: () => void;
}

export function VisualReview(props: Props) {
  const task = props.task;
  const onResolved = props.onResolved;
  const resolve = useMutation(api.tasks.resolve);
  const reopen = useMutation(api.tasks.reopen);
  const ann = useAnnotations();
  const [comment, setComment] = React.useState("");
  const [rawSelectedId, setRawSelectedId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Action | null>(null);

  const viewports = viewportsOf(task);
  const [viewport, setViewport] = React.useState<Viewport>(viewports[0]);

  const submit = React.useCallback(
    async (action: Action) => {
      const annotations = marksToAnnotations(ann.marks);
      if (action === "request_changes" && annotations.length === 0 && !comment.trim()) {
        toast.error("Add an annotation or a note before requesting changes.");
        return;
      }
      setPending(action);
      try {
        await resolve({
          taskId: task._id,
          action,
          comment: comment.trim() || undefined,
          revision: task.revision,
          annotations: annotations.length > 0 ? annotations : undefined,
        });
        const undoable = action !== "cancel";
        toast.success(
          RESULT_TOAST[action],
          undoable
            ? {
                action: {
                  label: "Undo",
                  onClick: () => {
                    void reopen({ taskId: task._id })
                      .then(() => toast.success("Reopened."))
                      .catch((error) =>
                        toast.error(error instanceof Error ? error.message : "Could not undo."),
                      );
                  },
                },
              }
            : undefined,
        );
        onResolved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not resolve the task.");
        setPending(null);
      }
    },
    [resolve, reopen, task._id, task.revision, comment, ann.marks, onResolved],
  );

  const visibleMarks = ann.marks.filter((m) => m.viewport === viewport);
  const pinLabels = pinNumbers(ann.marks);
  // Effective selection: a mark counts as selected only while it's visible in
  // the current viewport, so a deleted or off-viewport id can't linger.
  const selectedId = visibleMarks.find((m) => m.id === rawSelectedId)?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      {viewports.length > 1 ? (
        <div className="flex gap-1.5" role="group" aria-label="Viewport">
          {viewports.map((vp) => (
            <Button
              key={vp}
              variant={vp === viewport ? "primary" : "ghost"}
              onClick={() => setViewport(vp)}
            >
              {vp === "mobile" ? "Mobile" : "Desktop"}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Annotation tools">
        {TOOLS.map(({ tool, label, Icon }) => (
          <Button
            key={tool}
            variant={tool === ann.activeTool ? "primary" : "ghost"}
            aria-pressed={tool === ann.activeTool}
            onClick={() => ann.setActiveTool(tool)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      {task.screenshotUrl ? (
        <div className="overflow-auto rounded-2xl border border-border bg-card">
          <React.Suspense fallback={<div className="p-8 text-center"><Spinner /></div>}>
            <AnnotationCanvas
              imageUrl={`${task.screenshotUrl}?cors=1`}
              displayWidth={DISPLAY_WIDTH[viewport]}
              viewport={viewport}
              marks={ann.marks}
              pinLabels={pinLabels}
              activeTool={ann.activeTool}
              selectedId={selectedId}
              onSelect={setRawSelectedId}
              onAddMark={(m) => setRawSelectedId(ann.addMark(m))}
            />
          </React.Suspense>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This task has no screenshot to review.</p>
      )}

      {visibleMarks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleMarks.map((mark) => (
            <li
              key={mark.id}
              className={cn(
                "rounded-xl border p-2",
                mark.id === selectedId ? "border-accent" : "border-border",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRawSelectedId(mark.id)}
                  className="text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
                >
                  {mark.shape === "pin" ? `Pin ${pinLabels[mark.id]}` : mark.shape}
                </button>
                <SeverityToggle
                  value={mark.severity}
                  onChange={(s) => ann.setSeverity(mark.id, s)}
                />
                <button
                  type="button"
                  aria-label="Delete annotation"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => ann.removeMark(mark.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={mark.comment}
                onChange={(v) => ann.updateComment(mark.id, v)}
                rows={2}
                placeholder="What needs to change here?"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Textarea
        value={comment}
        onChange={setComment}
        rows={3}
        placeholder="Overall note for the agent (optional)…"
      />

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending !== null} onClick={() => submit("approve")}>
          {pending === "approve" ? <Spinner className="text-white" /> : <CheckIcon className="h-4 w-4" />}
          Approve
        </Button>
        <Button variant="secondary" disabled={pending !== null} onClick={() => submit("request_changes")}>
          {pending === "request_changes" ? <Spinner /> : <XIcon className="h-4 w-4" />}
          Request changes
        </Button>
        <Button variant="ghost" disabled={pending !== null} onClick={() => submit("cancel")}>
          {pending === "cancel" ? <Spinner /> : <ProhibitIcon className="h-4 w-4" />}
          Cancel
        </Button>
      </div>
    </div>
  );
}

const RESULT_TOAST: Record<Action, string> = {
  approve: "Approved — sent back to the agent.",
  request_changes: "Changes requested with your annotations.",
  cancel: "Task cancelled.",
};

function viewportsOf(task: TaskView): Viewport[] {
  const viewports = task.toolPayload?.viewports;
  return viewports && viewports.length > 0 ? viewports : ["desktop"];
}

function SeverityToggle(props: { value: Severity; onChange: (s: Severity) => void }) {
  const next: Severity = props.value === "blocker" ? "nit" : "blocker";
  return (
    <button
      type="button"
      onClick={() => props.onChange(next)}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        props.value === "blocker" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
      )}
    >
      {props.value === "blocker" ? "Blocker" : "Nit"}
    </button>
  );
}
