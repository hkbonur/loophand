import { useEffect, useState } from "react";
import { MoonIcon, MonitorIcon, SunIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

export type ThemeMode = "light" | "dark" | "auto";

const MODES: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "auto", label: "System", Icon: MonitorIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
];

const ICONS: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  auto: MonitorIcon,
};

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }

  return "auto";
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }

  document.documentElement.style.colorScheme = resolved;
}

/**
 * Owns theme state and keeps the document in sync. Reads the stored mode on
 * mount and, while in `auto`, follows the OS preference live. Hoist this once
 * (in `AccountMenu`) so the listener stays mounted regardless of which control
 * is visible.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("auto");

  useEffect(() => {
    const initialMode = getInitialMode();
    setModeState(initialMode);
    applyThemeMode(initialMode);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("auto");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  function setMode(next: ThemeMode) {
    setModeState(next);
    applyThemeMode(next);
    window.localStorage.setItem("theme", next);
  }

  return { mode, setMode };
}

interface ControlProps {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/** Compact cycling icon button — used as floating chrome when signed out. */
export function ThemeCycleButton(props: ControlProps) {
  const mode = props.mode;
  const setMode = props.setMode;
  const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
  const label =
    mode === "auto"
      ? "Theme: system. Switch to light."
      : `Theme: ${mode}. Switch to ${next}.`;
  const Icon = ICONS[mode];

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Icon size={18} weight="bold" />
    </button>
  );
}

/** Three-way segmented control — used inside the account popup. */
export function ThemeSegmented(props: ControlProps) {
  const mode = props.mode;
  const setMode = props.setMode;
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-1 rounded-xl bg-muted p-1"
    >
      {MODES.map(({ mode: value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={15} weight="bold" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
