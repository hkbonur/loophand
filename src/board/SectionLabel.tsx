import type { ReactNode } from "react";

// Small uppercase field heading used inside the task dialog (Instructions,
// Acceptance criteria, agent result). Keeps the label styling in one place.
export function SectionLabel(props: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[0.69rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {props.children}
    </p>
  );
}
