import React from "react";
import { CheckIcon, XIcon, MinusIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";
import { Spinner } from "../../ui/spinner";
import { Kbd } from "../../ui/kbd";
import type { ItemStatus, RailItem } from "./types";

interface Props {
  items: RailItem[];
  selectedOrder: number;
  onSelect: (order: number) => void;
  itemsDone: number;
  itemCount: number;
  onApplyToAll?: () => void;
  onSubmit?: () => void;
  submitting?: boolean;
}

// A bottom filmstrip for a multi-item task: one cell per item with its verdict,
// a running done/total chip, and the batch actions. Surface-agnostic — the doc
// studio and (later) the image studio render the same rail, only the cell's
// surface above it differs. Keyboard: [ and ] (or ←/→) step between items.
export function ItemRail(props: Props) {
  const { items, selectedOrder, onSelect, itemsDone, itemCount, submitting } = props;

  const step = React.useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const idx = items.findIndex((i) => i.order === selectedOrder);
      const next = items[Math.min(items.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + delta))];
      onSelect(next.order);
    },
    [items, selectedOrder, onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "[" || e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "]" || e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  };

  const allSettled = itemsDone >= itemCount && itemCount > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {itemsDone}/{itemCount}
          </span>
          <span>reviewed</span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>[</Kbd>
            <Kbd>]</Kbd>
            <span>to move</span>
          </span>
        </div>
        <div className="flex gap-2">
          {props.onApplyToAll ? (
            <Button variant="ghost" onClick={props.onApplyToAll} disabled={submitting}>
              Apply to all
            </Button>
          ) : null}
          {props.onSubmit ? (
            <Button onClick={props.onSubmit} disabled={submitting || !allSettled}>
              {submitting ? <Spinner className="text-white" /> : null}
              Submit batch
            </Button>
          ) : null}
        </div>
      </div>

      <ul
        role="listbox"
        aria-label="Review items"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {items.map((item) => {
          const selected = item.order === selectedOrder;
          const tone = STATUS_TONE[item.status];
          return (
            <li key={item.order} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(item.order)}
                className={cn(
                  "flex min-w-28 flex-col gap-1 rounded-xl border p-2 text-left transition",
                  selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    #{item.order + 1}
                  </span>
                  <StatusDot status={item.status} />
                </div>
                <span className="truncate text-sm text-foreground">
                  {item.title ?? `Item ${item.order + 1}`}
                </span>
                <span className={cn("text-xs", tone.text)}>{tone.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STATUS_TONE: Record<ItemStatus, { label: string; text: string; dot: string }> = {
  pending: { label: "Pending", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  approved: { label: "Approved", text: "text-success", dot: "bg-success" },
  changes_requested: { label: "Changes", text: "text-destructive", dot: "bg-destructive" },
  skipped: { label: "Skipped", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
};

function StatusDot(props: { status: ItemStatus }) {
  if (props.status === "approved") {
    return <CheckIcon className="h-3.5 w-3.5 text-success" weight="bold" aria-hidden />;
  }
  if (props.status === "changes_requested") {
    return <XIcon className="h-3.5 w-3.5 text-destructive" weight="bold" aria-hidden />;
  }
  if (props.status === "skipped") {
    return <MinusIcon className="h-3.5 w-3.5 text-muted-foreground" weight="bold" aria-hidden />;
  }
  return <span className={cn("h-2 w-2 rounded-full", STATUS_TONE.pending.dot)} aria-hidden />;
}
