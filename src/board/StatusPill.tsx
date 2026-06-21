import { LockSimpleIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { BADGE_TONE } from "../ui/badge";
import type { CardStatus } from "./format";

// The card's headline state: an uppercase tinted pill that leads with a live
// dot (waiting on you), a lock (blocked), or an outcome glyph. The label always
// carries the state in words, so it never rests on color alone.
export function StatusPill(props: { status: CardStatus }) {
  const { label, tone, lead } = props.status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1",
        "text-[0.69rem] font-bold uppercase leading-none tracking-[0.08em]",
        BADGE_TONE[tone],
      )}
    >
      {lead?.kind === "pulse" ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
          aria-hidden
        />
      ) : lead?.kind === "lock" ? (
        <LockSimpleIcon className="h-3 w-3" weight="bold" aria-hidden />
      ) : lead?.kind === "glyph" ? (
        <span aria-hidden>{lead.glyph}</span>
      ) : null}
      {label}
    </span>
  );
}
