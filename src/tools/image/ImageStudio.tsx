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
  CursorIcon,
  SquareIcon,
  ArrowUpRightIcon,
  MapPinIcon,
  WarningIcon,
  CropIcon,
  HandIcon,
  MinusIcon,
  PlusIcon,
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
import {
  applyOp,
  cropRect,
  extensionFor,
  OUTPUT_TYPES,
  type ImageOp,
  type OutputType,
} from "./transforms";
import { ImageDock } from "./ImageDock";

// Konva is heavy + browser-only — load the annotation canvas lazily.
const AnnotationCanvas = React.lazy(() =>
  import("../../board/visual-review/AnnotationCanvas").then((m) => ({ default: m.AnnotationCanvas })),
);

// Single viewport for the image surface (no responsive frames like visual_review).
const ANNOTATE_VIEWPORT = "desktop" as const;
const ANNOTATE_WIDTH = 820;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

type Mode = "edit" | "annotate";
type EditTool = "pan" | "crop";
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

// Canvas-first image studio: a full-screen surface whose canvas takes the page
// background (white in light, dark in dark), with a summoned floating toolbar, a
// zoom/pan viewport, a draw-a-box crop, and an always-visible comment + marks
// dock. Two modes — Edit (composable client-side transforms, including crop) and
// Annotate (box / arrow / pen / pin marks that ride back to the agent on
// request-changes).
export function ImageStudio(props: Props) {
  const task = props.task;
  const corsUrl = task.screenshotUrl ? `${task.screenshotUrl}?cors=1` : null;
  const source = useSourceImage(corsUrl);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = React.useState<Mode>("edit");
  const [editTool, setEditTool] = React.useState<EditTool>("pan");
  const [ops, setOps] = React.useState<ImageOp[]>([]);
  const [outputType, setOutputType] = React.useState<OutputType>("image/png");
  const [dims, setDims] = React.useState<{ width: number; height: number } | null>(null);

  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const resetView = React.useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const ann = useAnnotations();
  const [rawSelectedId, setRawSelectedId] = React.useState<string | null>(null);
  const selectedId = ann.marks.find((m) => m.id === rawSelectedId)?.id ?? null;
  const pinLabels = pinNumbers(ann.marks);

  const comments = useQuery(api.tasks.comments, { taskId: task._id });
  const resolve = useMutation(api.tasks.resolve);
  const reopen = useMutation(api.tasks.reopen);
  const [pending, setPending] = React.useState(false);

  // Re-render the working canvas from the source through the op chain. Each op
  // produces a fresh canvas; the last is drawn to screen.
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
  const undoLast = () => setOps((cur) => cur.slice(0, -1));

  // Convert a viewport-local rectangle (drawn over the canvas) into the working
  // canvas's pixel space, then push a crop op and recenter the view.
  const applyCrop = (local: { x0: number; y0: number; x1: number; y1: number }) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;
    const vp = viewport.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const px = canvas.width / rect.width;
    const py = canvas.height / rect.height;
    const toImg = (lx: number, ly: number) => ({
      x: (lx + vp.left - rect.left) * px,
      y: (ly + vp.top - rect.top) * py,
    });
    const a = toImg(Math.min(local.x0, local.x1), Math.min(local.y0, local.y1));
    const b = toImg(Math.max(local.x0, local.x1), Math.max(local.y0, local.y1));
    const cr = cropRect(canvas.width, canvas.height, a.x, a.y, b.x - a.x, b.y - a.y);
    if (!cr) return;
    push({ kind: "crop", ...cr });
    setEditTool("pan");
    resetView();
  };

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

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <CanvasViewport
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          source={source}
          mode={mode}
          editTool={editTool}
          zoom={zoom}
          offset={offset}
          onZoom={setZoom}
          onOffset={setOffset}
          onCrop={applyCrop}
          corsUrl={corsUrl}
          ann={ann}
          pinLabels={pinLabels}
          selectedId={selectedId}
          onSelectMark={setRawSelectedId}
          onAddMark={(m) => setRawSelectedId(ann.addMark(m))}
        />

        <AgentRequestCard instructions={task.instructions} />

        <ResolveCluster
          pending={pending}
          onApprove={() => submit("approve", "")}
          onRequest={(note) => submit("request_changes", note)}
        />

        {mode === "edit" ? <ZoomControl zoom={zoom} onZoom={setZoom} onFit={resetView} /> : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div className="pointer-events-auto">
            {mode === "edit" ? (
              <EditToolbar
                ops={ops}
                editTool={editTool}
                onSetTool={setEditTool}
                onPush={push}
                onUndo={undoLast}
                outputType={outputType}
                onOutputType={setOutputType}
                onDownload={download}
                canDownload={!!source.image}
                dims={dims}
                onAnnotate={() => setMode("annotate")}
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
        </div>
      </div>

      <ImageDock
        task={task}
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

interface ViewportProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  source: SourceState;
  mode: Mode;
  editTool: EditTool;
  zoom: number;
  offset: { x: number; y: number };
  onZoom: (next: number | ((z: number) => number)) => void;
  onOffset: (next: { x: number; y: number }) => void;
  onCrop: (local: { x0: number; y0: number; x1: number; y1: number }) => void;
  corsUrl: string | null;
  ann: ReturnType<typeof useAnnotations>;
  pinLabels: Record<string, number>;
  selectedId: string | null;
  onSelectMark: (id: string | null) => void;
  onAddMark: (mark: Parameters<ReturnType<typeof useAnnotations>["addMark"]>[0]) => void;
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function CanvasViewport(props: ViewportProps) {
  const panning = props.editTool === "pan" && props.mode === "edit";
  const cropping = props.editTool === "crop" && props.mode === "edit";
  const panRef = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const cropRef = React.useRef<{ x0: number; y0: number } | null>(null);
  const [cropDraft, setCropDraft] = React.useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const localPoint = (e: React.PointerEvent) => {
    const vp = props.viewportRef.current?.getBoundingClientRect();
    return { x: e.clientX - (vp?.left ?? 0), y: e.clientY - (vp?.top ?? 0) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (cropping) {
      const p = localPoint(e);
      cropRef.current = { x0: p.x, y0: p.y };
      setCropDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (panning) {
      panRef.current = { x: e.clientX, y: e.clientY, ox: props.offset.x, oy: props.offset.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (cropRef.current) {
      const p = localPoint(e);
      setCropDraft({ ...cropRef.current, x1: p.x, y1: p.y });
      return;
    }
    const pan = panRef.current;
    if (pan) props.onOffset({ x: pan.ox + (e.clientX - pan.x), y: pan.oy + (e.clientY - pan.y) });
  };

  const onPointerUp = () => {
    if (cropRef.current && cropDraft) {
      props.onCrop(cropDraft);
      cropRef.current = null;
      setCropDraft(null);
      return;
    }
    panRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (props.mode !== "edit") return;
    props.onZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)));
  };

  return (
    <div
      ref={props.viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      className={cn(
        "relative flex-1 overflow-hidden bg-background",
        cropping ? "cursor-crosshair" : panning ? "cursor-grab active:cursor-grabbing" : "",
      )}
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 flex items-center justify-center",
          props.mode === "annotate" && "hidden",
        )}
        style={{
          transform: `translate(calc(-50% + ${props.offset.x}px), calc(-50% + ${props.offset.y}px)) scale(${props.zoom})`,
        }}
      >
        <canvas
          ref={props.canvasRef}
          className={cn(
            "rounded shadow-lg ring-1 ring-border",
            !props.source.image && "hidden",
          )}
        />
      </div>

      {props.mode === "annotate" && props.source.image ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-auto p-8">
          <React.Suspense fallback={<LoadingArtifact />}>
            <AnnotationCanvas
              imageUrl={props.corsUrl ?? ""}
              displayWidth={ANNOTATE_WIDTH}
              viewport={ANNOTATE_VIEWPORT}
              marks={props.ann.marks}
              pinLabels={props.pinLabels}
              activeTool={props.ann.activeTool}
              selectedId={props.selectedId}
              onSelect={props.onSelectMark}
              onAddMark={props.onAddMark}
            />
          </React.Suspense>
        </div>
      ) : null}

      {cropDraft ? (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
          style={{
            left: Math.min(cropDraft.x0, cropDraft.x1),
            top: Math.min(cropDraft.y0, cropDraft.y1),
            width: Math.abs(cropDraft.x1 - cropDraft.x0),
            height: Math.abs(cropDraft.y1 - cropDraft.y0),
          }}
        />
      ) : null}

      {props.source.error ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ErrorArtifact onRetry={props.source.reload} />
        </div>
      ) : null}
      {!props.source.image && !props.source.error ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingArtifact />
        </div>
      ) : null}
    </div>
  );
}

