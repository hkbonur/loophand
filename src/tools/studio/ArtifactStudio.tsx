import React from "react";

interface Props {
  // Medium-specific controls (image transforms, PDF ops, HTML edit), shown above
  // the artifact.
  toolbar?: React.ReactNode;
  // The artifact preview + its annotate overlay.
  children: React.ReactNode;
  // Marks list + comment thread, beside the artifact on wide screens.
  aside?: React.ReactNode;
  // Resolution / export controls (approve, request changes, export output).
  actions?: React.ReactNode;
}

// Shared shell for every creative tool surface (image / PDF / HTML). One layout —
// toolbar over the artifact, the annotate-overlay'd preview as the focus, and an
// aside for marks + comments — so every medium gets the same draw-and-comment
// affordances and the per-medium part is only the toolbar + preview content.
export function ArtifactStudio(props: Props) {
  return (
    <div className="flex flex-col gap-4">
      {props.toolbar ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tools">
          {props.toolbar}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-auto rounded-2xl border border-border bg-card">
          {props.children}
        </div>
        {props.aside ? <div className="flex flex-col gap-3">{props.aside}</div> : null}
      </div>

      {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
    </div>
  );
}
