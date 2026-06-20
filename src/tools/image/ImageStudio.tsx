import React from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  CircleHalfIcon,
  ArrowUUpLeftIcon,
  DownloadSimpleIcon,
  CheckIcon,
  PencilSimpleIcon,
  ChatCircleIcon,
  CursorIcon,
  SquareIcon,
  ArrowUpRightIcon,
  MapPinIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/cn";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../../board/types";
import type { Tool } from "../../board/visual-review/types";
import {
  useAnnotations,
  marksToAnnotations,
  pinNumbers,
} from "../../board/visual-review/useAnnotations";
import { applyOp, extensionFor, pipelineSteps, OUTPUT_TYPES, type ImageOp, type OutputType } from "./transforms";
import { ImageDock } from "./ImageDock";

// Konva is heavy + browser-only — load the annotation canvas lazily.
const AnnotationCanvas = React.lazy(() =>
  import("../../board/visual-review/AnnotationCanvas").then((m) => ({ default: m.AnnotationCanvas })),
);

// Single viewport for the image surface (no responsive frames like visual_review).
const ANNOTATE_VIEWPORT = "desktop" as const;
const ANNOTATE_WIDTH = 820;

type Mode = "edit" | "annotate";
type Action = "approve" | "request_changes";

interface Props {
  task: TaskView;
  onResolved: () => void;
  onOpenTask?: (taskId: Id<"tasks">) => void;
}

interface SourceState {
  image: HTMLImageElement | null;
  error: boolean;
  reload: () => void;
}