function LoadingArtifact() {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Spinner />
      <span className="text-xs">Loading artifact…</span>
    </div>
  );
}

function ErrorArtifact(props: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-8 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <WarningIcon className="h-6 w-6" />
      </span>
      <p className="text-sm text-foreground">Couldn't load the image.</p>
      <p className="font-mono text-[11px] text-muted-foreground">cross-origin host · check the source</p>
      <button
        type="button"
        onClick={props.onRetry}
        className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
      >
        Retry
      </button>
    </div>
  );
}

function AgentRequestCard(props: { instructions: string }) {
  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[min(22rem,55%)] items-start gap-2.5 rounded-2xl border border-border bg-card/90 px-3.5 py-2.5 shadow-sm backdrop-blur">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md bg-primary text-[10px] font-extrabold text-primary-foreground">
        AI
      </span>
      <span className="line-clamp-3 text-[12.5px] leading-snug text-muted-foreground">
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
    <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={props.pending}
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-border bg-card/90 px-4 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-muted disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={props.onApprove}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {props.pending ? <Spinner /> : <CheckIcon className="h-4 w-4" />}
          Approve
        </button>
      </div>
      {open ? (
        <div className="w-72 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What should the agent change? (or rely on your marks)"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={props.pending}
              onClick={() => props.onRequest(note)}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoomControl(props: { zoom: number; onZoom: (z: number) => void; onFit: () => void }) {
  return (
    <div className="absolute bottom-5 right-4 z-20 flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 shadow-sm backdrop-blur">
      <ToolButton label="Zoom out" onClick={() => props.onZoom(clampZoom(props.zoom * 0.9))}>
        <MinusIcon className="h-4 w-4" />
      </ToolButton>
      <span className="w-12 text-center text-[11px] tabular-nums text-muted-foreground">
        {Math.round(props.zoom * 100)}%
      </span>
      <ToolButton label="Zoom in" onClick={() => props.onZoom(clampZoom(props.zoom * 1.1))}>
        <PlusIcon className="h-4 w-4" />
      </ToolButton>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        onClick={props.onFit}
        className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Fit
      </button>
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
        props.active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {props.children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px flex-none bg-border" />;
}

function Toolbar(props: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[92vw] items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur">
      {props.children}
    </div>
  );
}

function EditToolbar(props: {
  ops: ImageOp[];
  editTool: EditTool;
  onSetTool: (t: EditTool) => void;
  onPush: (op: ImageOp) => void;
  onUndo: () => void;
  outputType: OutputType;
  onOutputType: (t: OutputType) => void;
  onDownload: () => void;
  canDownload: boolean;
  dims: { width: number; height: number } | null;
  onAnnotate: () => void;
}) {
  return (
    <Toolbar>
      <ToolButton
        label="Pan"
        active={props.editTool === "pan"}
        onClick={() => props.onSetTool("pan")}
      >
        <HandIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Crop — drag a box"
        active={props.editTool === "crop"}
        onClick={() => props.onSetTool(props.editTool === "crop" ? "pan" : "crop")}
      >
        <CropIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

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
      <ToolButton label="Undo last edit" disabled={props.ops.length === 0} onClick={props.onUndo}>
        <ArrowUUpLeftIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      {props.dims ? (
        <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
          {props.dims.width}×{props.dims.height}
        </span>
      ) : null}
      <select
        value={props.outputType}
        onChange={(e) => props.onOutputType(e.target.value as OutputType)}
        aria-label="Export format"
        className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
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
        className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <PencilSimpleIcon className="h-4 w-4" />
        Annotate
      </button>
    </Toolbar>
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
    <Toolbar>
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
        <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
          {props.markCount} marks
        </span>
      ) : null}
      <button
        type="button"
        onClick={props.onDone}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
      >
        <CheckIcon className="h-4 w-4" />
        Done
      </button>
    </Toolbar>
  );
}

function ResizeField(props: { onResize: (width: number) => void }) {
  const [width, setWidth] = React.useState("");
  const value = Number(width);
  const valid = Number.isFinite(value) && value > 0;
  const apply = () => {
    if (!valid) return;
    props.onResize(value);
    setWidth("");
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
        className="h-9 w-[68px] rounded-lg border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <ToolButton label="Apply width" disabled={!valid} onClick={apply}>
        <CheckIcon className="h-4 w-4" />
      </ToolButton>
    </span>
  );
}
