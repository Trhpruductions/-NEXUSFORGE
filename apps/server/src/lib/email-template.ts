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
      const html = escapeHtml(paragraph).replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" style="color:#7dd3fc;word-break:break-all">${url}</a>`);
      return `<p style="margin:0 0 14px;line-height:1.6">${html.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/** The shared frame: brand bar, a friendly card, and a footer that says why the email arrived. */
function emailFrame(subject: string, innerHtml: string) {
  const site = env.APP_WEB_URL.replace(/\/+$/, "");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#070a12;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070a12;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1420;border:1px solid #1f2a3d;border-radius:16px;overflow:hidden">
        <tr><td style="height:4px;background:linear-gradient(90deg,#2ea4ff,#a78bfa);font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:22px 26px 16px">
          <span style="font-size:18px;font-weight:800;letter-spacing:2px;color:#63c0ff">NEXUS FORGE</span>
          <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:#a78bfa;margin-left:6px">GAMING</span>
        </td></tr>
        <tr><td style="padding:8px 26px 26px;font-size:15px;color:#e2e8f0">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#ffffff">${escapeHtml(subject)}</h1>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:16px 26px 20px;border-top:1px solid #1f2a3d;font-size:12px;color:#7b8799;line-height:1.6">
          You're getting this email because you have a Nexus Forge Gaming account. If that isn't you, you can ignore it.<br>
          <a href="${site}" style="color:#94a3b8">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function brandedEmailHtml(subject: string, text: string) {
  return emailFrame(subject, textToHtml(text));
}

/** A one-time code email: the code sits in its own box so it is easy to read and type. */
export function codeEmailHtml(params: { subject: string; intro: string; code: string; footnote: string }) {
  const inner = `${textToHtml(params.intro)}
          <div style="margin:22px 0;padding:18px 12px;text-align:center;background:#0b1322;border:1px solid #2b3a57;border-radius:12px">
            <span style="font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff">${escapeHtml(params.code)}</span>
          </div>
          ${textToHtml(params.footnote)}`;
  return emailFrame(params.subject, inner);
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
