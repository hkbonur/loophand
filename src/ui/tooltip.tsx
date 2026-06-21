import React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

type Side = "top" | "bottom" | "left" | "right";

interface Props {
  label: React.ReactNode;
  side?: Side;
  sideOffset?: number;
  // The trigger. Wrapped in an inline-flex span that carries the ref and the
  // hover/focus handlers, so any element (a button, an icon) gets a tooltip.
  children: React.ReactNode;
  className?: string;
}

interface Coords {
  x: number;
  y: number;
}

// Place the popup against the trigger's rect for the chosen side. The popup is
// translated onto these coordinates by `transformFor`, so we only return the
// anchor point and let the transform handle centering.
function anchorFor(side: Side, rect: DOMRect, offset: number): Coords {
  switch (side) {
    case "bottom":
      return { x: rect.left + rect.width / 2, y: rect.bottom + offset };
    case "left":
      return { x: rect.left - offset, y: rect.top + rect.height / 2 };
    case "right":
      return { x: rect.right + offset, y: rect.top + rect.height / 2 };
    case "top":
    default:
      return { x: rect.left + rect.width / 2, y: rect.top - offset };
  }
}

const TRANSFORM: Record<Side, string> = {
  top: "translate(-50%, -100%)",
  bottom: "translate(-50%, 0)",
  left: "translate(-100%, -50%)",
  right: "translate(0, -50%)",
};

// A lightweight, dependency-free tooltip that shows the instant the trigger is
// hovered or focused (no open delay), portaled to the body so the toolbar's own
// overflow clipping can't swallow it. Ink-on-paper inverted so it reads in one
// glance in either theme.
export function Tooltip(props: Props) {
  const side = props.side ?? "top";
  const offset = props.sideOffset ?? 8;
  const ref = React.useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = React.useState<Coords | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    setCoords(anchorFor(side, el.getBoundingClientRect(), offset));
  };
  const hide = () => setCoords(null);

  return (
    <span
      ref={ref}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      className={cn("inline-flex", props.className)}
    >
      {props.children}
      {coords && props.label
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md motion-safe:animate-[tooltip-in_90ms_ease-out]"
              style={{
                left: Math.min(Math.max(coords.x, 8), window.innerWidth - 8),
                top: coords.y,
                transform: TRANSFORM[side],
              }}
            >
              {props.label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
