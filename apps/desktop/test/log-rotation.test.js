"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRotatingLog, formatConsoleMessage, DEFAULT_MAX_BYTES } = require("../lib/log-rotation");

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "nf-log-rotation-"));
const size = (file) => (fs.existsSync(file) ? fs.statSync(file).size : 0);

test("the log stays under its cap: the old file moves to .1 and a new one starts", () => {
  const file = path.join(tempDir(), "startup.log");
  const log = createRotatingLog(file, { maxBytes: 1000 });
  for (let index = 0; index < 100; index += 1) {
    log.append(`line ${String(index).padStart(3, "0")} ${"x".repeat(40)}\n`);
  }
  assert.ok(size(file) <= 1000, `current file ${size(file)} bytes`);
  assert.ok(size(`${file}.1`) <= 1000, `backup ${size(`${file}.1`)} bytes`);
  assert.equal(fs.existsSync(`${file}.2`), false, "only one backup is kept");
  const current = fs.readFileSync(file, "utf8");
  assert.ok(current.includes("line 099"), "the newest line is always kept");
  const backup = fs.readFileSync(`${file}.1`, "utf8");
  assert.ok(!backup.includes("line 000"), "the oldest lines are gone");
});

test("an existing oversized log from an older version keeps only its newest part", () => {
  const file = path.join(tempDir(), "startup.log");
  const lines = [];
  for (let index = 0; index < 5000; index += 1) lines.push(`old line ${index}`);
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  assert.ok(size(file) > 50000);
  const log = createRotatingLog(file, { maxBytes: 2000 });
  log.append("new line\n");
  assert.equal(fs.readFileSync(file, "utf8"), "new line\n");
  const backup = fs.readFileSync(`${file}.1`, "utf8");
  assert.ok(size(`${file}.1`) <= 2000);
  assert.ok(backup.endsWith("old line 4999\n"), "the newest old lines are kept");
  assert.ok(backup.startsWith("old line "), "the backup starts at a whole line");
});

test("a log under the cap is appended to as before", () => {
  const file = path.join(tempDir(), "startup.log");
  fs.writeFileSync(file, "existing\n");
  const log = createRotatingLog(file, { maxBytes: 1000 });
  log.append("next\n");
  assert.equal(fs.readFileSync(file, "utf8"), "existing\nnext\n");
  assert.equal(fs.existsSync(`${file}.1`), false);
});

test("a single huge line is shortened instead of filling the log", () => {
  const file = path.join(tempDir(), "startup.log");
  const log = createRotatingLog(file, { maxBytes: 100000 });
  log.append(`${"y".repeat(50000)}\n`);
  assert.ok(size(file) < 2100);
  assert.ok(fs.readFileSync(file, "utf8").includes("[truncated]"));
});

test("logging never throws, even when the folder is missing", () => {
  const log = createRotatingLog(path.join(tempDir(), "missing", "deeper", "startup.log"), { maxBytes: 100 });
  assert.doesNotThrow(() => log.append("hello\n"));
});

test("the default cap keeps about 5 MB in total", () => {
  assert.equal(DEFAULT_MAX_BYTES, Math.floor(2.5 * 1024 * 1024));
});

test("page console messages: only warnings and errors are logged, shortened, without the query", () => {
  assert.equal(formatConsoleMessage({ level: "info", message: "hello", lineNumber: 1, sourceId: "https://nfgcord.com/a.js" }), null);
  assert.equal(formatConsoleMessage({ level: "debug", message: "hello" }), null);
  assert.equal(formatConsoleMessage({ level: 1, message: "legacy info" }), null);
  const line = formatConsoleMessage({ level: "error", message: "boom\n  at x", lineNumber: 7, sourceId: "https://nfgcord.com/_next/app.js?token=secret#frag" });
  assert.equal(line, "[renderer-console] level=error line=7 source=https://nfgcord.com/_next/app.js msg=boom at x");
  assert.ok(formatConsoleMessage({ level: 2, message: "legacy warning" }).includes("level=warning"));
  const long = formatConsoleMessage({ level: "warning", message: "z".repeat(5000), sourceId: "" });
  assert.ok(long.length < 700);
});
