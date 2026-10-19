import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keepsProfilePerksWithoutPlan } from "../src/routes/auth.routes.js";

// Paid profile perks (banner, animated avatar) used to be skipped for one tester by a username
// written into auth.routes.ts. The rule is now the lifetime membership recorded on the account.
// No database: the rule is a plain function, and the source check only reads files.

test("lifetime members keep the profile perks; everyone else follows their plan", () => {
  assert.equal(keepsProfilePerksWithoutPlan({ lifetimeMember: true }), true);
  assert.equal(keepsProfilePerksWithoutPlan({ lifetimeMember: false }), false);
  assert.equal(keepsProfilePerksWithoutPlan(null), false);
  assert.equal(keepsProfilePerksWithoutPlan(undefined), false);
});

test("the rule looks at the account's flag, not its name", () => {
  // The old hard-coded tester name gets nothing by itself.
  const renamed = { lifetimeMember: false, username: "jacksongaming69" } as { lifetimeMember: boolean };
  assert.equal(keepsProfilePerksWithoutPlan(renamed), false);
});

test("no server code grants anything to a username written into the code", async () => {
  const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
  const files: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".ts")) files.push(full);
    }
  };
  await walk(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (/jacksongaming69/i.test(text) || /BypassUsers\s*=\s*new Set\(\s*\[/.test(text)) offenders.push(path.relative(srcDir, file));
  }
  assert.deepEqual(offenders, []);
});
