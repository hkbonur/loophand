import React from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Arrow, Line, Circle, Group } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { ChatCircleIcon, TrashIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import { Textarea } from "../../ui/textarea";
import { SeverityToggle } from "./SeverityToggle";
import type { Mark, Severity, Tool, Viewport } from "./types";
import {
  fitScale,
  displayToImage,
  buildPoints,
  flattenPen,
  isClick,
  markAnchor,
  markBounds,
  SEVERITY_COLOR,
  type Point,
} from "./geometry";
import type { NewMark } from "./useAnnotations";

// When present, marks become editable in place: each carries an on-canvas chat
// bubble that opens a comment popover (the image studio's inline-feedback model,
// replacing a side panel).
export interface EditableApi {
  onUpdateComment: (id: string, comment: string) => void;
  onSetSeverity: (id: string, severity: Severity) => void;
  onRemoveMark: (id: string) => void;
}

interface Props {
  imageUrl: string;
  /** Width to render the screenshot at (the viewport frame); height follows the aspect ratio. */
  displayWidth: number;
  /** Allow rendering larger than 1:1 to fill displayWidth (the image studio fits small artifacts). */
  upscale?: boolean;
  viewport: Viewport;
  marks: Mark[];
  activeTool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddMark: (mark: NewMark) => void;
  /** Opt-in inline comment editing (chat bubbles + popover). */
  editable?: EditableApi;
  /**
   * Paint the marks over a transparent stage instead of the image. Lets the
   * studio float a marks layer on top of its own working canvas, so annotations
   * stay visible outside of drawing mode.
   */
  hideImage?: boolean;
  /**
   * When false, the Konva stage stops capturing pointer events so the surface
   * underneath (the studio's pan/crop/resize) stays usable — but the DOM comment
   * bubbles remain clickable, so a reader can still open a mark's note. Defaults
   * to true (the stage owns its pointers, for drawing).
   */
  interactiveCanvas?: boolean;
}

// Casing under-stroke: a crisp white outline (no blur) sits beneath the colored
// stroke so a mark reads on light, dark, or same-hue artifacts. Duotone by
// construction — white skeleton, saturated core.
const CASING = "#ffffff";
const CASING_OPACITY = 0.95;

// Load an <img> for Konva to paint. Konva needs a real HTMLImageElement, so we
// can't lean on React's <img>.
function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  React.useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    const onLoad = () => setImage(img);
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [src]);
  return image;
}

type Draft = { kind: "box" | "arrow"; start: Point; end: Point } | { kind: "pen"; path: Point[] };

