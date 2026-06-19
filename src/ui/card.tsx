import React from "react";
import { cn } from "../lib/cn";

interface Props {
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card(props: Props) {
  return (
    <div
      onClick={props.onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-3 shadow-sm transition",
        {
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md": props.interactive,
        },
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
