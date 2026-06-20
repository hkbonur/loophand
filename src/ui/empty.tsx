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
        "flex min-w-0 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-muted px-4 py-10 text-center sm:px-6 sm:py-12",
        props.className,
      )}
    >
      {props.icon ? <div className="text-primary">{props.icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{props.title}</h3>
      {props.description ? (
        <p className="max-w-md text-sm text-muted-foreground">{props.description}</p>
      ) : null}
      {props.children}
    </div>
  );
}
