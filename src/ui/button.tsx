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
  primary: "bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon)]",
  secondary:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)] hover:bg-[var(--surface-strong)]",
  ghost: "text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]",
  danger: "bg-[#c0463c] text-white hover:bg-[#a93a31]",
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
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition",
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
