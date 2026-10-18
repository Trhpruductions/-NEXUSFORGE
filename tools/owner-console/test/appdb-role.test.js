"use strict";

// The console's database reads use the read-only role file when it exists. These tests use temporary files only.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readOnlyRoleUrl } = require("../lib/appdb");

function tempFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "console-role-"));
  const file = path.join(dir, "schema-readonly.env");
  if (contents !== null) fs.writeFileSync(file, contents);
  return file;
}

test("the role URL is read from the role file", () => {
  const file = tempFile("SCHEMA_READONLY_DATABASE_URL=postgresql://role:pw@127.0.0.1:5433/db\n");
  assert.equal(readOnlyRoleUrl(file), "postgresql://role:pw@127.0.0.1:5433/db");
});

test("a missing role file gives no URL, so the caller can fall back", () => {
  assert.equal(readOnlyRoleUrl(path.join(os.tmpdir(), "does-not-exist-console-role.env")), null);
});

test("a role file without the expected key gives no URL", () => {
  assert.equal(readOnlyRoleUrl(tempFile("SOMETHING_ELSE=1\n")), null);
});

test("the role file must have the key at the start of a line", () => {
  assert.equal(readOnlyRoleUrl(tempFile("# SCHEMA_READONLY_DATABASE_URL=postgresql://x\n")), null);
});
