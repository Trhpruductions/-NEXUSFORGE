// Run with: npx tsx --test tests/content-security-policy.test.ts (from apps/web). Checks the policy text only.
import test from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicies, CSP_REPORT_GROUP } from "../next.config";

function directives(policy: string) {
  return new Map(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
}

test("the enforced policy only has rules no page depends on breaking", () => {
  const enforced = directives(contentSecurityPolicies({ dev: false }).enforced);
  assert.deepEqual([...enforced.keys()].sort(), ["base-uri", "form-action", "frame-ancestors"]);
  for (const values of enforced.values()) assert.deepEqual(values, ["'self'"]);
});

test("the report-only policy covers everything and reports to the API", () => {
  const policy = directives(contentSecurityPolicies({ dev: false }).reportOnly);
  for (const name of ["default-src", "script-src", "style-src", "img-src", "connect-src", "frame-src", "object-src", "base-uri", "form-action", "frame-ancestors"]) {
    assert.ok(policy.has(name), `missing ${name}`);
  }
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  assert.deepEqual(policy.get("report-uri"), ["/api/errors/csp"]);
  assert.deepEqual(policy.get("report-to"), [CSP_REPORT_GROUP]);
});

test("the live site (https, same origin) uses both report forms; development uses report-uri only", () => {
  assert.equal(contentSecurityPolicies({ dev: false }).reportingApi, true);
  assert.equal(contentSecurityPolicies({ dev: false, apiOrigin: "https://api.example.com" }).reportingApi, true);
  assert.equal(contentSecurityPolicies({ dev: true }).reportingApi, false);
  assert.ok(!contentSecurityPolicies({ dev: true }).reportOnly.includes("report-to"));
});

test("eval is only allowed while developing", () => {
  assert.ok(!contentSecurityPolicies({ dev: false }).reportOnly.includes("unsafe-eval"));
  assert.ok(contentSecurityPolicies({ dev: true }).reportOnly.includes("'unsafe-eval'"));
});

test("chat uploads (R2), Cloudflare's analytics script and the video embeds the app offers are allowed", () => {
  const policy = directives(contentSecurityPolicies({ dev: false }).reportOnly);
  // Found on the live site (21 Oct 2026): Cloudflare inserts this script into every page.
  assert.ok(policy.get("script-src")?.includes("https://static.cloudflareinsights.com"));
  assert.ok(policy.get("connect-src")?.includes("https://*.r2.cloudflarestorage.com"));
  for (const host of ["https://www.youtube.com", "https://clips.twitch.tv", "https://player.twitch.tv", "https://kick.com", "https://player.kick.com", "https://streamable.com"]) {
    assert.ok(policy.get("frame-src")?.includes(host), `frame-src lacks ${host}`);
  }
  assert.ok(policy.get("frame-src")?.includes("blob:"), "the ID-review PDF viewer uses blob: frames");
});

test("an API on another origin (the private test site) is allowed and receives the reports", () => {
  const csp = contentSecurityPolicies({ dev: true, apiOrigin: "http://127.0.0.2:4010" });
  const policy = directives(csp.reportOnly);
  assert.ok(policy.get("connect-src")?.includes("http://127.0.0.2:4010"));
  assert.ok(policy.get("connect-src")?.includes("ws://127.0.0.2:4010"));
  assert.deepEqual(policy.get("report-uri"), ["http://127.0.0.2:4010/api/errors/csp"]);
  assert.equal(csp.reportUri, "http://127.0.0.2:4010/api/errors/csp");
  // Chrome never delivers report-to reports over http and then ignores report-uri, so http gets report-uri only.
  assert.equal(policy.has("report-to"), false);
  assert.equal(csp.reportingApi, false);
  assert.ok(directives(contentSecurityPolicies({ dev: false, apiOrigin: "https://api.example.com/" }).reportOnly).get("connect-src")?.includes("wss://api.example.com"));
});
