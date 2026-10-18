"use strict";

// The page the main window shows when the hosted app cannot be reached, or when the page keeps crashing.
// It is a self-contained data: page: it never gets the desktop bridge (the preload exposes it only to trusted pages,
// and main.js refuses IPC from it anyway), loads nothing from the network, and its only action is to go back to the
// app's own address (a trusted page, which the navigation guard allows). No Electron here, so it can be tested.

const crypto = require("node:crypto");

const KINDS = Object.freeze({
  offline: {
    title: "Can't reach Nexus Forge Gaming",
    body: "Check your internet connection. The app will try again automatically, or you can retry now.",
    button: "Retry",
  },
  crashed: {
    title: "Nexus Forge Gaming stopped working",
    body: "The page stopped several times in a row, so it was not reloaded again automatically. Reload when you are ready.",
    button: "Reload",
  },
});

/** Seconds before the offline page retries by itself: 15, 30, 60, 120, 240, then every 5 minutes. */
function offlineRetryDelaySeconds(attempt) {
  const step = Math.max(0, Math.floor(Number(attempt) || 0));
  return Math.min(300, 15 * 2 ** Math.min(step, 5));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

/** JSON that is safe inside an inline <script> (no "</script>" or HTML comment openers can be formed). */
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function sha256Base64(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("base64");
}

/** Only an http(s) address can be the retry target; anything else leaves the page without a retry action. */
function safeRetryUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The page's HTML. retryUrl: the app's own (trusted) address. autoRetrySeconds: 0 for no automatic retry.
 * detail: optional short text shown under the message (for example a network error code).
 */
function renderOfflinePage({ kind = "offline", retryUrl, autoRetrySeconds = 0, detail = "" } = {}) {
  const copy = KINDS[kind] || KINDS.offline;
  const target = safeRetryUrl(retryUrl);
  const seconds = target ? Math.max(0, Math.floor(Number(autoRetrySeconds) || 0)) : 0;

  const style = [
    ":root{color-scheme:dark}",
    "*{box-sizing:border-box}",
    "html,body{height:100%;margin:0}",
    "body{display:grid;place-items:center;padding:24px;background:#020617;color:#e2e8f0;font-family:'Segoe UI Variable','Segoe UI',system-ui,sans-serif}",
    "main{width:min(520px,100%);padding:28px;border:1px solid rgba(56,189,248,.25);border-radius:18px;background:rgba(15,23,42,.85)}",
    "h1{margin:0 0 10px;font-size:22px}",
    "p{margin:0 0 14px;line-height:1.5;color:#cbd5e1}",
    ".detail{font-size:12px;color:#94a3b8}",
    "button{border:0;border-radius:10px;padding:10px 18px;font-size:15px;font-weight:600;background:#38bdf8;color:#020617;cursor:pointer}",
    "button:focus-visible{outline:2px solid #e2e8f0;outline-offset:2px}",
    "button[hidden]{display:none}",
    "#countdown{margin-top:12px;font-size:13px;color:#94a3b8;min-height:1em}",
  ].join("");

  const script = [
    "(function(){",
    `var target=${scriptJson(target)};`,
    `var seconds=${seconds};`,
    "var button=document.getElementById('retry');",
    "var note=document.getElementById('countdown');",
    "if(!target){button.hidden=true;return;}",
    "var going=false;",
    "function go(){if(going)return;going=true;button.disabled=true;note.textContent='Connecting...';window.location.replace(target);}",
    "button.addEventListener('click',go);",
    "button.focus();",
    "if(seconds>0){",
    "var left=seconds;",
    "var tick=function(){if(going)return;if(left<=0){go();return;}note.textContent='Trying again in '+left+' s';left-=1;};",
    "tick();setInterval(tick,1000);",
    "window.addEventListener('online',go);",
    "}",
    "})();",
  ].join("");

  const csp = [
    "default-src 'none'",
    `style-src 'sha256-${sha256Base64(style)}'`,
    `script-src 'sha256-${sha256Base64(script)}'`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  const detailHtml = detail ? `<p class="detail">${escapeHtml(String(detail).slice(0, 200))}</p>` : "";

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(copy.title)}</title>`,
    `<style>${style}</style>`,
    "</head><body><main>",
    `<h1>${escapeHtml(copy.title)}</h1>`,
    `<p>${escapeHtml(copy.body)}</p>`,
    detailHtml,
    `<button id="retry" type="button">${escapeHtml(copy.button)}</button>`,
    '<div id="countdown" role="status" aria-live="polite"></div>',
    `</main><script>${script}</script></body></html>`,
  ].join("");
}

/** The page as a data: address for BrowserWindow.loadURL. */
function offlinePageUrl(options) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(renderOfflinePage(options))}`;
}

module.exports = { KINDS, offlineRetryDelaySeconds, escapeHtml, renderOfflinePage, offlinePageUrl };
