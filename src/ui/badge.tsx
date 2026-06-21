import React from "react";
import { cn } from "../lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

interface Props {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

// Tinted-pill palette per the design system: 15% fill, 30% border, full-strength
// text. Exported so other status surfaces (e.g. the card StatusPill) share it.
export const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/15 text-primary border-primary/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
};

export function Badge(props: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        BADGE_TONE[props.tone ?? "neutral"],
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}
