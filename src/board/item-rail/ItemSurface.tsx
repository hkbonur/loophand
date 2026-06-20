import React from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Spinner } from "../../ui/spinner";

type ItemView = FunctionReturnType<typeof api.items.list>[number];

// doc rendering pulls in @react-pdf/renderer + pdfjs (both heavy, browser-only),
// so the doc surface is split out and loaded only when a doc item is shown.
const DocReview = React.lazy(() =>
  import("../doc-review/DocReview").then((m) => ({ default: m.DocReview })),
);

// The review surface for one rail item. Surface-agnostic dispatch: a doc_review
// item renders the PDF surface; anything else falls back to a plain payload view
// (used by multi-item approval today and by future item kinds).
export function ItemSurface(props: { item: ItemView }) {
  const item = props.item;
  if (item.kind === "doc_review") {
    return (
      <React.Suspense fallback={<SurfaceSpinner />}>
        <DocReview taskId={item.taskId} item={item} />
      </React.Suspense>
    );
  }
  return <GenericSurface item={item} />;
}

function SurfaceSpinner() {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
      <Spinner />
    </div>
  );
}

function GenericSurface(props: { item: ItemView }) {
  const item = props.item;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {item.title ?? `Item ${item.order + 1}`}
      </h3>
      <pre className="max-h-64 overflow-auto font-mono text-xs text-muted-foreground">
        {JSON.stringify(item.data ?? {}, null, 2)}
      </pre>
    </div>
  );
}
