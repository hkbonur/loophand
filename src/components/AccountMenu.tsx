import React from "react";
import { useQuery } from "convex/react";
import { SignOutIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { cn } from "../lib/cn";
import { authClient } from "../convex-client";
import { toast } from "../ui/toaster";
import { ThemeCycleButton, ThemeSegmented, useTheme } from "./ThemeToggle";

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Avatar(props: { image: string | null; name: string | null; email: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold tracking-wide text-foreground shadow-sm ring-1 ring-inset ring-foreground/15">
      {props.image ? (
        <img src={props.image} alt="" className="size-full object-cover" />
      ) : (
        initialsOf(props.name, props.email)
      )}
    </span>
  );
}

export function AccountMenu() {
  const user = useQuery(api.users.currentUser, {});
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // `undefined` while loading, `null` when signed out — no account menu, but
  // keep theme control available as floating chrome (e.g. the login page).
  if (!user) return <ThemeCycleButton mode={theme.mode} setMode={theme.setMode} />;

  const displayName = user.name?.trim() || user.email;

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.assign("/login");
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${displayName}`}
        title={displayName}
        className={cn(
          "rounded-full ring-2 ring-foreground/15 ring-offset-2 ring-offset-background transition duration-200 ease-out",
          "hover:ring-foreground/40 focus-visible:outline-none focus-visible:ring-ring/60",
          "motion-safe:hover:scale-[1.04] motion-safe:active:scale-100",
          open && "ring-foreground/40",
        )}
      >
        <Avatar image={user.image} name={user.name} email={user.email} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-60 origin-top-right rounded-2xl border border-border bg-card p-1 shadow-xl"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar image={user.image} name={user.name} email={user.email} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              {user.name ? (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              ) : null}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="px-2 py-1.5">
            <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Theme</p>
            <ThemeSegmented mode={theme.mode} setMode={theme.setMode} />
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            <SignOutIcon className="h-4 w-4" weight="bold" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
