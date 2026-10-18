import test from "node:test";
import assert from "node:assert/strict";

// error-log.ts imports prisma, which needs DATABASE_URL; the helpers tested here are pure.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { cleanPath, errorFingerprint } = await import("../src/lib/error-log.js");

test("paths lose query strings (no reset tokens in the log) and ids", () => {
  assert.equal(cleanPath("/api/auth/reset-password?token=secret123"), "/api/auth/reset-password");
  assert.equal(cleanPath("https://app.example/app/forge/6f1c2a9e-1b2c-4d5e-8f90-1234567890ab/chat?x=1"), "/app/forge/:id/chat");
  assert.equal(cleanPath("/api/messages/123456/pin"), "/api/messages/:n/pin");
  assert.equal(cleanPath(null), null);
});

test("the same bug with different numbers groups together", () => {
  const stack = "Error: boom\n    at handler (/srv/app/dist/routes/x.js:10:5)";
  const a = errorFingerprint({ source: "server", message: "Row 17 failed", stack, path: "/api/x/111111" });
  const b = errorFingerprint({ source: "server", message: "Row 18 failed", stack: stack.replace(":10:5", ":10:9"), path: "/api/x/222222" });
  assert.equal(a, b);
});

test("different bugs, or the same message from web vs server, stay separate", () => {
  const base = { message: "boom", stack: "Error: boom\n    at a (/srv/a.js:1:1)", path: "/x" };
  assert.notEqual(errorFingerprint({ source: "server", ...base }), errorFingerprint({ source: "web", ...base }));
  assert.notEqual(
    errorFingerprint({ source: "web", ...base }),
    errorFingerprint({ source: "web", ...base, stack: "Error: boom\n    at b (/srv/b.js:1:1)" }),
  );
});
