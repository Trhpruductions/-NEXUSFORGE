import test from "node:test";
import assert from "node:assert/strict";
import { checkUrl, isBlockedAddress, parsePreview } from "../src/lib/link-preview.js";

test("private, loopback and reserved addresses are blocked", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isBlockedAddress(address), false, address);
});

test("only plain http(s) URLs on standard ports pass", () => {
  assert.ok(checkUrl("https://example.com/page"));
  assert.equal(checkUrl("ftp://example.com"), null);
  assert.equal(checkUrl("file:///etc/passwd"), null);
  assert.equal(checkUrl("http://127.0.0.1/admin"), null);
  assert.equal(checkUrl("http://[::1]/"), null);
  assert.equal(checkUrl("http://localhost:4001/api"), null);
  assert.equal(checkUrl("https://example.com:8443/"), null);
  assert.equal(checkUrl("https://user:pass@example.com/"), null);
  assert.equal(checkUrl("http://169.254.169.254/latest/meta-data"), null);
});

test("Open Graph tags are read, decoded and trimmed", () => {
  const html = `<html><head><title>Fallback</title>
    <meta property="og:title" content="Raid &amp; Chill">
    <meta property="og:description" content="Join   the squad">
    <meta property="og:site_name" content="Example">
    <meta property="og:image" content="/cover.png">
    <meta name="theme-color" content="#22d3ee"></head></html>`;
  const preview = parsePreview(html, "https://example.com/events/1");
  assert.equal(preview.title, "Raid & Chill");
  assert.equal(preview.description, "Join the squad");
  assert.equal(preview.siteName, "Example");
  assert.equal(preview.image, "https://example.com/cover.png");
  assert.equal(preview.color, "#22d3ee");
});

test("an image pointing at a private address is dropped", () => {
  const preview = parsePreview(`<meta property="og:title" content="x"><meta property="og:image" content="http://10.0.0.5/secret.png">`, "https://example.com/");
  assert.equal(preview.image, null);
});
