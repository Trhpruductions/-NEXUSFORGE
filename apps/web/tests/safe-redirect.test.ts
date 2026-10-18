import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "../src/lib/safe-redirect";

test("paths on this site are kept, with their query and hash", () => {
  assert.equal(safeRedirectPath("/app"), "/app");
  assert.equal(safeRedirectPath("/app/chat?forge=abc&voice=1"), "/app/chat?forge=abc&voice=1");
  assert.equal(safeRedirectPath("/app/settings?section=appearance#layout"), "/app/settings?section=appearance#layout");
  assert.equal(safeRedirectPath("/oauth/authorize?client_id=x&redirect_uri=https%3A%2F%2Fapp.example.com"), "/oauth/authorize?client_id=x&redirect_uri=https%3A%2F%2Fapp.example.com");
});

test("nothing, or anything that isn't a path on this site, is refused", () => {
  for (const value of [null, undefined, "", "app", "https://evil.com", "javascript:alert(1)", "//evil.com", "///evil.com"]) {
    assert.equal(safeRedirectPath(value), null, String(value));
  }
});

test("tricks that browsers turn into another site are refused", () => {
  for (const value of ["/\\evil.com", "/\\/evil.com", "/%09/evil.com", "/%2F/evil.com", "/%5Cevil.com", "/\t/evil.com", "/ /evil.com", "/%00/evil.com"]) {
    assert.equal(safeRedirectPath(value), null, value);
  }
});

test("very long values are refused", () => {
  assert.equal(safeRedirectPath(`/${"a".repeat(3000)}`), null);
});
