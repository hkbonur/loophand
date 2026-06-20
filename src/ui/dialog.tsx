import React from "react";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { useIsMobile } from "../lib/useIsMobile";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  // "full" near-fills the viewport (a tall working canvas); content scrolls
  // inside the panel rather than growing the overlay. "screen" edge-to-edge fills
  // the whole viewport (the canvas-first studio takeover).
  size?: "default" | "full" | "screen";
  children: React.ReactNode;
}

// Responsive shell: a centered modal on desktop, a bottom drawer on small
// screens. The two paths are separate components so each owns a stable set of
// hooks across the breakpoint switch.
export function Dialog(props: Props) {
  const isMobile = useIsMobile();
  if (!props.open) return null;
  return isMobile ? <Drawer {...props} /> : <DialogModal {...props} />;
}

function DialogModal(props: Props) {
  const onClose = props.onClose;
  const panelRef = React.useRef<HTMLDivElement>(null);

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

  const screen = props.size === "screen";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0a0a0a]/55 p-4 backdrop-blur-sm sm:p-8">
      <div className="absolute inset-0" onClick={props.onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className={cn(
          "relative z-10 my-auto flex w-full flex-col rounded-3xl border border-border bg-card shadow-2xl focus:outline-none motion-safe:animate-[dialog-in_200ms_cubic-bezier(0.22,1,0.36,1)]",
          screen && "h-[calc(100dvh-2rem)] max-w-none overflow-hidden sm:h-[calc(100dvh-4rem)]",
          props.size === "full" && "h-[calc(100dvh-4rem)] max-w-[1400px] overflow-hidden",
          (!props.size || props.size === "default") && "max-w-3xl",
          props.className,
        )}
      >
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className={cn(
            "absolute right-4 top-4 z-30 rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            screen ? "p-2" : "p-1.5",
          )}
        >
          <XIcon className={screen ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        {props.children}
      </div>
    </div>
  );
}
