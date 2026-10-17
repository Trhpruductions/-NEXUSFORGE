import test from "node:test";
import assert from "node:assert/strict";

// discord-link.ts imports prisma, which needs DATABASE_URL; the code generator itself is pure.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { generateLinkCode } = await import("../src/lib/discord-link.js");

test("link codes are 8 easy-to-type characters", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const code = generateLinkCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/, "no 0, O, 1 or I");
    seen.add(code);
  }
  assert.ok(seen.size > 495, "codes don't repeat");
});
