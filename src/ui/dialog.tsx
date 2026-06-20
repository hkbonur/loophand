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
          "relative z-10 my-auto w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl focus:outline-none motion-safe:animate-[dialog-in_200ms_cubic-bezier(0.22,1,0.36,1)]",
          props.className,
        )}
      >
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-10 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <XIcon className="h-4 w-4" />
        </button>
        {props.children}
      </div>
    </div>
  );
}
