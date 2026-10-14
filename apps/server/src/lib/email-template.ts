/**
 * Every Nexus Forge email goes out as "Nexus Forge Gaming" in one branded layout, whatever mailbox
 * actually sends it. The text version is kept as-is for mail apps that prefer plain text.
 */
import { env } from "../config/env.js";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text to safe HTML paragraphs, with links clickable. */
function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" style="color:#a78bfa;word-break:break-all">${url}</a>`);
      return `<p style="margin:0 0 14px;line-height:1.6">${html.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function brandedEmailHtml(subject: string, text: string) {
  const site = env.APP_WEB_URL.replace(/\/+$/, "");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#0b0e15;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0e15;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#11151e;border:1px solid #262b38;border-radius:14px">
        <tr><td style="padding:20px 24px;border-bottom:1px solid #262b38">
          <span style="font-size:18px;font-weight:800;letter-spacing:2px;color:#63c0ff">NEXUS FORGE</span>
          <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:#a78bfa;margin-left:6px">GAMING</span>
        </td></tr>
        <tr><td style="padding:24px;font-size:15px;color:#e2e8f0">
          <h1 style="margin:0 0 16px;font-size:19px;color:#ffffff">${escapeHtml(subject)}</h1>
          ${textToHtml(text)}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #262b38;font-size:12px;color:#64748b;line-height:1.5">
          You're getting this because you have a Nexus Forge Gaming account. This is an automated message.<br>
          <a href="${site}" style="color:#94a3b8">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The sender. The display name is always the app's (MAIL_FROM_NAME, default "Nexus Forge
 * Gaming"); the address comes from MAIL_FROM. Note Gmail only sends from the signed-in
 * account (or its verified aliases), so the address is only the app's own when the SMTP
 * account belongs to the app.
 */
export function senderAddress() {
  const match = /<([^>]+)>/.exec(env.MAIL_FROM);
  const address = (match ? match[1] : env.MAIL_FROM).trim();
  return { name: env.MAIL_FROM_NAME, address };
}
