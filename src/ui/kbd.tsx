import React from "react";

interface Props {
  children: React.ReactNode;
}

export function Kbd(props: Props) {
  return (
    <kbd className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--sea-ink-soft)]">
      {props.children}
    </kbd>
  );
}
