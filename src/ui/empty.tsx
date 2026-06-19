import React from "react";
import { cn } from "../lib/cn";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function Empty(props: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center",
        props.className,
      )}
    >
      {props.icon ? <div className="text-[var(--lagoon-deep)]">{props.icon}</div> : null}
      <h3 className="text-base font-semibold text-[var(--sea-ink)]">{props.title}</h3>
      {props.description ? (
        <p className="max-w-md text-sm text-[var(--sea-ink-soft)]">{props.description}</p>
      ) : null}
      {props.children}
    </div>
  );
}
