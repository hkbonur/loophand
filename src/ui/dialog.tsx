import React from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export function Dialog(props: Props) {
  const onClose = props.onClose;
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.open, onClose]);

  React.useEffect(() => {
    if (props.open) panelRef.current?.focus();
  }, [props.open]);

  if (!props.open) return null;

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
          "relative z-10 w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl focus:outline-none",
          props.className,
        )}
      >
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-4 w-4" />
        </button>
        {props.children}
      </div>
    </div>
  );
}
