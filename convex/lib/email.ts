import { logger } from "./logger";

// Transactional email via the Resend REST API (no component needed). Set
// RESEND_API_KEY and RESEND_FROM (e.g. "loophand <login@yourdomain>") in the
// Convex environment.
export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  meta?: Record<string, unknown>;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    logger.warn("email.not_configured", {
      reason: "RESEND_API_KEY or RESEND_FROM unset",
      ...args.meta,
    });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: args.to, subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      logger.error("email.send_failed", { status: res.status, ...args.meta });
      return;
    }
    logger.info("email.sent", { ...args.meta });
  } catch (error) {
    logger.error("email.send_failed", { error: String(error), ...args.meta });
  }
}

export function buildMagicLinkEmail(url: string, siteUrl: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#173a40;margin:0 0 12px">Sign in to loophand</h1>
    <p style="color:#416166;font-size:14px;line-height:1.5">Click the button below to sign in. This link expires shortly and can be used once.</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#328f97;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;font-size:14px">Sign in</a>
    </p>
    <p style="color:#90a7aa;font-size:12px">If you didn't request this, you can ignore this email.<br/>${siteUrl}</p>
  </div>`.trim();
}
