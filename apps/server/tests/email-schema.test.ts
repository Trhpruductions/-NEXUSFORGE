import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Checks the Prisma schema text, not a database. It guards the email delivery record's privacy rule: the table
// never stores a message body, a token, a code, or a link. It does not prove the live database has the table.
const here = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(here, "..", "prisma", "schema.prisma"), "utf8");

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `model ${name} exists in schema.prisma`);
  return match[1];
}

test("EmailMessage stores a recipient hash and a masked address, never a plain address", () => {
  const body = modelBlock("EmailMessage");
  assert.match(body, /recipientHash\s+String/);
  assert.match(body, /recipientMasked\s+String/);
  assert.doesNotMatch(body, /^\s*(email|recipient|address|to)\s+String/im, "no plain recipient column");
});

test("EmailMessage has no column for a body, token, code, or link", () => {
  const body = modelBlock("EmailMessage");
  for (const forbidden of ["body", "html", "text", "token", "code", "link", "url", "password"]) {
    assert.doesNotMatch(body, new RegExp(`^\\s*${forbidden}\\s+`, "im"), `no "${forbidden}" column`);
  }
});

test("EmailMessage status and category are enums with the values the code expects", () => {
  assert.match(schema, /enum EmailMessageStatus \{[^}]*QUEUED[^}]*UNKNOWN[^}]*\}/s);
  assert.match(schema, /enum EmailCategory \{\s*ESSENTIAL\s*OPTIONAL\s*\}/s);
  assert.match(modelBlock("EmailMessage"), /status\s+EmailMessageStatus/);
});

test("the change-email verification purpose exists", () => {
  assert.match(schema, /enum VerificationPurpose \{[^}]*CHANGE_EMAIL[^}]*\}/s);
});
