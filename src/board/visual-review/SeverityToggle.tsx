import { cn } from "../../lib/cn";
import type { Severity } from "./types";

// Status badge that doubles as a toggle: click flips blocker ↔ nit. Rendered as
// a tinted pill per the design system (15% fill, 30% border, full-strength text)
// so severity reads from the label and shape, never color alone.
export function SeverityToggle(props: { value: Severity; onChange: (s: Severity) => void }) {
  const isBlocker = props.value === "blocker";
  const next: Severity = isBlocker ? "nit" : "blocker";
  return (
    <button
      type="button"
      title="Toggle severity"
      onClick={() => props.onChange(next)}
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold transition",
        isBlocker
          ? "border-destructive/30 bg-destructive/15 text-destructive"
          : "border-warning/30 bg-warning/15 text-warning",
      )}
    >
      {isBlocker ? "Blocker" : "Nit"}
    </button>
  );
}
