import React from "react";
import { cn } from "../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  // "full" pins the sheet to a tall height instead of fitting its content;
  // "screen" fills the viewport (the canvas-first studio takeover).
  size?: "default" | "full" | "screen";
  children: React.ReactNode;
}

const CLOSE_THRESHOLD = 120;

// Mobile bottom sheet. Slides up from the bottom with a drag handle; dismiss by
// dragging down, tapping the backdrop, or Escape. Mirrors the Dialog API so it
// stands in for it on small screens. No floating close button — the handle and
// backdrop carry dismissal, as is conventional for a sheet.
export function Drawer(props: Props) {
  const onClose = props.onClose;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragStart = React.useRef<number | null>(null);
  const [dragY, setDragY] = React.useState(0);
  const [hasDragged, setHasDragged] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const dragging = dragStart.current !== null;

  const onPointerDown = (event: React.PointerEvent) => {
    dragStart.current = event.clientY;
    setHasDragged(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, event.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    const shouldClose = dragY > CLOSE_THRESHOLD;
    dragStart.current = null;
    if (shouldClose) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-[#0a0a0a]/55 backdrop-blur-sm motion-safe:animate-[drawer-fade_280ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        style={
          hasDragged
            ? {
                transform: `translateY(${dragY}px)`,
                transition: dragging ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1)",
              }
            : undefined
        }
        className={cn(
          "relative z-10 flex w-full flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl focus:outline-none",
          props.size === "screen" ? "h-dvh" : props.size === "full" ? "h-[92vh]" : "max-h-[92vh]",
          !hasDragged && "motion-safe:animate-[drawer-up_320ms_cubic-bezier(0.22,1,0.36,1)]",
          props.className,
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
        >
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <span className="sr-only">Drag down to close</span>
        </div>
        <div className="min-h-0 flex-1 touch-auto overflow-y-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
          {props.children}
        </div>
      </div>
    </div>
  );
}
