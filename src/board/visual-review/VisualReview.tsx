import React from "react";
import { useMutation } from "convex/react";
import { Check, X, Ban, MousePointer2, Square, MoveUpRight, Pencil, MapPin, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../types";
import type { Severity, Tool, Viewport } from "./types";
import { VIEWPORT_WIDTH } from "./types";
import { useAnnotations, marksToAnnotations } from "./useAnnotations";

// Konva is heavy and browser-only — load the canvas lazily and only on the client.
const AnnotationCanvas = React.lazy(() =>
  import("./AnnotationCanvas").then((m) => ({ default: m.AnnotationCanvas })),
);

type Action = "approve" | "request_changes" | "cancel";

const TOOLS: { tool: Tool; label: string; Icon: typeof Square }[] = [
  { tool: "select", label: "Select", Icon: MousePointer2 },
  { tool: "box", label: "Box", Icon: Square },
  { tool: "arrow", label: "Arrow", Icon: MoveUpRight },
  { tool: "pen", label: "Pen", Icon: Pencil },
  { tool: "pin", label: "Pin", Icon: MapPin },
];

// On-screen width for each viewport frame: mobile renders at its true 375px,
// desktop is capped so the screenshot fits the dialog.
const DISPLAY_WIDTH: Record<Viewport, number> = {
  mobile: VIEWPORT_WIDTH.mobile,
  desktop: 560,
};

interface Props {
  task: TaskView;
  onResolved: () => void;
}

export function VisualReview(props: Props) {
  const { task, onResolved } = props;
  const resolve = useMutation(api.tasks.resolve);
  const ann = useAnnotations();
  const [comment, setComment] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
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
        toast.success(RESULT_TOAST[action]);
        onResolved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not resolve the task.");
        setPending(null);
      }
    },
    [resolve, task._id, task.revision, comment, ann.marks, onResolved],
  );

  const visibleMarks = ann.marks.filter((m) => m.viewport === viewport);

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
              imageUrl={task.screenshotUrl}
              displayWidth={DISPLAY_WIDTH[viewport]}
              viewport={viewport}
              marks={ann.marks}
              activeTool={ann.activeTool}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddMark={(m) => setSelectedId(ann.addMark(m))}
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
              className={`rounded-xl border p-2 ${
                mark.id === selectedId ? "border-accent" : "border-border"
              }`}
              onClick={() => setSelectedId(mark.id)}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {mark.shape === "pin" ? `Pin ${mark.label}` : mark.shape}
                </span>
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
                  <Trash2 className="h-4 w-4" />
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
          {pending === "approve" ? <Spinner className="text-white" /> : <Check className="h-4 w-4" />}
          Approve
        </Button>
        <Button variant="secondary" disabled={pending !== null} onClick={() => submit("request_changes")}>
          {pending === "request_changes" ? <Spinner /> : <X className="h-4 w-4" />}
          Request changes
        </Button>
        <Button variant="ghost" disabled={pending !== null} onClick={() => submit("cancel")}>
          {pending === "cancel" ? <Spinner /> : <Ban className="h-4 w-4" />}
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
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        props.value === "blocker"
          ? "bg-destructive/10 text-destructive"
          : "bg-warning/10 text-warning"
      }`}
    >
      {props.value === "blocker" ? "Blocker" : "Nit"}
    </button>
  );
}
