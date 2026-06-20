// Task-notification email template. The title is agent/human-supplied, so it is
// HTML-escaped before interpolation (the email body is HTML). Mirrors the
// magic-link email styling in lib/email.ts.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface TaskEmailArgs {
  title: string;
  type: string;
  // Deep link to the board card, or null when SITE_URL isn't configured.
  url: string | null;
}

export function buildTaskEmail(args: TaskEmailArgs): { subject: string; html: string } {
  const safeTitle = escapeHtml(args.title);
  const safeType = escapeHtml(args.type.replace(/_/g, " "));
  // Subject is a plain-text header: collapse whitespace and cap the length.
  const subject = `Review needed: ${args.title.replace(/\s+/g, " ").trim().slice(0, 120)}`;
  const button = args.url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(args.url)}" style="background:#328f97;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;font-size:14px">Open the card</a></p>`
    : "";
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#173a40;margin:0 0 12px">A task needs your review</h1>
    <p style="color:#416166;font-size:14px;line-height:1.5"><strong>${safeTitle}</strong> (${safeType})</p>
    ${button}
    <p style="color:#90a7aa;font-size:12px">You're getting this because an agent raised a task on your loophand board.</p>
  </div>`.trim();
  return { subject, html };
}
