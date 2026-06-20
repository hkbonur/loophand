import React from "react";
import { pdf } from "@react-pdf/renderer";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckIcon, XIcon, DownloadSimpleIcon, WarningIcon } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Spinner } from "../../ui/spinner";
import { toast } from "../../ui/toaster";
import { treeToDocument, type DocNode } from "./treeToDocument";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ItemView = FunctionReturnType<typeof api.items.list>[number];

const PDF_TYPE = "application/pdf";

interface Props {
  taskId: Id<"tasks">;
  item: ItemView;
}

// One document in a doc_review task: render the agent's react_pdf tree to a PDF
// in the browser, show its pages, and let the human approve (storing the
// rendered PDF as the item's output) or request changes. The annotation overlay
// (reusing the visual_review canvas per page) is a follow-up — see the Phase 3
// plan; this ships render + read + verdict + artifact storage.
export function DocReview(props: Props) {
  const { taskId, item } = props;
  const tree = (item.data as { render?: { tree?: DocNode } } | null)?.render?.tree;
  const render = useRenderedPdf(tree);

  const setStatus = useMutation(api.items.setStatus);
  const startUpload = useMutation(api.files.startOutputUpload);
  const recordOutput = useMutation(api.files.recordOutput);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState<"approve" | "request_changes" | null>(null);

  const settled = item.status !== "pending";

  const approve = async () => {
    if (render.state !== "ready") return;
    setBusy("approve");
    try {
      // Store the exact bytes the human approved as the item's named output, so
      // the agent can fetch_file(task_id, item.name) later (ADR-0001).
      const { key, url } = await startUpload({ taskId, contentType: PDF_TYPE });
      const put = await fetch(url, {
        method: "PUT",
        body: render.blob,
        headers: { "Content-Type": PDF_TYPE },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      await recordOutput({
        taskId,
        name: item.name,
        r2Key: key,
        contentType: PDF_TYPE,
        size: render.blob.size,
      });
      await setStatus({ itemId: item._id, status: "approved", result: { output: item.name } });
      toast.success(`${item.name} approved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve this document.");
    } finally {
      setBusy(null);
    }
  };

  const requestChanges = async () => {
    if (!comment.trim()) {
      toast.error("Say what needs to change before requesting changes.");
      return;
    }
    setBusy("request_changes");
    try {
      await setStatus({
        itemId: item._id,
        status: "changes_requested",
        result: { comment: comment.trim() },
      });
      toast.success("Changes requested — the agent will revise and resend.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request changes.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DocSurface render={render} title={item.title ?? item.name} />

      {settled ? (
        <p className="text-sm text-muted-foreground">
          {item.status === "approved"
            ? `Approved and stored as ${item.name}.`
            : item.status === "changes_requested"
              ? "Changes requested — waiting on the agent to revise and resend."
              : "Skipped."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy !== null || render.state !== "ready"} onClick={approve}>
              {busy === "approve" ? (
                <Spinner className="text-white" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              Approve
            </Button>
            <Button variant="danger" disabled={busy !== null} onClick={requestChanges}>
              {busy === "request_changes" ? <Spinner /> : <XIcon className="h-4 w-4" />}
              Request changes
            </Button>
          </div>
          <Textarea
            value={comment}
            onChange={setComment}
            rows={2}
            placeholder="What needs to change in this document?"
          />
        </div>
      )}
    </div>
  );
}

// ── Rendering ────────────────────────────────────────────────────────────────

type RenderState =
  | { state: "rendering" }
  | { state: "error"; message: string }
  | { state: "ready"; blob: Blob; bytes: Uint8Array };

// Render the react_pdf tree to a PDF blob once, in the browser. A malformed tree
// surfaces as an error state (the fallback), never a thrown render.
function useRenderedPdf(tree: DocNode | undefined): RenderState {
  const [result, setResult] = React.useState<RenderState>({ state: "rendering" });

  React.useEffect(() => {
    let cancelled = false;
    setResult({ state: "rendering" });
    (async () => {
      try {
        if (!tree) throw new Error("This document has no render tree.");
        const blob = await pdf(treeToDocument(tree)).toBlob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!cancelled) setResult({ state: "ready", blob, bytes });
      } catch (error) {
        if (!cancelled) {
          setResult({
            state: "error",
            message: error instanceof Error ? error.message : "Could not render this document.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tree]);

  return result;
}

function DocSurface(props: { render: RenderState; title: string }) {
  const { render } = props;
  if (render.state === "rendering") {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-card">
        <Spinner />
      </div>
    );
  }
  if (render.state === "error") {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <WarningIcon className="h-6 w-6 text-destructive" />
        <p className="text-sm font-semibold text-foreground">This document couldn't be rendered</p>
        <p className="text-xs text-muted-foreground">{render.message}</p>
      </div>
    );
  }
  return <PdfPages bytes={render.bytes} blob={render.blob} title={props.title} />;
}

// ── PDF.js display ───────────────────────────────────────────────────────────

function PdfPages(props: { bytes: Uint8Array; blob: Blob; title: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pageCount, setPageCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    // A fresh copy: pdf.js transfers/detaches the buffer it's handed.
    const data = props.bytes.slice();
    (async () => {
      try {
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto mb-3 max-w-full rounded-lg border border-border shadow-sm";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError("The rendered PDF could not be displayed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.bytes]);

  const download = () => {
    const url = URL.createObjectURL(props.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = props.title.endsWith(".pdf") ? props.title : `${props.title}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {pageCount > 0 ? `${pageCount} page${pageCount > 1 ? "s" : ""}` : "Loading…"}
        </span>
        <Button variant="ghost" onClick={download}>
          <DownloadSimpleIcon className="h-4 w-4" /> Download PDF
        </Button>
      </div>
      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 p-6 text-center">
          <WarningIcon className="h-6 w-6 text-warning" />
          <p className="text-sm text-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Download the file to review it instead.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="max-h-[60vh] overflow-auto rounded-2xl border border-border bg-muted p-3"
        />
      )}
    </div>
  );
}
