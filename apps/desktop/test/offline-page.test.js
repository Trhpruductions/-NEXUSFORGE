"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const offline = require("../lib/offline-page");

const between = (text, open, close) => {
  const start = text.indexOf(open) + open.length;
  return text.slice(start, text.indexOf(close, start));
};
const hash = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;

test("the offline page has a Retry button that goes back to the app", () => {
  const html = offline.renderOfflinePage({ retryUrl: "https://nfgcord.com/app", autoRetrySeconds: 30 });
  assert.ok(html.includes("Can&#39;t reach Nexus Forge Gaming"));
  assert.ok(html.includes('<button id="retry" type="button">Retry</button>'));
  assert.ok(html.includes('var target="https://nfgcord.com/app";'));
  assert.ok(html.includes("var seconds=30;"));
  assert.ok(html.includes("window.location.replace(target)"));
});

test("the page loads nothing and runs only its own script (CSP hashes match)", () => {
  const html = offline.renderOfflinePage({ retryUrl: "https://nfgcord.com/app", autoRetrySeconds: 15 });
  const csp = between(html, 'http-equiv="Content-Security-Policy" content="', '"').replace(/&#39;/g, "'");
  assert.ok(csp.startsWith("default-src 'none'"));
  assert.ok(csp.includes(`script-src ${hash(between(html, "<script>", "</script>"))}`), "the script hash matches the script");
  assert.ok(csp.includes(`style-src ${hash(between(html, "<style>", "</style>"))}`), "the style hash matches the style");
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
  assert.ok(!/\bsrc=|href=/.test(html), "no external resources");
});

test("only an http(s) retry address is used, and it cannot break out of the script", () => {
  const sneaky = offline.renderOfflinePage({ retryUrl: "https://nfgcord.com/app?</script><script>alert(1)</script>" });
  assert.equal((sneaky.match(/<script>/g) || []).length, 1, "a single script element");
  assert.ok(!sneaky.includes("</script><script>alert"));
  for (const bad of ["javascript:alert(1)", "file:///C:/Windows", "data:text/html,x", "", undefined]) {
    const html = offline.renderOfflinePage({ retryUrl: bad, autoRetrySeconds: 30 });
    assert.ok(html.includes("var target=null;"), String(bad));
    assert.ok(html.includes("var seconds=0;"), "no automatic retry without a target");
  }
});

test("the crashed page does not retry by itself", () => {
  const html = offline.renderOfflinePage({ kind: "crashed", retryUrl: "https://nfgcord.com/app", autoRetrySeconds: 30 });
  assert.ok(html.includes("stopped working"));
  assert.ok(html.includes(">Reload</button>"));
  const auto = offline.renderOfflinePage({ kind: "crashed", retryUrl: "https://nfgcord.com/app", autoRetrySeconds: 0 });
  assert.ok(auto.includes("var seconds=0;"));
});

test("detail text is escaped", () => {
  const html = offline.renderOfflinePage({ retryUrl: "https://nfgcord.com/app", detail: '<img src=x onerror="alert(1)">' });
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes("<img"));
});

test("automatic retries slow down: 15 s, 30 s, 60 s ... up to 5 minutes", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 50].map(offline.offlineRetryDelaySeconds), [15, 30, 60, 120, 240, 300, 300, 300]);
  assert.equal(offline.offlineRetryDelaySeconds(-3), 15);
  assert.equal(offline.offlineRetryDelaySeconds("junk"), 15);
});

test("the page is delivered as a data: address", () => {
  const url = offline.offlinePageUrl({ retryUrl: "https://nfgcord.com/app" });
  assert.ok(url.startsWith("data:text/html;charset=utf-8,"));
  assert.equal(decodeURIComponent(url.slice("data:text/html;charset=utf-8,".length)), offline.renderOfflinePage({ retryUrl: "https://nfgcord.com/app" }));
});
