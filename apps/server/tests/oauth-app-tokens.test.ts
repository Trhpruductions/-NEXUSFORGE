import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Throwaway secrets and no real database (every database call below is a stand-in).
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret-0123456789abcdef0123456789ab";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-0123456789abcdef";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost:5432/test";

const { issueClientCredentialsToken, userInfoFor } = await import("../src/routes/oauth.routes.js");
const { verifyAccessToken, isAppToken, signAccessToken } = await import("../src/lib/jwt.js");
const { appTokenAllowed } = await import("../src/middleware/auth.js");

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const client = { id: "client-row", userId: "dev-1", clientId: "app-1", clientSecretHash: sha256("secret"), enabled: true };

test("a token issued to an app through sign-in is marked as an app token, with the approved scope and no staff role", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "authorization_code",
    client_id: "app-1",
    client_secret: "secret",
    code: "code-1",
    redirect_uri: "https://app.example.com/cb",
    db: {
      oAuthClient: { findUnique: async () => client },
      oAuthAuthorizationCode: {
        findUnique: async () => ({
          id: "code-row",
          clientId: "app-1",
          redirectUri: "https://app.example.com/cb",
          scope: "identify email",
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
          client: { clientId: "app-1" },
          // An admin approving an app must not hand it admin powers.
          user: { id: "admin-1", username: "boss", email: "boss@example.test", appRole: "ADMIN" },
        }),
        update: async () => ({}),
        updateMany: async () => ({ count: 1 }),
      },
      user: { findUnique: async () => null },
    },
  });
  assert.equal(result.status, 200);
  const payload = verifyAccessToken((result.body as { access_token: string }).access_token);
  assert.equal(isAppToken(payload), true);
  assert.equal(payload.cid, "app-1");
  assert.equal(payload.scope, "identify email");
  assert.equal(payload.appRole, "USER");
});

test("a client-credentials token is an app token too (a leaked secret gives basic profile access only)", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "client_credentials",
    client_id: "app-1",
    client_secret: "secret",
    db: {
      oAuthClient: { findUnique: async () => client },
      oAuthAuthorizationCode: { findUnique: async () => null, update: async () => ({}), updateMany: async () => ({ count: 0 }) },
      user: { findUnique: async () => ({ id: "dev-1", username: "dev", email: "dev@example.test", appRole: "OWNER" }) },
    },
  });
  const payload = verifyAccessToken((result.body as { access_token: string }).access_token);
  assert.equal(isAppToken(payload), true);
  assert.equal(payload.appRole, "USER");
});

test("Nexus Forge's own sign-in tokens are not app tokens", () => {
  const payload = verifyAccessToken(signAccessToken({ sub: "u1", username: "me", email: "me@example.test", appRole: "ADMIN", jti: "j1" }));
  assert.equal(isAppToken(payload), false);
});

test("app tokens are allowed only on the profile endpoint", () => {
  assert.equal(appTokenAllowed("GET", "/api/oauth/userinfo"), true);
  assert.equal(appTokenAllowed("get", "/api/oauth/userinfo?x=1"), true);
  assert.equal(appTokenAllowed("POST", "/api/oauth/userinfo"), false);
  assert.equal(appTokenAllowed("GET", "/api/dms/threads"), false);
  assert.equal(appTokenAllowed("GET", "/api/admin/users"), false);
  assert.equal(appTokenAllowed("POST", "/api/oauth/authorize/approve"), false);
  assert.equal(appTokenAllowed("GET", "/api/auth/me"), false);
});

test("profile info shows the email only with the email scope", () => {
  const user = { id: "u1", username: "me", displayName: "Me", avatar: null, email: "me@example.test" };
  assert.deepEqual(userInfoFor(user, "identify"), { id: "u1", username: "me", display_name: "Me", avatar: null });
  assert.equal(userInfoFor(user, "identify email").email, "me@example.test");
  assert.equal(userInfoFor(user, undefined).email, undefined);
});
