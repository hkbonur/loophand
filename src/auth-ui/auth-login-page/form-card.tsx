import type React from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Spinner } from "../../ui/spinner";

export interface AuthFeedback {
  variant: "success" | "error";
  title: string;
  description: string;
}

interface Props {
  email: string;
  disabled: boolean;
  isSendingLink: boolean;
  feedback: AuthFeedback | null;
  onEmailChange: (email: string) => void;
  onGoogleClick: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function FormCard(props: Props) {
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2.5 text-center lg:text-left">
        <p className="island-kicker lg:hidden">loophand</p>
        <h2 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground lg:max-w-[32ch]">
          Sign in to your board to pick up where your agents left off.
        </p>
      </div>

      <div className="space-y-4">
        <Button
          variant="secondary"
          disabled={props.disabled}
          onClick={props.onGoogleClick}
          className="h-11 w-full"
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>

        <Divider />

        <form onSubmit={props.onSubmit} className="space-y-3">
          <Input
            type="email"
            size="lg"
            value={props.email}
            onChange={props.onEmailChange}
            placeholder="name@example.com"
            autoComplete="email"
            disabled={props.disabled}
          />
          <Button type="submit" disabled={props.disabled || !props.email.trim()} className="h-11 w-full">
            {props.isSendingLink ? (
              <>
                <Spinner className="size-4" />
                Sending link...
              </>
            ) : (
              <>
                <EnvelopeSimpleIcon className="size-4" weight="bold" />
                Email me a sign-in link
              </>
            )}
          </Button>

          {props.feedback ? <Feedback feedback={props.feedback} /> : null}
        </form>
      </div>

      <LegalNotice />
    </div>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          or
        </span>
      </div>
    </div>
  );
}

function Feedback(props: { feedback: AuthFeedback }) {
  const isSuccess = props.feedback.variant === "success";
  return (
    <div
      role="status"
      className={cn("rounded-2xl border p-3", {
        "border-success/30 bg-success/15": isSuccess,
        "border-destructive/30 bg-destructive/15": !isSuccess,
      })}
    >
      <p
        className={cn("text-sm font-semibold", {
          "text-success": isSuccess,
          "text-destructive": !isSuccess,
        })}
      >
        {props.feedback.title}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{props.feedback.description}</p>
    </div>
  );
}

function LegalNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground lg:text-left">
      By continuing, you agree to our{" "}
      <a href="/terms" className="underline underline-offset-4 transition-colors hover:text-foreground">
        Terms
      </a>{" "}
      and{" "}
      <a href="/privacy" className="underline underline-offset-4 transition-colors hover:text-foreground">
        Privacy Policy
      </a>
      .
    </p>
  );
}

function GoogleIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
