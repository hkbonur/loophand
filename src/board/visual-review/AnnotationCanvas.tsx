import React from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Arrow, Line, Circle, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Mark, Tool, Viewport } from "./types";
import {
  fitScale,
  displayToImage,
  buildPoints,
  flattenPen,
  isClick,
  SEVERITY_COLOR,
  type Point,
} from "./geometry";
import type { NewMark } from "./useAnnotations";

interface Props {
  imageUrl: string;
  /** Width to render the screenshot at (the viewport frame); height follows the aspect ratio. */
  displayWidth: number;
  viewport: Viewport;
  marks: Mark[];
  /** Derived pin display numbers, keyed by mark id. */
  pinLabels: Record<string, number>;
  activeTool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddMark: (mark: NewMark) => void;
}

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
// draw box / arrow / freehand-pen / numbered-pin marks over it. Geometry is
// stored in the image's natural pixel space (the Layer is scaled to fit), so
// marks stay correct at any display size. Reused later for PDF + image studio.
export function AnnotationCanvas(props: Props) {
  const image = useHtmlImage(props.imageUrl);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  if (!image) {
    return <div style={{ width: props.displayWidth, height: props.displayWidth * 0.6 }} />;
  }

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const scale = fitScale(naturalWidth, props.displayWidth);
  const stageWidth = naturalWidth * scale;
  const stageHeight = naturalHeight * scale;
  const stroke = 2 / scale; // keep a constant on-screen width under the scaled Layer
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
      props.onAddMark({ shape: "pin", points: buildPoints("pin", pt, pt), viewport: props.viewport });
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
        <KonvaImage image={image} width={naturalWidth} height={naturalHeight} listening={false} />
        {visible.map((mark) => (
          <MarkShape
            key={mark.id}
            mark={mark}
            label={props.pinLabels[mark.id]}
            stroke={stroke}
            selected={mark.id === props.selectedId}
            onSelect={() => tool === "select" && props.onSelect(mark.id)}
          />
        ))}
        {draft ? <DraftShape draft={draft} stroke={stroke} /> : null}
      </Layer>
    </Stage>
  );
}

function MarkShape(props: {
  mark: Mark;
  label?: number;
  stroke: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { mark, stroke, selected } = props;
  const color = SEVERITY_COLOR[mark.severity];
  const dash = selected ? [stroke * 3, stroke * 2] : undefined;
  const common = { stroke: color, strokeWidth: stroke, onClick: props.onSelect, onTap: props.onSelect };

  switch (mark.shape) {
    case "box": {
      const [x, y, w, h] = mark.points;
      return <Rect {...common} x={x} y={y} width={w} height={h} dash={dash} />;
    }
    case "arrow":
      return <Arrow {...common} points={mark.points} fill={color} pointerLength={stroke * 4} pointerWidth={stroke * 4} />;
    case "pen":
      // No tension: render the exact recorded polyline so the painted stroke
      // matches both the stored points and the live draft (which has none).
      return <Line {...common} points={mark.points} lineCap="round" lineJoin="round" />;
    case "pin": {
      const [x, y] = mark.points;
      const r = stroke * 6;
      return (
        <>
          <Circle {...common} x={x} y={y} radius={r} fill={color} stroke={selected ? "#fff" : color} />
          <Text
            x={x - r}
            y={y - r / 1.5}
            width={r * 2}
            align="center"
            text={String(props.label ?? "")}
            fill="#fff"
            fontSize={r}
            fontStyle="bold"
            listening={false}
          />
        </>
      );
    }
  }
}

function DraftShape(props: { draft: Draft; stroke: number }) {
  const { draft, stroke } = props;
  const color = SEVERITY_COLOR.blocker;
  if (draft.kind === "pen") {
    return <Line points={flattenPen(draft.path)} stroke={color} strokeWidth={stroke} lineCap="round" lineJoin="round" />;
  }
  const points = buildPoints(draft.kind, draft.start, draft.end);
  if (draft.kind === "box") {
    const [x, y, w, h] = points;
    return <Rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={stroke} dash={[stroke * 2, stroke * 2]} />;
  }
  return <Arrow points={points} stroke={color} fill={color} strokeWidth={stroke} pointerLength={stroke * 4} pointerWidth={stroke * 4} />;
}
