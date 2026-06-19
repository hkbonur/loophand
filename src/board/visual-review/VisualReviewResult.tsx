import type { Annotation, VisualReviewResultData } from "./types";
import { SEVERITY_COLOR } from "./geometry";

// True when a task.result is the structured visual_review payload (vs the plain
// approval { decision, comment }).
export function isVisualReviewResult(result: unknown): result is VisualReviewResultData {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { tool?: unknown }).tool === "visual_review" &&
    Array.isArray((result as { annotations?: unknown }).annotations)
  );
}

// Read-only render of returned visual_review feedback: the screenshot plus the
// list of annotations with their severity and comment. Text-only (no canvas),
// so resolved cards don't pay the Konva bundle cost.
export function VisualReviewResult(props: {
  result: VisualReviewResultData;
  screenshotUrl: string | null;
}) {
  const { result, screenshotUrl } = props;
  return (
    <div className="flex flex-col gap-3">
      {screenshotUrl ? (
        <img
          src={screenshotUrl}
          alt="Reviewed screenshot"
          className="max-h-64 w-full rounded-2xl border border-border object-contain"
        />
      ) : null}
      {result.comment ? <p className="text-sm text-foreground">{result.comment}</p> : null}
      {result.annotations.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {result.annotations.map((annotation, i) => (
            <AnnotationRow key={i} annotation={annotation} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No annotations.</p>
      )}
    </div>
  );
}

function AnnotationRow(props: { annotation: Annotation }) {
  const { annotation } = props;
  return (
    <li className="flex items-start gap-2 rounded-xl border border-border p-2 text-sm">
      <span
        aria-hidden="true"
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: SEVERITY_COLOR[annotation.severity] }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {annotation.severity} · {annotation.viewport}
          {annotation.shape === "pin" && annotation.label ? ` · pin ${annotation.label}` : ""}
        </span>
        <span className="text-foreground">{annotation.comment || "(no comment)"}</span>
      </div>
    </li>
  );
}