// Surface-agnostic annotation surface: paints a raster image and lets the human
// draw box / arrow / freehand-pen / pin marks over it. Geometry is
// stored in the image's natural pixel space (the Layer is scaled to fit), so
// marks stay correct at any display size. Reused by the dialog review + image studio.
export function AnnotationCanvas(props: Props) {
  const image = useHtmlImage(props.imageUrl);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  if (!image) {
    return <div style={{ width: props.displayWidth, height: props.displayWidth * 0.6 }} />;
  }

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const scale = props.upscale
    ? props.displayWidth / naturalWidth
    : fitScale(naturalWidth, props.displayWidth);
  const stageWidth = naturalWidth * scale;
  const stageHeight = naturalHeight * scale;
  const stroke = 3.25 / scale; // keep a constant on-screen width under the scaled Layer
  const tool = props.activeTool;
  const visible = props.marks.filter((m) => m.viewport === props.viewport);

  type PointerEvent = KonvaEventObject<MouseEvent | TouchEvent>;

  function pointerImageCoords(e: PointerEvent): Point | null {
    const pos = e.target.getStage()?.getPointerPosition();
    return pos ? displayToImage(pos, scale) : null;
  }

  function onDown(e: PointerEvent) {
    const pt = pointerImageCoords(e);
    if (!pt) return;
    if (tool === "select") {
      // a click that wasn't caught by a mark (i.e. the stage itself) deselects
      if (e.target === e.target.getStage()) props.onSelect(null);
      return;
    }
    if (tool === "pin") {
      props.onAddMark({
        shape: "pin",
        points: buildPoints("pin", pt, pt),
        viewport: props.viewport,
      });
      return;
    }
    if (tool === "pen") setDraft({ kind: "pen", path: [pt] });
    else setDraft({ kind: tool, start: pt, end: pt });
  }

  function onMove(e: PointerEvent) {
    if (!draft) return;
    const pt = pointerImageCoords(e);
    if (!pt) return;
    setDraft((d) =>
      d?.kind === "pen" ? { kind: "pen", path: [...d.path, pt] } : d ? { ...d, end: pt } : d,
    );
  }

  function onUp() {
    if (!draft) return;
    if (draft.kind === "pen") {
      if (draft.path.length > 1) {
        props.onAddMark({ shape: "pen", points: flattenPen(draft.path), viewport: props.viewport });
      }
    } else if (!isClick(draft.start, draft.end)) {
      props.onAddMark({
        shape: draft.kind,
        points: buildPoints(draft.kind, draft.start, draft.end),
        viewport: props.viewport,
      });
    }
    setDraft(null);
  }

  return (
    <div
      className={cn("relative", props.interactiveCanvas === false && "pointer-events-none")}
      style={{ width: stageWidth, height: stageHeight }}
    >
      <Stage
        width={stageWidth}
        height={stageHeight}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
      >
        <Layer scaleX={scale} scaleY={scale}>
          {props.hideImage ? null : (
            <KonvaImage
              image={image}
              width={naturalWidth}
              height={naturalHeight}
              listening={false}
            />
          )}
          {visible.map((mark) => (
            <MarkShape
              key={mark.id}
              mark={mark}
              stroke={stroke}
              selected={mark.id === props.selectedId}
              onSelect={() => tool === "select" && props.onSelect(mark.id)}
            />
          ))}
          {draft ? <DraftShape draft={draft} stroke={stroke} /> : null}
        </Layer>
      </Stage>

      {props.editable ? (
        <MarkOverlay
          marks={visible}
          scale={scale}
          hitAreas={props.interactiveCanvas === false}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
          editable={props.editable}
        />
      ) : null}
    </div>
  );
}

function MarkShape(props: { mark: Mark; stroke: number; selected: boolean; onSelect: () => void }) {
  const { mark, stroke, selected } = props;
  const color = SEVERITY_COLOR[mark.severity];
  const casing = stroke * 2.3;
  const dash = selected ? [stroke * 3, stroke * 2] : undefined;
  const cased = { stroke: CASING, strokeWidth: casing, opacity: CASING_OPACITY, listening: false };
  const head = stroke * 4;
  const hit = { onClick: props.onSelect, onTap: props.onSelect };

  switch (mark.shape) {
    case "box": {
      const [x, y, w, h] = mark.points;
      return (
        <Group {...hit}>
          <Rect {...cased} x={x} y={y} width={w} height={h} cornerRadius={stroke} />
          <Rect
            x={x}
            y={y}
            width={w}
            height={h}
            stroke={color}
            strokeWidth={stroke}
            fill={`${color}1a`}
            cornerRadius={stroke}
            dash={dash}
          />
        </Group>
      );
    }
    case "arrow":
      return (
        <Group {...hit}>
          <Arrow
            {...cased}
            fill={CASING}
            points={mark.points}
            pointerLength={head}
            pointerWidth={head}
          />
          <Arrow
            points={mark.points}
            stroke={color}
            fill={color}
            strokeWidth={stroke}
            pointerLength={head}
            pointerWidth={head}
            lineCap="round"
          />
        </Group>
      );
    case "pen":
      // No tension: render the exact recorded polyline so the painted stroke
      // matches both the stored points and the live draft (which has none).
      return (
        <Group {...hit}>
          <Line {...cased} points={mark.points} lineCap="round" lineJoin="round" />
          <Line
            points={mark.points}
            stroke={color}
            strokeWidth={stroke}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      );
    case "pin": {
      // A clean location dot: no number, no glyph. Identity comes from the
      // comment bubble anchored to it, not a count painted on the marker.
      const [x, y] = mark.points;
      const r = stroke * 4;
      return (
        <Group {...hit}>
          <Circle x={x} y={y} radius={r + casing / 2} fill={CASING} opacity={CASING_OPACITY} />
          <Circle
            x={x}
            y={y}
            radius={r}
            fill={color}
            stroke={selected ? CASING : undefined}
            strokeWidth={selected ? stroke : 0}
          />
        </Group>
      );
    }
  }
}

