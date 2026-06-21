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
        "rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors duration-200 ease-out",
        {
          // Flat at rest, no lift on hover — the card stays put and answers with
          // a quiet border + wash instead of rising off the board.
          "cursor-pointer hover:border-ring/50 hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40":
            interactive,
        },
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