// Load the CORS-streamed proxy variant so the working canvas (and the annotation
// canvas) can read the image cross-origin without tainting / failing to load.
function useSourceImage(src: string | null): SourceState {
  const [state, setState] = React.useState<{ image: HTMLImageElement | null; error: boolean }>({
    image: null,
    error: false,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!src) {
      setState({ image: null, error: true });
      return;
    }
    setState({ image: null, error: false });
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.src = src;
    const onLoad = () => setState({ image: el, error: false });
    const onError = () => setState({ image: null, error: true });
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [src, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

// Canvas-first image studio: a near-bezel-less dark canvas with a summoned
// floating toolbar, the edit pipeline as horizontal pills, a comment + marks
// slide-over, and floating agent-request + resolve clusters. Two modes — Edit
// (composable client-side transforms on the working canvas) and Annotate (draw
// box / arrow / pen / pin marks that ride back to the agent on request-changes).
export function ImageStudio(props: Props) {
  const task = props.task;
  const corsUrl = task.screenshotUrl ? `${task.screenshotUrl}?cors=1` : null;
  const source = useSourceImage(corsUrl);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = React.useState<Mode>("edit");
  const [ops, setOps] = React.useState<ImageOp[]>([]);
  const [outputType, setOutputType] = React.useState<OutputType>("image/png");
  const [dims, setDims] = React.useState<{ width: number; height: number } | null>(null);
  const [dockOpen, setDockOpen] = React.useState(false);

  const ann = useAnnotations();
  const [rawSelectedId, setRawSelectedId] = React.useState<string | null>(null);
  const selectedId = ann.marks.find((m) => m.id === rawSelectedId)?.id ?? null;
  const pinLabels = pinNumbers(ann.marks);

  const comments = useQuery(api.tasks.comments, { taskId: task._id });
  const resolve = useMutation(api.tasks.resolve);
  const reopen = useMutation(api.tasks.reopen);
  const [pending, setPending] = React.useState(false);

  // Re-render the working canvas from the source through the op chain. Each op
  // produces a fresh canvas; the last is drawn to screen. Annotate mode can't
  // mutate ops, so the bitmap stays valid while the canvas is hidden.
  React.useEffect(() => {
    const image = source.image;
    if (!image) return;
    let cur: CanvasImageSource = image;
    let w = image.naturalWidth;
    let h = image.naturalHeight;
    for (const op of ops) {
      const next = applyOp(cur, w, h, op);
      cur = next;
      w = next.width;
      h = next.height;
    }
    const display = canvasRef.current;
    if (!display) return;
    display.width = w;
    display.height = h;
    display.getContext("2d")?.drawImage(cur, 0, 0);
    setDims({ width: w, height: h });
  }, [source.image, ops]);

  const push = (op: ImageOp) => setOps((cur) => [...cur, op]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited.${extensionFor(outputType)}`;
      a.click();
      URL.revokeObjectURL(url);
    }, outputType);
  };

  const submit = async (action: Action, note: string) => {
    const annotations = marksToAnnotations(ann.marks);
    if (action === "request_changes" && annotations.length === 0 && !note.trim()) {
      toast.error("Add a note or an annotation before requesting changes.");
      return;
    }
    setPending(true);
    try {
      await resolve({
        taskId: task._id,
        action,
        comment: note.trim() || undefined,
        revision: task.revision,
        annotations: annotations.length > 0 ? annotations : undefined,
      });
      toast.success(action === "approve" ? "Approved — sent to the agent." : "Changes requested.", {
        action: {
          label: "Undo",
          onClick: () => {
            void reopen({ taskId: task._id })
              .then(() => toast.success("Reopened."))
              .catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo."));
          },
        },
      });
      props.onResolved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resolve the task.");
      setPending(false);
    }
  };

  const enterAnnotate = () => {
    setMode("annotate");
    setDockOpen(true);
  };

  const steps = pipelineSteps(ops);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#161615] text-[#f5f5f5]">
      <div
        className="flex-1 overflow-auto"
        style={{
          backgroundColor: "#161615",
          backgroundImage: "radial-gradient(circle at 1px 1px,#2a2a28 1px,transparent 0)",
          backgroundSize: "26px 26px",
        }}
      >
        <div className="flex min-h-full items-center justify-center p-10 sm:p-16">
          <div className="relative flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className={cn(
                "max-h-[68vh] max-w-full rounded-md shadow-[0_30px_70px_-30px_rgba(0,0,0,.8)]",
                (!source.image || mode === "annotate") && "hidden",
              )}
            />
            {mode === "annotate" && source.image ? (
              <div className="overflow-auto rounded-md bg-[#161615]">
                <React.Suspense fallback={<LoadingArtifact />}>
                  <AnnotationCanvas
                    imageUrl={corsUrl ?? ""}
                    displayWidth={ANNOTATE_WIDTH}
                    viewport={ANNOTATE_VIEWPORT}
                    marks={ann.marks}
                    pinLabels={pinLabels}
                    activeTool={ann.activeTool}
                    selectedId={selectedId}
                    onSelect={setRawSelectedId}
                    onAddMark={(m) => setRawSelectedId(ann.addMark(m))}
                  />
                </React.Suspense>
              </div>
            ) : null}
            {source.error ? <ErrorArtifact onRetry={source.reload} /> : null}
            {!source.image && !source.error ? <LoadingArtifact /> : null}
          </div>
        </div>
      </div>

      <AgentRequestCard instructions={task.instructions} />

      <ResolveCluster pending={pending} onApprove={() => submit("approve", "")} onRequest={(note) => submit("request_changes", note)} />

      {mode === "edit" && ops.length > 0 ? <Pipeline steps={steps} /> : null}

      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
        {mode === "edit" ? (
          <EditToolbar
            ops={ops}
            onPush={push}
            onReset={() => setOps([])}
            outputType={outputType}
            onOutputType={setOutputType}
            onDownload={download}
            canDownload={!!source.image}
            dims={dims}
            onAnnotate={enterAnnotate}
          />
        ) : (
          <AnnotateToolbar
            activeTool={ann.activeTool}
            onTool={ann.setActiveTool}
            markCount={ann.marks.length}
            onDone={() => setMode("edit")}
          />
        )}
      </div>

      {!dockOpen ? (
        <button
          type="button"
          aria-label="Open comments and marks"
          onClick={() => setDockOpen(true)}
          className="absolute right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-[#3a3a37] bg-[#262624]/95 px-2.5 py-3 text-[#d8d8d4] transition hover:text-white"
        >
          <ChatCircleIcon className="h-4 w-4" />
          {comments && comments.length > 0 ? (
            <span className="text-[11px] font-bold">{comments.length}</span>
          ) : null}
        </button>
      ) : null}

      <ImageDock
        task={task}
        open={dockOpen}
        onClose={() => setDockOpen(false)}
        comments={comments}
        marks={ann.marks}
        pinLabels={pinLabels}
        selectedId={selectedId}
        onSelectMark={setRawSelectedId}
        onSetSeverity={ann.setSeverity}
        onUpdateMarkComment={ann.updateComment}
        onRemoveMark={ann.removeMark}
        onDeleted={props.onResolved}
        onOpenTask={props.onOpenTask}
      />
    </div>
  );
}

function LoadingArtifact() {
  return (
    <div className="flex flex-col items-center gap-3 text-[#9a9a96]">
      <Spinner className="text-[#d8d8d4]" />
      <span className="text-xs">Loading artifact…</span>
    </div>
  );
}

function ErrorArtifact(props: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#4a3535] bg-[#241c1c] px-8 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3a2626] text-destructive">
        <WarningIcon className="h-6 w-6" />
      </span>
      <p className="text-sm text-[#e6d8d8]">Couldn't load the image.</p>
      <p className="font-mono text-[11px] text-[#9a8a8a]">cross-origin host · check the source</p>
      <button
        type="button"
        onClick={props.onRetry}
        className="rounded-full border border-[#3d3d3a] bg-[#262624] px-4 py-1.5 text-xs font-semibold text-[#e6e6e2] transition hover:bg-[#2f2f2c]"
      >
        Retry
      </button>
    </div>
  );
}

function AgentRequestCard(props: { instructions: string }) {
  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[min(22rem,55%)] items-start gap-2.5 rounded-2xl border border-[#3a3a37] bg-[#262624]/90 px-3.5 py-2.5 backdrop-blur">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md bg-[#f5f5f5] text-[10px] font-extrabold text-[#161615]">
        AI
      </span>
      <span className="line-clamp-3 text-[12.5px] leading-snug text-[#d8d8d4]">
        {props.instructions}
      </span>
    </div>
  );
}

function ResolveCluster(props: {
  pending: boolean;
  onApprove: () => void;
  onRequest: (note: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <div className="absolute right-16 top-4 z-20 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={props.pending}
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-[#3a3a37] bg-[#262624]/90 px-4 py-2 text-xs font-semibold text-[#e6e6e2] transition hover:bg-[#2f2f2c] disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={props.onApprove}
          className="flex items-center gap-1.5 rounded-full bg-[#f5f5f5] px-4 py-2 text-xs font-bold text-[#161615] transition hover:bg-white disabled:opacity-50"
        >
          {props.pending ? <Spinner className="text-[#161615]" /> : <CheckIcon className="h-4 w-4" />}
          Approve
        </button>
      </div>
      {open ? (
        <div className="w-72 rounded-2xl border border-[#3a3a37] bg-[#1b1b1a] p-3 shadow-[0_16px_40px_-16px_rgba(0,0,0,.7)]">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What should the agent change? (or rely on your marks)"
            className="w-full resize-none rounded-xl border border-[#3d3d3a] bg-[#262624] px-3 py-2 text-xs text-[#e6e6e2] placeholder:text-[#6b6b66] focus:border-[#5b5b56] focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1.5 text-xs text-[#9a9a96] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={props.pending}
              onClick={() => props.onRequest(note)}
              className="rounded-full bg-[#f5f5f5] px-3 py-1.5 text-xs font-bold text-[#161615] hover:bg-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Pipeline(props: { steps: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-10 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-[#3a3a37] bg-[#1b1b1a]/90 px-3 py-1.5 backdrop-blur">
        {props.steps.map((label, i) => (
          <React.Fragment key={`${label}-${i}`}>
            {i > 0 ? <span className="text-[#55554f]">→</span> : null}
            <span
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]",
                i === props.steps.length - 1
                  ? "bg-[#f5f5f5] font-bold text-[#161615]"
                  : "bg-[#2c2c2a] text-[#d8d8d4]",
              )}
            >
              {label}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ToolButton(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-40",
        props.active ? "bg-[#f5f5f5] text-[#161615]" : "text-[#c8c8c4] hover:bg-white/10 hover:text-white",
      )}
    >
      {props.children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px flex-none bg-[#3d3d3a]" />;
}

function DarkBar(props: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#3d3d3a] bg-[#1b1b1a]/95 p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,.7)] backdrop-blur">
      {props.children}
    </div>
  );
}

function EditToolbar(props: {
  ops: ImageOp[];
  onPush: (op: ImageOp) => void;
  onReset: () => void;
  outputType: OutputType;
  onOutputType: (t: OutputType) => void;
  onDownload: () => void;
  canDownload: boolean;
  dims: { width: number; height: number } | null;
  onAnnotate: () => void;
}) {
  return (
    <DarkBar>
      <ToolButton label="Rotate left" onClick={() => props.onPush({ kind: "rotate", deg: 270 })}>
        <ArrowCounterClockwiseIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Rotate right" onClick={() => props.onPush({ kind: "rotate", deg: 90 })}>
        <ArrowClockwiseIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Flip horizontal" onClick={() => props.onPush({ kind: "flip", axis: "h" })}>
        <FlipHorizontalIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Flip vertical" onClick={() => props.onPush({ kind: "flip", axis: "v" })}>
        <FlipVerticalIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Grayscale" onClick={() => props.onPush({ kind: "grayscale" })}>
        <CircleHalfIcon className="h-4 w-4" />
      </ToolButton>
      <ResizeField onResize={(width) => props.onPush({ kind: "resize", width })} />
      <ToolButton label="Reset edits" disabled={props.ops.length === 0} onClick={props.onReset}>
        <ArrowUUpLeftIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      {props.dims ? (
        <span className="px-1 text-[11px] tabular-nums text-[#8a8a86]">
          {props.dims.width}×{props.dims.height}
        </span>
      ) : null}
      <select
        value={props.outputType}
        onChange={(e) => props.onOutputType(e.target.value as OutputType)}
        aria-label="Export format"
        className="h-9 rounded-lg border border-[#3d3d3a] bg-[#262624] px-2 text-xs text-[#e6e6e2]"
      >
        {OUTPUT_TYPES.map((t) => (
          <option key={t} value={t}>
            {extensionFor(t).toUpperCase()}
          </option>
        ))}
      </select>
      <ToolButton label="Download" disabled={!props.canDownload} onClick={props.onDownload}>
        <DownloadSimpleIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <button
        type="button"
        onClick={props.onAnnotate}
        className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#d8d8d4] transition hover:bg-white/10 hover:text-white"
      >
        <PencilSimpleIcon className="h-4 w-4" />
        Annotate
      </button>
    </DarkBar>
  );
}

const ANNOTATE_TOOLS: { tool: Tool; label: string; Icon: typeof SquareIcon }[] = [
  { tool: "select", label: "Select", Icon: CursorIcon },
  { tool: "box", label: "Box", Icon: SquareIcon },
  { tool: "arrow", label: "Arrow", Icon: ArrowUpRightIcon },
  { tool: "pen", label: "Pen", Icon: PencilSimpleIcon },
  { tool: "pin", label: "Pin", Icon: MapPinIcon },
];

function AnnotateToolbar(props: {
  activeTool: Tool;
  onTool: (tool: Tool) => void;
  markCount: number;
  onDone: () => void;
}) {
  return (
    <DarkBar>
      {ANNOTATE_TOOLS.map(({ tool, label, Icon }) => (
        <ToolButton
          key={tool}
          label={label}
          active={tool === props.activeTool}
          onClick={() => props.onTool(tool)}
        >
          <Icon className="h-4 w-4" />
        </ToolButton>
      ))}
      <Divider />
      {props.markCount > 0 ? (
        <span className="px-1 text-[11px] tabular-nums text-[#8a8a86]">{props.markCount} marks</span>
      ) : null}
      <button
        type="button"
        onClick={props.onDone}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f5f5f5] px-3 text-xs font-bold text-[#161615] transition hover:bg-white"
      >
        <CheckIcon className="h-4 w-4" />
        Done
      </button>
    </DarkBar>
  );
}

function ResizeField(props: { onResize: (width: number) => void }) {
  const [width, setWidth] = React.useState("");
  const apply = () => {
    const n = Number(width);
    if (Number.isFinite(n) && n > 0) {
      props.onResize(n);
      setWidth("");
    }
  };
  return (
    <span className="flex items-center gap-1">
      <input
        value={width}
        onChange={(e) => setWidth(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="width"
        inputMode="numeric"
        aria-label="Resize width"
        className="h-9 w-[68px] rounded-lg border border-[#3d3d3a] bg-[#262624] px-2 text-xs text-[#e6e6e2] placeholder:text-[#6b6b66] focus:border-[#5b5b56] focus:outline-none"
      />
      <ToolButton label="Apply resize" onClick={apply}>
        <CheckIcon className="h-4 w-4" />
      </ToolButton>
    </span>
  );
}
