import React from "react";
import { X } from "lucide-react";
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

  React.useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.open, onClose]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(8,20,24,0.45)] p-4 backdrop-blur-sm sm:p-8">
      <div className="absolute inset-0" onClick={props.onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className={cn(
          "relative z-10 w-full max-w-3xl rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] shadow-2xl",
          props.className,
        )}
      >
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
        {props.children}
      </div>
    </div>
  );
}
