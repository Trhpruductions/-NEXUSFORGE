import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Regression guard: every form that carries a password, code or address must declare method="post".
// Without it, a form submitted before its scripts load falls back to GET and puts the values in the URL.
const AUTH_FORMS = [
  "../src/app/(auth)/login/page.tsx",
  "../src/app/(auth)/register/page.tsx",
  "../src/app/(auth)/forgot-password/page.tsx",
  "../src/components/auth/reset-password-client.tsx",
  "../src/components/auth/vac-appeal-form.tsx",
];

for (const file of AUTH_FORMS) {
  test(`every form in ${file} posts, not gets`, () => {
    const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
    const opens = [...source.matchAll(/<form\b/g)].map((match) => match.index ?? 0);
    assert.ok(opens.length > 0, "the file has at least one form");
    for (const start of opens) {
      const tag = source.slice(start, start + 400);
      const end = tag.indexOf(">\n") === -1 ? tag.length : tag.indexOf(">\n");
      const head = tag.slice(0, end);
      assert.match(head, /method="post"/, `form at offset ${start} in ${file} has method="post"`);
    }
  });
}
