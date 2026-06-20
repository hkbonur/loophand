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
} from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import type { TaskView } from "../../board/types";
import { ArtifactStudio } from "../studio/ArtifactStudio";
import { applyOp, extensionFor, OUTPUT_TYPES, type ImageOp, type OutputType } from "./transforms";

interface Props {
  task: TaskView;
  onResolved: () => void;
}

function useSourceImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  React.useEffect(() => {
    if (!src) return;
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.src = src;
    const onLoad = () => setImg(el);
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [src]);
  return img;
}

// Image studio (Phase 6b ②a): apply composable client-side transforms to the
// working canvas, export (download), and resolve the task. Annotate overlay +
// return-to-agent (recordOutput) land in ②b.
export function ImageStudio(props: Props) {
  // Load the CORS-streamed proxy variant so drawing the image to the export
  // canvas doesn't taint it (the plain proxy 302-redirects to R2, which sends no
  // CORS headers).
  const source = useSourceImage(
    props.task.screenshotUrl ? `${props.task.screenshotUrl}?cors=1` : null,
  );
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [ops, setOps] = React.useState<ImageOp[]>([]);
  const [outputType, setOutputType] = React.useState<OutputType>("image/png");
  const [dims, setDims] = React.useState<{ width: number; height: number } | null>(null);

  // Re-render the working canvas from the source through the op chain whenever
  // either changes. Each op produces a fresh canvas; the last is drawn to screen.
  React.useEffect(() => {
    if (!source) return;
    let cur: CanvasImageSource = source;
    let w = source.naturalWidth;
    let h = source.naturalHeight;
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
  }, [source, ops]);

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

  return (
    <ArtifactStudio
      toolbar={
        <>
          <Button variant="ghost" onClick={() => push({ kind: "rotate", deg: 270 })}>
            <ArrowCounterClockwiseIcon className="h-4 w-4" /> Rotate L
          </Button>
          <Button variant="ghost" onClick={() => push({ kind: "rotate", deg: 90 })}>
            <ArrowClockwiseIcon className="h-4 w-4" /> Rotate R
          </Button>
          <Button variant="ghost" onClick={() => push({ kind: "flip", axis: "h" })}>
            <FlipHorizontalIcon className="h-4 w-4" /> Flip H
          </Button>
          <Button variant="ghost" onClick={() => push({ kind: "flip", axis: "v" })}>
            <FlipVerticalIcon className="h-4 w-4" /> Flip V
          </Button>
          <Button variant="ghost" onClick={() => push({ kind: "grayscale" })}>
            <CircleHalfIcon className="h-4 w-4" /> Grayscale
          </Button>
          <ResizeControl onResize={(width) => push({ kind: "resize", width })} />
          <Button variant="ghost" disabled={ops.length === 0} onClick={() => setOps([])}>
            <ArrowUUpLeftIcon className="h-4 w-4" /> Reset
          </Button>
        </>
      }
      actions={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {dims ? `${dims.width}×${dims.height}px · ${ops.length} edits` : "Loading…"}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as OutputType)}
              aria-label="Export format"
              className="h-9 rounded-full border border-border bg-muted px-3 text-xs"
            >
              {OUTPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {extensionFor(t).toUpperCase()}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={download} disabled={!source}>
              <DownloadSimpleIcon className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      }
      aside={<ResolvePanel task={props.task} onResolved={props.onResolved} />}
    >
      {source ? (
        <div className="flex justify-center p-3">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
      ) : (
        <div className="flex items-center justify-center p-12">
          <Spinner />
        </div>
      )}
    </ArtifactStudio>
  );
}

function ResizeControl(props: { onResize: (width: number) => void }) {
  const [width, setWidth] = React.useState("");
  const apply = () => {
    const n = Number(width);
    if (Number.isFinite(n) && n > 0) {
      props.onResize(n);
      setWidth("");
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={width}
        onChange={(e) => setWidth(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="width px"
        inputMode="numeric"
        className="h-9 w-24 rounded-full border border-border bg-muted px-3 text-xs"
      />
      <Button variant="ghost" onClick={apply}>
        Resize
      </Button>
    </span>
  );
}

// Approve / request changes, with an Undo toast (reuses tasks.reopen). Comment is
// optional here; the card's comment thread is the richer round-trip channel.
function ResolvePanel(props: { task: TaskView; onResolved: () => void }) {
  const resolve = useMutation(api.tasks.resolve);
  const reopen = useMutation(api.tasks.reopen);
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async (action: "approve" | "request_changes") => {
    if (action === "request_changes" && !comment.trim()) {
      toast.error("Add a note so the agent knows what to change.");
      return;
    }
    setPending(true);
    try {
      await resolve({
        taskId: props.task._id,
        action,
        comment: comment.trim() || undefined,
        revision: props.task.revision,
      });
      const taskId = props.task._id;
      toast.success(action === "approve" ? "Approved." : "Changes requested.", {
        action: {
          label: "Undo",
          onClick: () => {
            void reopen({ taskId })
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
    <div className="flex flex-col gap-2">
      <Textarea
        value={comment}
        onChange={setComment}
        rows={3}
        placeholder="Note for the agent (required for changes)…"
      />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => submit("approve")}>
          {pending ? <Spinner className="text-primary-foreground" /> : <CheckIcon className="h-4 w-4" />}
          Approve
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => submit("request_changes")}>
          <PencilSimpleIcon className="h-4 w-4" /> Request changes
        </Button>
      </div>
    </div>
  );
}
