import test from "node:test";
import assert from "node:assert/strict";

// usernames.ts imports prisma, which needs DATABASE_URL; the rule check itself is pure.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { usernameProblem } = await import("../src/lib/usernames.js");

test("normal names are fine", () => {
  for (const name of ["atlasops", "Player_One", "abc", "x".repeat(32), "  padded_ok  "]) assert.equal(usernameProblem(name), null, name);
});

test("names @mentions can't reach are refused", () => {
  for (const name of ["ab", "x".repeat(33), "has space", "dot.name", "at@sign", "zero​width", "émile", ""]) {
    assert.match(usernameProblem(name) ?? "", /3 to 32/, name);
  }
});

test("reserved names are refused, in any case", () => {
  for (const name of ["admin", "Vexora", "EVERYONE", "here", "vexora_staff", "Support"]) assert.equal(usernameProblem(name), "That username is reserved.", name);
});