function DraftShape(props: { draft: Draft; stroke: number }) {
  const { draft, stroke } = props;
  const color = SEVERITY_COLOR.blocker;
  const casing = stroke * 2.3;
  const cased = { stroke: CASING, strokeWidth: casing, opacity: CASING_OPACITY, listening: false };
  const head = stroke * 4;
  if (draft.kind === "pen") {
    const points = flattenPen(draft.path);
    return (
      <>
        <Line {...cased} points={points} lineCap="round" lineJoin="round" />
        <Line
          points={points}
          stroke={color}
          strokeWidth={stroke}
          lineCap="round"
          lineJoin="round"
        />
      </>
    );
  }
  const points = buildPoints(draft.kind, draft.start, draft.end);
  if (draft.kind === "box") {
    const [x, y, w, h] = points;
    return (
      <>
        <Rect {...cased} x={x} y={y} width={w} height={h} cornerRadius={stroke} />
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={color}
          strokeWidth={stroke}
          dash={[stroke * 2, stroke * 2]}
          cornerRadius={stroke}
        />
      </>
    );
  }
  return (
    <>
      <Arrow {...cased} fill={CASING} points={points} pointerLength={head} pointerWidth={head} />
      <Arrow
        points={points}
        stroke={color}
        fill={color}
        strokeWidth={stroke}
        pointerLength={head}
        pointerWidth={head}
        lineCap="round"
      />
    </>
  );
}

