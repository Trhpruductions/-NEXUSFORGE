import test from "node:test";
import assert from "node:assert/strict";

// push.ts imports prisma, which needs DATABASE_URL; the check tested here is pure.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { isAllowedPushEndpoint, MAX_PUSH_SUBSCRIPTIONS_PER_USER } = await import("../src/lib/push.js");

test("subscriptions from the browsers' real push services are accepted", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/dXJ0aGVyZQ:APA91bH", // Chrome, Brave, Opera, Samsung Internet
    "https://fcm.googleapis.com/wp/dXJ0aGVyZQ", // newer Chrome format
    "https://wns2-bn3p.notify.windows.com/w/?token=BQYAAAB", // Edge on Windows
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk", // Firefox
    "https://web.push.apple.com/QGuQyavXutnMH8", // Safari
    "https://FCM.googleapis.com:443/fcm/send/x", // case and explicit default port
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);
  }
});

test("anything else is refused (no blind requests to arbitrary or internal addresses)", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/x", // not https
    "https://127.0.0.1/push",
    "https://localhost:4001/api/admin",
    "https://169.254.169.254/latest/meta-data",
    "https://example.com/push",
    "https://fcm.googleapis.com.evil.example/x", // look-alike host
    "https://evilnotify.windows.com/w/", // suffix without the dot
    "https://notify.windows.com/w/", // bare suffix
    "https://fcm.googleapis.com:8443/x", // other port
    "https://user:pass@fcm.googleapis.com/x", // credentials in the URL
    "https://evil.example/@fcm.googleapis.com/x",
    "ftp://fcm.googleapis.com/x",
    "not a url",
    "",
    `https://fcm.googleapis.com/${"a".repeat(2100)}`, // absurdly long
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
  }
  assert.equal(isAllowedPushEndpoint(undefined), false);
  assert.equal(isAllowedPushEndpoint({ endpoint: "https://fcm.googleapis.com/x" }), false);
});

test("each account keeps at most 10 push devices", () => {
  assert.equal(MAX_PUSH_SUBSCRIPTIONS_PER_USER, 10);
});
