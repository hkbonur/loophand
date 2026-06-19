import React from "react";
import { cn } from "../lib/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

interface Props {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-[var(--surface)] text-[var(--sea-ink-soft)] border-[var(--line)]",
  info: "bg-[rgba(79,184,178,0.16)] text-[var(--lagoon-deep)] border-[rgba(50,143,151,0.3)]",
  success: "bg-[rgba(47,106,74,0.14)] text-[var(--palm)] border-[rgba(47,106,74,0.28)]",
  warning: "bg-[rgba(214,158,46,0.16)] text-[#9a6b12] border-[rgba(214,158,46,0.32)]",
  danger: "bg-[rgba(192,70,60,0.14)] text-[#a93a31] border-[rgba(192,70,60,0.3)]",
};

export function Badge(props: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[props.tone ?? "neutral"],
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}
