import React from "react";
import { Mail } from "lucide-react";
import { authClient } from "../convex-client";
import { Button } from "../ui/button";
import { toast } from "../ui/toaster";

const SITE_ORIGIN = import.meta.env.VITE_SITE_URL ?? "";

function callbackUrl(): string {
  if (SITE_ORIGIN) return `${SITE_ORIGIN}/`;
  if (typeof window !== "undefined") return `${window.location.origin}/`;
  return "/";
}

export function AuthLoginPage() {
  const [email, setEmail] = React.useState("");
  const [magicSent, setMagicSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const signInGoogle = React.useCallback(async () => {
    setBusy(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: callbackUrl() });
    } catch {
      toast.error("Could not start sign-in. Try again.");
      setBusy(false);
    }
  }, []);

  const sendMagicLink = React.useCallback(async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await authClient.signIn.magicLink({ email: email.trim(), callbackURL: callbackUrl() });
      setMagicSent(true);
    } catch {
      toast.error("Could not send the sign-in link. Try again.");
    } finally {
      setBusy(false);
    }
  }, [email]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] p-8 shadow-xl">
        <p className="island-kicker mb-2">loophand</p>
        <h1 className="mb-1 text-2xl font-bold text-[var(--sea-ink)]">Sign in</h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          The human-in-the-loop board for your terminal agents.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" disabled={busy} onClick={signInGoogle}>
            Continue with Google
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-[var(--sea-ink-soft)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          or
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        {magicSent ? (
          <div className="flex items-start gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--sea-ink-soft)]">
            <Mail className="mt-0.5 h-4 w-4 text-[var(--lagoon-deep)]" />
            <span>Check {email} for a sign-in link.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-10 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)] focus:outline-none"
            />
            <Button disabled={busy || !email.trim()} onClick={sendMagicLink}>
              Email me a sign-in link
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
