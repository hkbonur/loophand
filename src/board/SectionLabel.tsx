import type { ReactNode } from "react";

// Small uppercase field heading used inside the task dialog (Instructions,
// Acceptance criteria, agent result). Keeps the label styling in one place.
export function SectionLabel(props: { children: ReactNode }) {
  return (
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {props.children}
    </p>
  );
}
