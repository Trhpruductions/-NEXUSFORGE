import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { pushUrlFor } = await import("../src/lib/push.js");

test("tapping a push opens the right place", () => {
  assert.equal(pushUrlFor({ forgeId: "f1", channelId: "c1", messageId: "m1" }), "/app/chat?forge=f1&channel=c1");
  assert.equal(pushUrlFor({ threadId: "t1", messageId: "m1" }), "/app/chat?dm=t1", "a DM");
  assert.equal(pushUrlFor({ ticketId: "s1" }), "/app/support?ticket=s1");
  assert.equal(pushUrlFor(null), "/app/notifications");
  assert.equal(pushUrlFor({ forgeId: "a&b", channelId: "c" }), "/app/chat?forge=a%26b&channel=c", "values are escaped");
});
