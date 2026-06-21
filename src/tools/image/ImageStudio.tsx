import React from "react";
import { useMutation } from "convex/react";
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
  ArrowsOutIcon,
  MinusIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  ChatTextIcon,
} from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/cn";
import { Spinner } from "../../ui/spinner";
import { Textarea } from "../../ui/textarea";
import { Tooltip } from "../../ui/tooltip";
import { Select } from "../../ui/select";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../../board/types";
import type { Tool } from "../../board/visual-review/types";
import { useAnnotations, marksToAnnotations } from "../../board/visual-review/useAnnotations";
import {
  applyOp,
  containScale,
  cropRect,
  extensionFor,
  OUTPUT_TYPES,
  type ImageOp,
  type OutputType,
} from "./transforms";
import { loadDraft, saveDraft, clearDraft } from "./draft";

import type { EditableApi } from "../../board/visual-review/AnnotationCanvas";

// Konva is heavy + browser-only — load the annotation canvas lazily.
const AnnotationCanvas = React.lazy(() =>
  import("../../board/visual-review/AnnotationCanvas").then((m) => ({
    default: m.AnnotationCanvas,
  })),
);

const ANNOTATE_VIEWPORT = "desktop" as const;
const ANNOTATE_WIDTH = 820;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const MIN_HANDLE_PX = 24;
const noop = () => {};

type Mode = "edit" | "annotate";
type EditTool = "pan" | "crop" | "resize";
type Action = "approve" | "request_changes";
type Size = { width: number; height: number };
type Box = { left: number; top: number; w: number; h: number };

