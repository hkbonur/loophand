import React from "react";

interface Props {
  children: React.ReactNode;
}

export function Kbd(props: Props) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
      {props.children}
    </kbd>
  );
}
