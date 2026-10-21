import test from "node:test";
import assert from "node:assert/strict";
import { blockedLabel, cspErrorReport, MAX_VIOLATIONS_PER_REQUEST, parseCspReports } from "../src/lib/csp-reports.js";

const legacy = {
  "csp-report": {
    "document-uri": "https://nfgcord.com/app/chat?invite=SECRET123",
    "violated-directive": "img-src 'self' data:",
    "effective-directive": "img-src",
    "blocked-uri": "https://cdn.example.com/pic.png?token=abc",
    "source-file": "https://nfgcord.com/_next/static/chunks/app.js?v=1",
    "line-number": 12,
    "column-number": 7,
    disposition: "report",
  },
};

test("the older report-uri shape keeps only what was blocked, where, and by which rule", () => {
  const [violation] = parseCspReports(legacy);
  assert.deepEqual(violation, {
    directive: "img-src",
    blocked: "https://cdn.example.com",
    page: "/app/chat",
    source: "https://nfgcord.com/_next/static/chunks/app.js",
    line: 12,
    column: 7,
    reportOnly: true,
  });
});

test("no query string (tokens, invite codes) survives into the stored report", () => {
  const stored = JSON.stringify(cspErrorReport(parseCspReports(legacy)[0]));
  for (const secret of ["SECRET123", "token=abc", "v=1", "?"]) assert.ok(!stored.includes(secret), `"${secret}" leaked: ${stored}`);
});

test("Reporting API batches give one violation per csp-violation entry; other report types are ignored", () => {
  const batch = [
    { type: "csp-violation", url: "https://nfgcord.com/app", body: { documentURL: "https://nfgcord.com/app", effectiveDirective: "script-src-elem", blockedURL: "inline", disposition: "report", lineNumber: 3 } },
    { type: "deprecation", body: { id: "x" } },
    { type: "csp-violation", body: { documentURL: "https://nfgcord.com/live", effectiveDirective: "frame-src", blockedURL: "https://player.example.tv/embed/1", disposition: "enforce" } },
  ];
  const violations = parseCspReports(batch);
  assert.equal(violations.length, 2);
  assert.equal(violations[0].blocked, "inline");
  assert.equal(violations[0].directive, "script-src-elem");
  assert.equal(violations[1].blocked, "https://player.example.tv");
  assert.equal(violations[1].reportOnly, false);
  assert.match(cspErrorReport(violations[0]).message, /would block inline$/);
  assert.match(cspErrorReport(violations[1]).message, /frame-src blocked https:\/\/player\.example\.tv$/);
});

test("one request records at most a handful of violations", () => {
  const many = Array.from({ length: 50 }, (_, n) => ({ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: `https://site${n}.example` } }));
  assert.equal(parseCspReports(many).length, MAX_VIOLATIONS_PER_REQUEST);
});

test("reports caused by browser extensions are dropped", () => {
  assert.deepEqual(parseCspReports({ "csp-report": { "effective-directive": "script-src", "blocked-uri": "chrome-extension://abcdef/inject.js" } }), []);
  assert.deepEqual(parseCspReports([{ type: "csp-violation", body: { effectiveDirective: "style-src", blockedURL: "inline", sourceFile: "moz-extension://1234/content.js" } }]), []);
});

test("malformed bodies give nothing and never throw", () => {
  for (const body of [null, undefined, "text", 42, {}, [], [null], { "csp-report": "x" }, [{ type: "csp-violation", body: "x" }]]) {
    assert.deepEqual(parseCspReports(body), [], JSON.stringify(body));
  }
  const odd = parseCspReports({ "csp-report": { "effective-directive": "<script>alert(1)</script>", "blocked-uri": "not a url", "line-number": -4 } })[0];
  assert.equal(odd.directive, "unknown");
  assert.equal(odd.blocked, "unknown");
  assert.equal(odd.line, null);
});

test("blocked addresses are shortened to their site; keywords and schemes stay readable", () => {
  assert.equal(blockedLabel("https://evil.example:8443/x.js?k=1"), "https://evil.example:8443");
  assert.equal(blockedLabel("wss://socket.example/socket.io/?EIO=4"), "wss://socket.example");
  assert.equal(blockedLabel("eval"), "eval");
  assert.equal(blockedLabel("data:image/png;base64,AAAA"), "data");
  assert.equal(blockedLabel("blob:https://nfgcord.com/5f0c"), "blob");
  assert.equal(blockedLabel(null), "unknown");
});