interface Props {
  task: TaskView;
  onResolved: () => void;
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

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

// Scale that fits the artifact inside the viewport (minus room for the floating
// chrome), upscaling small images and shrinking large ones. zoom multiplies on
// top, so zoom = 1 ("100%") always shows the artifact fit to the canvas.
function fitScale(viewport: Size, dims: Size | null): number {
  if (!dims || viewport.width === 0 || viewport.height === 0) return 1;
  return containScale(viewport.width - 80, viewport.height - 180, dims.width, dims.height);
}

// Canvas-first image studio: a theme-surface canvas (white in light, dark in
// dark) that fits the artifact to the viewport, a summoned floating toolbar, a
// zoom/pan viewport, draw-a-box crop, and drag-handle resize. Edit mode applies
// composable client-side transforms; Annotate mode draws marks whose notes are
// edited inline on the canvas (chat bubbles) and ride back to the agent on
// request-changes. The overall note attaches via the Approve / Request changes
// cluster — there's no side panel.
export function ImageStudio(props: Props) {
  const task = props.task;
  // Restore any in-progress work for this task (edits, marks, note) once, up
  // front, so closing the dialog or refreshing the browser never loses it.
  const draft = React.useMemo(() => loadDraft(task._id), [task._id]);
  const corsUrl = task.screenshotUrl ? `${task.screenshotUrl}?cors=1` : null;
  const source = useSourceImage(corsUrl);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = React.useState<Mode>("edit");
  const [editTool, setEditTool] = React.useState<EditTool>("pan");
  // Marks ride along on the edit canvas so they don't vanish when you leave
  // drawing mode — their comment bubbles stay clickable there too; this toggle
  // hides them when they're in the way.
  const [showAnnotations, setShowAnnotations] = React.useState(true);
  const [ops, setOps] = React.useState<ImageOp[]>(draft?.ops ?? []);
  // The overall note lives here (not inside the resolve cluster) so it persists
  // with the rest of the draft.
  const [note, setNote] = React.useState(draft?.note ?? "");
  const [outputType, setOutputType] = React.useState<OutputType>("image/png");
  const [dims, setDims] = React.useState<Size | null>(null);
  // The bitmap Annotate paints. Snapshotted from the working canvas on entry so
  // edits (grayscale, crop, rotate) carry into drawing mode; null falls back to
  // the untouched source.
  const [annotateSrc, setAnnotateSrc] = React.useState<string | null>(null);

  const [viewport, setViewport] = React.useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  // Live on-screen size while the resize handles are being dragged (display px,
  // centered). null = not mid-resize.
  const [resizeDraft, setResizeDraft] = React.useState<Size | null>(null);
  const resetView = React.useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Resize is done at 1:1 zoom, centered, so the live canvas size maps cleanly to
  // the drag.
  const startResize = () => {
    setEditTool("resize");
    setResizeDraft(null);
    resetView();
  };

  const ann = useAnnotations(draft?.marks);
  const [rawSelectedId, setRawSelectedId] = React.useState<string | null>(null);
  const selectedId = ann.marks.find((m) => m.id === rawSelectedId)?.id ?? null;
  const editable = React.useMemo<EditableApi>(
    () => ({
      onUpdateComment: ann.updateComment,
      onSetSeverity: ann.setSeverity,
      onRemoveMark: ann.removeMark,
    }),
    [ann.updateComment, ann.setSeverity, ann.removeMark],
  );

  const resolve = useMutation(api.tasks.resolve);
  const reopen = useMutation(api.tasks.reopen);
  const [pending, setPending] = React.useState(false);

  // Track the viewport's size so the artifact can be fit to it.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Persist the draft on every change so it survives a dialog close or refresh.
  // Only resolving (or emptying it) clears the stored copy.
  React.useEffect(() => {
    saveDraft(task._id, { ops, marks: ann.marks, note });
  }, [task._id, ops, ann.marks, note]);

  const fit = fitScale(viewport, dims);
  const push = (op: ImageOp) => setOps((cur) => [...cur, op]);
  const undoLast = () => setOps((cur) => cur.slice(0, -1));

  const resizing = editTool === "resize";
  // The artifact's on-screen size. While resizing it follows the live drag
  // (centered, 1:1 zoom); otherwise it's the fitted size times zoom.
  const onScreen: Size | null = !dims
    ? null
    : resizing && resizeDraft
      ? resizeDraft
      : { width: dims.width * fit * zoom, height: dims.height * fit * zoom };

  // The artifact's on-screen box (viewport-local), used to place the crop / resize
  // overlays and to size the canvas.
  const displayBox = (): Box | null => {
    if (!onScreen) return null;
    return {
      left: viewport.width / 2 + offset.x - onScreen.width / 2,
      top: viewport.height / 2 + offset.y - onScreen.height / 2,
      w: onScreen.width,
      h: onScreen.height,
    };
  };

  // Convert a viewport-local rectangle (drawn over the canvas) into the working
  // canvas's pixel space, then push a crop op and recenter the view.
  const applyCrop = (local: { x0: number; y0: number; x1: number; y1: number }) => {
    const box = displayBox();
    if (!box || !dims) return;
    const scale = fit * zoom;
    const toImg = (lx: number, ly: number) => ({
      x: (lx - box.left) / scale,
      y: (ly - box.top) / scale,
    });
    const a = toImg(Math.min(local.x0, local.x1), Math.min(local.y0, local.y1));
    const b = toImg(Math.max(local.x0, local.x1), Math.max(local.y0, local.y1));
    const cr = cropRect(dims.width, dims.height, a.x, a.y, b.x - a.x, b.y - a.y);
    if (!cr) return;
    push({ kind: "crop", ...cr });
    setEditTool("pan");
    resetView();
  };

  // Commit the live resize: the on-screen size (at 1:1 zoom) maps to working-canvas
  // pixels. Compensate zoom so the artifact keeps the size the human dragged it to
  // (otherwise the re-fit would snap it back and hide the change).
  const applyResize = (size: Size) => {
    const width = Math.round(size.width / fit);
    const height = Math.round(size.height / fit);
    setResizeDraft(null);
    setEditTool("pan");
    if (width < 1 || height < 1) return;
    const newFit = fitScale(viewport, { width, height });
    push({ kind: "resize", width, height });
    setOffset({ x: 0, y: 0 });
    setZoom(clampZoom(fit / newFit));
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

  // Annotate is a static-bitmap surface, so it must paint the *edited* canvas, not
  // the original source — otherwise the edits vanish the moment you switch to
  // drawing. Snapshot the working canvas (it's CORS-clean, so toDataURL is safe)
  // on the way in.
  const enterAnnotate = () => {
    const canvas = canvasRef.current;
    setAnnotateSrc(canvas ? canvas.toDataURL("image/png") : corsUrl);
    setMode("annotate");
  };

  const submit = async (action: Action) => {
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
      // The work is sent — the draft has served its purpose.
      clearDraft(task._id);
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

  const box = mode === "edit" ? displayBox() : null;
  // A marks layer floats over the working canvas while editing, so the human
  // always sees their annotations — and can reopen a comment — without
  // re-entering drawing mode. Marks live in the artifact's pixel space, so they
  // stay aligned through any edit that PRESERVES the dimensions (grayscale, flip,
  // rotate 180). A crop/resize/rotate-90 reshapes the bitmap, so we hide the
  // overlay rather than paint misplaced marks — undoing the transform brings the
  // marks right back.
  const dimsPreserved =
    !!dims &&
    !!source.image &&
    dims.width === source.image.naturalWidth &&
    dims.height === source.image.naturalHeight;
  const marksOverlayBox =
    mode === "edit" && showAnnotations && dimsPreserved && ann.marks.length > 0 ? box : null;
  // Canvas CSS size (before the group's zoom transform). While resizing, zoom is 1
  // and this is the live draft size; otherwise it's the fitted size.
  const canvasSize: Size | null = !dims
    ? null
    : resizing && resizeDraft
      ? resizeDraft
      : { width: dims.width * fit, height: dims.height * fit };

  // Annotate paints the edited bitmap on its own Konva surface. Size it from the
  // edited dimensions (a crop/resize changes them) and fit to the viewport, so
  // switching to Annotate doesn't shrink or mis-scale the artifact.
  const annotateWidth = dims ? Math.round(dims.width * fitScale(viewport, dims)) : ANNOTATE_WIDTH;

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <CanvasViewport
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          source={source}
          mode={mode}
          editTool={editTool}
          fit={fit}
          dims={dims}
          zoom={zoom}
          offset={offset}
          onZoom={setZoom}
          onOffset={setOffset}
          onCrop={applyCrop}
          box={box}
          marksOverlayBox={marksOverlayBox}
          canvasSize={canvasSize}
          onResizeLive={setResizeDraft}
          onResizeCommit={applyResize}
          corsUrl={corsUrl}
          annotateSrc={annotateSrc}
          annotateWidth={annotateWidth}
          ann={ann}
          selectedId={selectedId}
          onSelectMark={setRawSelectedId}
          onAddMark={(m) => setRawSelectedId(ann.addMark(m))}
          editable={editable}
        />

        <AgentRequestCard instructions={task.instructions} />

        <ResolveCluster
          pending={pending}
          note={note}
          onNoteChange={setNote}
          onApprove={() => submit("approve")}
          onRequest={() => submit("request_changes")}
        />

        {mode === "edit" ? (
          <ZoomControl
            zoom={zoom}
            onZoom={setZoom}
            onFit={resetView}
            label={dims ? `${dims.width}×${dims.height}` : ""}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div className="pointer-events-auto">
            {mode === "edit" ? (
              <EditToolbar
                ops={ops}
                editTool={editTool}
                onSetTool={setEditTool}
                onStartResize={startResize}
                onPush={push}
                onUndo={undoLast}
                outputType={outputType}
                onOutputType={setOutputType}
                onDownload={download}
                canDownload={!!source.image}
                onAnnotate={enterAnnotate}
                showAnnotations={showAnnotations}
                onToggleAnnotations={() => setShowAnnotations((v) => !v)}
                markCount={ann.marks.length}
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
    </div>
  );
}

interface ViewportProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  source: SourceState;
  mode: Mode;
  editTool: EditTool;
  fit: number;
  dims: Size | null;
  zoom: number;
  offset: { x: number; y: number };
  onZoom: (next: number | ((z: number) => number)) => void;
  onOffset: (next: { x: number; y: number }) => void;
  onCrop: (local: { x0: number; y0: number; x1: number; y1: number }) => void;
  box: Box | null;
  marksOverlayBox: Box | null;
  canvasSize: Size | null;
  onResizeLive: (size: Size) => void;
  onResizeCommit: (size: Size) => void;
  corsUrl: string | null;
  annotateSrc: string | null;
  annotateWidth: number;
  ann: ReturnType<typeof useAnnotations>;
  selectedId: string | null;
  onSelectMark: (id: string | null) => void;
  onAddMark: (mark: Parameters<ReturnType<typeof useAnnotations>["addMark"]>[0]) => void;
  editable: EditableApi;
}

function CanvasViewport(props: ViewportProps) {
  const panning = props.editTool === "pan" && props.mode === "edit";
  const cropping = props.editTool === "crop" && props.mode === "edit";
  const resizing = props.editTool === "resize" && props.mode === "edit";
  const panRef = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const cropRefStart = React.useRef<{ x0: number; y0: number } | null>(null);
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
      cropRefStart.current = { x0: p.x, y0: p.y };
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
    if (cropRefStart.current) {
      const p = localPoint(e);
      setCropDraft({ ...cropRefStart.current, x1: p.x, y1: p.y });
      return;
    }
    const pan = panRef.current;
    if (pan) props.onOffset({ x: pan.ox + (e.clientX - pan.x), y: pan.oy + (e.clientY - pan.y) });
  };

  const onPointerUp = () => {
    if (cropRefStart.current && cropDraft) {
      props.onCrop(cropDraft);
      cropRefStart.current = null;
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
          className={cn("rounded shadow-lg ring-1 ring-border", !props.source.image && "hidden")}
          style={
            props.canvasSize
              ? { width: props.canvasSize.width, height: props.canvasSize.height }
              : undefined
          }
        />
      </div>

      {props.mode === "annotate" && props.source.image ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-auto p-8">
          <React.Suspense fallback={<LoadingArtifact />}>
            <AnnotationCanvas
              imageUrl={props.annotateSrc ?? props.corsUrl ?? ""}
              displayWidth={props.annotateWidth}
              upscale
              viewport={ANNOTATE_VIEWPORT}
              marks={props.ann.marks}
              activeTool={props.ann.activeTool}
              selectedId={props.selectedId}
              onSelect={props.onSelectMark}
              onAddMark={props.onAddMark}
              editable={props.editable}
            />
          </React.Suspense>
        </div>
      ) : null}

      {props.marksOverlayBox ? (
        <div
          className="absolute"
          style={{
            left: props.marksOverlayBox.left,
            top: props.marksOverlayBox.top,
            width: props.marksOverlayBox.w,
            height: props.marksOverlayBox.h,
          }}
        >
          <React.Suspense fallback={null}>
            {/* Marks ride along on the working canvas in edit mode. The Konva
                stage is pass-through (interactiveCanvas=false) so pan/crop/resize
                still work over the artifact, but the comment bubbles stay live —
                you can reopen any note without re-entering Annotate. */}
            <AnnotationCanvas
              imageUrl={props.corsUrl ?? ""}
              displayWidth={props.marksOverlayBox.w}
              upscale
              hideImage
              interactiveCanvas={false}
              viewport={ANNOTATE_VIEWPORT}
              marks={props.ann.marks}
              activeTool="select"
              selectedId={props.selectedId}
              onSelect={props.onSelectMark}
              onAddMark={noop}
              editable={props.editable}
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

      {resizing && props.box ? (
        <ResizeOverlay
          box={props.box}
          fit={props.fit}
          viewportRef={props.viewportRef}
          onLive={props.onResizeLive}
          onCommit={props.onResizeCommit}
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

const HANDLES: { key: string; l: boolean; t: boolean; r: boolean; b: boolean; cursor: string }[] = [
  { key: "nw", l: true, t: true, r: false, b: false, cursor: "nwse-resize" },
  { key: "n", l: false, t: true, r: false, b: false, cursor: "ns-resize" },
  { key: "ne", l: false, t: true, r: true, b: false, cursor: "nesw-resize" },
  { key: "e", l: false, t: false, r: true, b: false, cursor: "ew-resize" },
  { key: "se", l: false, t: false, r: true, b: true, cursor: "nwse-resize" },
  { key: "s", l: false, t: false, r: false, b: true, cursor: "ns-resize" },
  { key: "sw", l: true, t: false, r: false, b: true, cursor: "nesw-resize" },
  { key: "w", l: true, t: false, r: false, b: false, cursor: "ew-resize" },
];

// Eight drag handles around the artifact. The artifact resizes LIVE as a handle
// is dragged (center-anchored, so it scales about its middle and the canvas
// tracks the box), and commits on release. `box` reflects the current live size
// (the parent feeds the draft back through it).
function ResizeOverlay(props: {
  box: Box;
  fit: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onLive: (size: Size) => void;
  onCommit: (size: Size) => void;
}) {
  const cx = props.box.left + props.box.w / 2;
  const cy = props.box.top + props.box.h / 2;
  const dragRef = React.useRef<{ handle: (typeof HANDLES)[number]; w: number; h: number } | null>(
    null,
  );

  const local = (e: React.PointerEvent) => {
    const vp = props.viewportRef.current?.getBoundingClientRect();
    return { x: e.clientX - (vp?.left ?? 0), y: e.clientY - (vp?.top ?? 0) };
  };

  const onDown = (handle: (typeof HANDLES)[number], e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { handle, w: props.box.w, h: props.box.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = local(e);
    let w = drag.w;
    let h = drag.h;
    if (drag.handle.l || drag.handle.r) w = Math.max(MIN_HANDLE_PX, 2 * Math.abs(p.x - cx));
    if (drag.handle.t || drag.handle.b) h = Math.max(MIN_HANDLE_PX, 2 * Math.abs(p.y - cy));
    drag.w = w;
    drag.h = h;
    props.onLive({ width: w, height: h });
  };

  const onUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) props.onCommit({ width: drag.w, height: drag.h });
  };

  return (
    <>
      <div
        className="pointer-events-none absolute rounded border-2 border-dashed border-primary"
        style={{
          left: props.box.left,
          top: props.box.top,
          width: props.box.w,
          height: props.box.h,
        }}
      >
        <span className="absolute -top-7 left-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
          {Math.round(props.box.w / props.fit)}×{Math.round(props.box.h / props.fit)}
        </span>
      </div>
      {HANDLES.map((handle) => (
        <button
          key={handle.key}
          type="button"
          aria-label={`Resize ${handle.key}`}
          onPointerDown={(e) => onDown(handle, e)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-card bg-primary shadow"
          style={{
            left: props.box.left + (handle.l ? 0 : handle.r ? props.box.w : props.box.w / 2),
            top: props.box.top + (handle.t ? 0 : handle.b ? props.box.h : props.box.h / 2),
            cursor: handle.cursor,
          }}
        />
      ))}
    </>
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
      <p className="font-mono text-[11px] text-muted-foreground">
        cross-origin host · check the source
      </p>
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

// The overall note to the agent is its own first-class control (Comment), not a
// step buried inside Approve. The note is written once and rides along with
// whichever decision the human lands on; per-mark notes live on the canvas, this
// is the single message about the whole artifact.
function ResolveCluster(props: {
  pending: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onApprove: () => void;
  onRequest: () => void;
}) {
  const [noteOpen, setNoteOpen] = React.useState(false);
  const hasNote = props.note.trim().length > 0;

  return (
    <div className="absolute right-16 top-4 z-20 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setNoteOpen((o) => !o)}
          aria-pressed={noteOpen}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm backdrop-blur transition",
            noteOpen || hasNote
              ? "border-primary bg-card text-foreground"
              : "border-border bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <ChatTextIcon className="h-4 w-4" />
          Comment
          {hasNote ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={props.onRequest}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-4 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-muted disabled:opacity-50"
        >
          {props.pending ? <Spinner /> : null}
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
      {noteOpen ? (
        <div className="w-72 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <Textarea
            value={props.note}
            onChange={props.onNoteChange}
            rows={3}
            autoFocus
            placeholder="A note for the agent about the whole artifact (optional)…"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Sent with whichever you choose — Approve or Request changes.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ZoomControl(props: {
  zoom: number;
  onZoom: (z: number) => void;
  onFit: () => void;
  label: string;
}) {
  return (
    <div className="absolute bottom-5 right-4 z-20 flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 shadow-sm backdrop-blur">
      {props.label ? (
        <span className="px-2 text-[11px] tabular-nums text-muted-foreground">{props.label}</span>
      ) : null}
      <span className="mx-0.5 h-5 w-px bg-border" />
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
    <Tooltip label={props.label}>
      <button
        type="button"
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
    </Tooltip>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px flex-none bg-border" />;
}

// A cluster inside the toolbar: a divider, then its controls. The buttons carry
// their own tooltips, so the group needs no caption — the divider alone reads as
// a seam between the edit tools and export.
function ToolGroup(props: { children: React.ReactNode }) {
  return (
    <>
      <Divider />
      {props.children}
    </>
  );
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
  onStartResize: () => void;
  onPush: (op: ImageOp) => void;
  onUndo: () => void;
  outputType: OutputType;
  onOutputType: (t: OutputType) => void;
  onDownload: () => void;
  canDownload: boolean;
  onAnnotate: () => void;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
  markCount: number;
}) {
  return (
    <Toolbar>
      {/* Annotation actions lead the toolbar: add a mark, or toggle the marks
          already on the artifact. Annotate is a mode switch, not the loudest
          control on the screen — Approve owns that — so it reads as a quiet
          secondary, an outlined pill rather than an ink fill. */}
      <button
        type="button"
        onClick={props.onAnnotate}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 text-xs font-semibold text-foreground transition hover:bg-muted"
      >
        <PencilSimpleIcon className="h-4 w-4" />
        Annotate
      </button>
      {props.markCount > 0 ? (
        <button
          type="button"
          onClick={props.onToggleAnnotations}
          aria-pressed={props.showAnnotations}
          title={props.showAnnotations ? "Hide annotations" : "Show annotations"}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {props.showAnnotations ? (
            <EyeSlashIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
          {props.showAnnotations ? "Hide" : "Show"}
          <span className="tabular-nums opacity-70">{props.markCount}</span>
        </button>
      ) : null}

      <ToolGroup>
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
        <ToolButton
          label="Resize — drag the handles"
          active={props.editTool === "resize"}
          onClick={props.editTool === "resize" ? () => props.onSetTool("pan") : props.onStartResize}
        >
          <ArrowsOutIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Rotate left" onClick={() => props.onPush({ kind: "rotate", deg: 270 })}>
          <ArrowCounterClockwiseIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Rotate right" onClick={() => props.onPush({ kind: "rotate", deg: 90 })}>
          <ArrowClockwiseIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Flip horizontal"
          onClick={() => props.onPush({ kind: "flip", axis: "h" })}
        >
          <FlipHorizontalIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Flip vertical" onClick={() => props.onPush({ kind: "flip", axis: "v" })}>
          <FlipVerticalIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Grayscale" onClick={() => props.onPush({ kind: "grayscale" })}>
          <CircleHalfIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Undo last edit" disabled={props.ops.length === 0} onClick={props.onUndo}>
          <ArrowUUpLeftIcon className="h-4 w-4" />
        </ToolButton>
      </ToolGroup>

      <ToolGroup>
        <Select
          label="Export format"
          value={props.outputType}
          onChange={props.onOutputType}
          options={OUTPUT_TYPES.map((t) => ({ value: t, label: extensionFor(t).toUpperCase() }))}
        />
        <ToolButton label="Download" disabled={!props.canDownload} onClick={props.onDownload}>
          <DownloadSimpleIcon className="h-4 w-4" />
        </ToolButton>
      </ToolGroup>
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
