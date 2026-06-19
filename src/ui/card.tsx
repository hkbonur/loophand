import React from "react";
import { cn } from "../lib/cn";

interface Props {
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card(props: Props) {
  const interactive = props.interactive;
  return (
    <div
      onClick={props.onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-2xl border border-border bg-card p-3 shadow-sm transition duration-200 ease-out",
        {
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0":
            interactive,
        },
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
