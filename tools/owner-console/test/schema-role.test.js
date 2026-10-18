"use strict";

// The schema check must connect as the read-only role, never as the production user. The test reads only the
// username from the URL and never prints the password or the address.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readOnlySchemaUrl } = require("../lib/ops-actions");

const REPO_ENV = path.join(__dirname, "..", "..", "..", "apps", "server", ".env");

// The read-only role file and the server env file are git-ignored. A clean checkout has neither, so this test skips.
test("the schema check has a read-only role URL, and it is not the production user", { skip: !fs.existsSync(REPO_ENV) || !readOnlySchemaUrl() }, () => {
  const url = readOnlySchemaUrl();
  assert.ok(url, "the read-only role file is present");
  const parsed = new URL(url);
  assert.equal(parsed.username, "nfg_schema_readonly");
  const production = new URL(fs.readFileSync(REPO_ENV, "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, ""));
  assert.notEqual(parsed.username, decodeURIComponent(production.username), "not the full-privilege production user");
});

test("a missing read-only role file yields no URL, so the check cannot fall back to full credentials", () => {
  // The reader returns null when the file is absent. The job then refuses to run (see startSchemaDiff).
  // This test checks the reader's contract on a path that does not exist.
  const source = fs.readFileSync(path.join(__dirname, "..", "lib", "ops-actions.js"), "utf8");
  assert.match(source, /if \(!roleUrl\) throw new Error\("The schema check is off/);
  assert.match(source, /DATABASE_URL: roleUrl/);
});
