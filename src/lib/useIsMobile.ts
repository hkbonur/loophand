import React from "react";

// Tracks whether the viewport is below `breakpoint` (default 640px, the `sm`
// edge the board layout splits on). SSR-safe: renders desktop-first, then
// corrects on mount. Drives the Dialog → Drawer switch on small screens.
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
