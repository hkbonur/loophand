import React from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props {
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border border-border bg-secondary text-secondary-foreground hover:bg-card",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button(props: Props) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold leading-none transition",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
