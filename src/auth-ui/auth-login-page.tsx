import React from "react";
import { authClient } from "../convex-client";
import { HeroPanel } from "./auth-login-page/hero-panel";
import { FormCard, type AuthFeedback } from "./auth-login-page/form-card";

const SITE_ORIGIN = import.meta.env.VITE_SITE_URL ?? "";

function callbackUrl(): string {
  if (SITE_ORIGIN) return `${SITE_ORIGIN}/`;
  if (typeof window !== "undefined") return `${window.location.origin}/`;
  return "/";
}

type LoadingMethod = "google" | "email" | null;

export function AuthLoginPage() {
  const [email, setEmail] = React.useState("");
  const [loadingMethod, setLoadingMethod] = React.useState<LoadingMethod>(null);
  const [feedback, setFeedback] = React.useState<AuthFeedback | null>(null);

  const handleEmailChange = (next: string) => {
    setEmail(next);
    if (feedback) setFeedback(null);
  };

  const signInGoogle = React.useCallback(async () => {
    setLoadingMethod("google");
    setFeedback(null);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: callbackUrl() });
    } catch {
      setFeedback({
        variant: "error",
        title: "Could not start sign-in",
        description: "Something went wrong reaching Google. Please try again.",
      });
      setLoadingMethod(null);
    }
  }, []);

  const sendMagicLink = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;

      setLoadingMethod("email");
      setFeedback(null);
      try {
        await authClient.signIn.magicLink({ email: trimmed, callbackURL: callbackUrl() });
        setFeedback({
          variant: "success",
          title: "Check your email",
          description: `We sent a sign-in link to ${trimmed}. Open it to continue.`,
        });
      } catch {
        setFeedback({
          variant: "error",
          title: "Link not sent",
          description: "We could not send the sign-in link. Please try again.",
        });
      } finally {
        setLoadingMethod(null);
      }
    },
    [email],
  );

  return (
    <main className="flex min-h-svh bg-background">
      <HeroPanel />
      <div className="flex flex-1 items-center justify-center px-6 pb-12 lg:pb-0">
        <FormCard
          email={email}
          disabled={loadingMethod !== null}
          isSendingLink={loadingMethod === "email"}
          feedback={feedback}
          onEmailChange={handleEmailChange}
          onGoogleClick={() => void signInGoogle()}
          onSubmit={(event) => void sendMagicLink(event)}
        />
      </div>
    </main>
  );
}