// DOM overlay sitting exactly over the scaled Konva stage: a comment bubble per
// mark plus, for the selected one, an inline editor popover. A transparent
// backdrop closes the editor on an outside click. When `hitAreas` is set (edit
// mode, where the Konva canvas is pass-through), each mark also gets a clickable
// rectangle so the whole marker opens its comment, not only the bubble.
function MarkOverlay(props: {
  marks: Mark[];
  scale: number;
  hitAreas?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editable: EditableApi;
}) {
  const { selectedId, onSelect } = props;
  const selected = props.marks.find((m) => m.id === selectedId) ?? null;

  React.useEffect(() => {
    if (!selectedId) return;
    // Escape dismisses the open comment, and only that — capture the key first and
    // stop it so the surrounding dialog doesn't also close out from under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onSelect(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedId, onSelect]);

  return (
    <>
      {selected ? (
        <button
          type="button"
          aria-label="Close comment"
          className="pointer-events-auto absolute inset-0 z-10 cursor-default"
          onClick={() => onSelect(null)}
        />
      ) : null}

      {props.hitAreas
        ? props.marks.map((mark) => (
            <MarkHitArea
              key={`hit-${mark.id}`}
              bounds={markBounds(mark.shape, mark.points)}
              scale={props.scale}
              onClick={() => onSelect(mark.id === selectedId ? null : mark.id)}
            />
          ))
        : null}

      {props.marks.map((mark) => {
        const a = markAnchor(mark.shape, mark.points);
        return (
          <MarkBubble
            key={mark.id}
            mark={mark}
            x={a.x * props.scale}
            y={a.y * props.scale}
            active={mark.id === selectedId}
            onClick={() => onSelect(mark.id === selectedId ? null : mark.id)}
          />
        );
      })}

      {selected ? (
        <MarkEditor
          key={selected.id}
          mark={selected}
          x={markAnchor(selected.shape, selected.points).x * props.scale}
          y={markAnchor(selected.shape, selected.points).y * props.scale}
          editable={props.editable}
          onClose={() => onSelect(null)}
        />
      ) : null}
    </>
  );
}

// A transparent click target over a mark's bounds. A click opens the comment; a
// drag bubbles up to the viewport's pan/crop handler (this sits inside it), so
// the marker is reachable in edit mode without stealing the pan gesture. Grown to
// a minimum so thin marks (a flat arrow, a small pin) stay easy to hit.
const MIN_HIT = 22;
function MarkHitArea(props: {
  bounds: { x: number; y: number; w: number; h: number };
  scale: number;
  onClick: () => void;
}) {
  const w = Math.max(props.bounds.w * props.scale, MIN_HIT);
  const h = Math.max(props.bounds.h * props.scale, MIN_HIT);
  const cx = (props.bounds.x + props.bounds.w / 2) * props.scale;
  const cy = (props.bounds.y + props.bounds.h / 2) * props.scale;
  return (
    <button
      type="button"
      aria-label="Open comment"
      onClick={props.onClick}
      className="pointer-events-auto absolute z-10 cursor-pointer rounded-sm"
      style={{ left: cx - w / 2, top: cy - h / 2, width: w, height: h }}
    />
  );
}

function MarkBubble(props: {
  mark: Mark;
  x: number;
  y: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = SEVERITY_COLOR[props.mark.severity];
  const note = props.mark.comment.trim();
  const filled = note.length > 0;
  // Clicking the chat icon opens the comment for reading and editing, in edit mode
  // or annotate mode alike — no need to be drawing to touch a note.
  return (
    <button
      type="button"
      aria-label={filled ? `Edit comment: ${note}` : "Add comment"}
      onClick={props.onClick}
      className={cn(
        "pointer-events-auto absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-sm transition",
        props.active ? "scale-110" : "hover:scale-110",
      )}
      style={{
        left: props.x,
        top: props.y,
        borderColor: color,
        backgroundColor: filled ? color : "#ffffff",
      }}
    >
      <ChatCircleIcon
        weight={filled ? "fill" : "bold"}
        className="h-3.5 w-3.5"
        style={{ color: filled ? "#ffffff" : color }}
      />
    </button>
  );
}

// The inline comment box for one mark. The textarea writes live to the mark, so
// nothing is lost if the box is dismissed by clicking away. The three explicit
// actions below it make the outcome unambiguous: Save keeps the note, Discard
// reverts to the value it opened with (and drops the mark if it never had one),
// Delete removes the mark entirely. `key={mark.id}` remounts this per mark, so
// the opened-with snapshot re-captures each time.
function MarkEditor(props: {
  mark: Mark;
  x: number;
  y: number;
  editable: EditableApi;
  onClose: () => void;
}) {
  const { mark, editable } = props;
  const opened = React.useRef(mark.comment);

  const discard = () => {
    if (opened.current.trim() === "") editable.onRemoveMark(mark.id);
    else editable.onUpdateComment(mark.id, opened.current);
    props.onClose();
  };
  const remove = () => {
    editable.onRemoveMark(mark.id);
    props.onClose();
  };
  // ⌘/Ctrl+Enter saves from the textarea without reaching for the mouse.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") props.onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute z-30 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl motion-safe:animate-[editor-pop_160ms_cubic-bezier(0.22,1,0.36,1)]"
      style={{ left: props.x + 14, top: props.y + 14, transformOrigin: "top left" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {/* Severity leads the box: it sets the mark's color on the canvas and tells
          the agent whether this blocks or is a nit. */}
      <div className="mb-2 flex items-center justify-between">
        <SeverityToggle
          value={mark.severity}
          onChange={(s) => editable.onSetSeverity(mark.id, s)}
        />
        <button
          type="button"
          onClick={remove}
          aria-label="Delete annotation"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
      <Textarea
        value={mark.comment}
        onChange={(v) => editable.onUpdateComment(mark.id, v)}
        rows={3}
        autoFocus
        placeholder="What needs to change here?"
      />
      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={discard}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
