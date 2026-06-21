import React from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  // The popup opens upward by default — the export select lives in the bottom
  // toolbar, so a downward menu would fall off-screen.
  side?: "top" | "bottom";
  label: string;
  className?: string;
}

interface Anchor {
  left: number;
  width: number;
  top: number;
  bottom: number;
}

// A small, dependency-free select styled to the loophand surface: a pill trigger
// and a portaled popup that anchors to the trigger and opens up or down. Closes
// on outside click or Escape; arrow keys move through options while open.
export function Select<T extends string>(props: Props<T>) {
  const side = props.side ?? "top";
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const open = anchor !== null;
  const selected = props.options.find((o) => o.value === props.value);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ left: r.left, width: r.width, top: r.top, bottom: r.bottom });
  };
  const close = () => setAnchor(null);

  const choose = (value: T) => {
    props.onChange(value);
    close();
    triggerRef.current?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const i = props.options.findIndex((o) => o.value === props.value);
      const next = props.options[(i + dir + props.options.length) % props.options.length];
      if (next) props.onChange(next.value);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={props.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : place())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          props.className,
        )}
      >
        <span className="tabular-nums">{selected?.label ?? props.value}</span>
        <CaretDownIcon className={cn("h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
      </button>

      {anchor
        ? createPortal(
            <SelectPopup
              anchor={anchor}
              side={side}
              options={props.options}
              value={props.value}
              label={props.label}
              onChoose={choose}
              onClose={close}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function SelectPopup<T extends string>(props: {
  anchor: Anchor;
  side: "top" | "bottom";
  options: Option<T>[];
  value: T;
  label: string;
  onChoose: (value: T) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) props.onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [props]);

  const style: React.CSSProperties =
    props.side === "top"
      ? { left: props.anchor.left, bottom: window.innerHeight - props.anchor.top + 6 }
      : { left: props.anchor.left, top: props.anchor.bottom + 6 };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={props.label}
      tabIndex={-1}
      style={{ ...style, minWidth: props.anchor.width }}
      className="fixed z-[60] rounded-xl border border-border bg-card p-1 shadow-xl focus:outline-none motion-safe:animate-[select-in_120ms_ease-out]"
    >
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => props.onChoose(option.value)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <CheckIcon
              className={cn("h-3.5 w-3.5 flex-none", active ? "opacity-100" : "opacity-0")}
            />
            <span className="tabular-nums">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
