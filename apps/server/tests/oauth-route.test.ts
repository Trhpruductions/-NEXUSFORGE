import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret-0123456789abcdef0123456789ab";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-0123456789abcdef";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost:5432/test";

const { issueAuthorizationCode, issueClientCredentialsToken, parseExpiresInSeconds } = await import(
  "../src/routes/oauth.routes.js"
);

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("parseExpiresInSeconds converts time suffixes correctly", () => {
  assert.equal(parseExpiresInSeconds("15s"), 15);
  assert.equal(parseExpiresInSeconds("2m"), 120);
  assert.equal(parseExpiresInSeconds("1h"), 3600);
  assert.equal(parseExpiresInSeconds("3d"), 259200);
  assert.equal(parseExpiresInSeconds("42"), 42);
  assert.equal(parseExpiresInSeconds("invalid"), 0);
});

test("issueClientCredentialsToken rejects unsupported grant types", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "authorization_code",
    client_id: "client-1",
    client_secret: "secret",
    db: {
      oAuthClient: { findUnique: async () => null },
      user: { findUnique: async () => null },
    },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_request");
});

test("issueClientCredentialsToken rejects missing or disabled client", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "client_credentials",
    client_id: "missing-client",
    client_secret: "secret",
    db: {
      oAuthClient: { findUnique: async () => null },
      user: { findUnique: async () => null },
    },
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid_client");
});

test("issueClientCredentialsToken rejects invalid client secret", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "client_credentials",
    client_id: "valid-client",
    client_secret: "wrong-secret",
    db: {
      oAuthClient: {
        findUnique: async () => ({
          id: "client-123",
          userId: "user-123",
          clientSecretHash: sha256("correct-secret"),
          enabled: true,
        }),
      },
      user: { findUnique: async () => ({ id: "user-123", username: "test-user", email: "test@example.com", appRole: "USER" }) },
    },
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid_client");
});

test("issueClientCredentialsToken issues a bearer token for valid client credentials", async () => {
  const result = await issueClientCredentialsToken({
    grant_type: "client_credentials",
    client_id: "valid-client",
    client_secret: "correct-secret",
    db: {
      oAuthClient: {
        findUnique: async () => ({
          id: "client-123",
          userId: "user-123",
          clientSecretHash: sha256("correct-secret"),
          enabled: true,
        }),
      },
      user: {
        findUnique: async () => ({
          id: "user-123",
          username: "test-user",
          email: "test@example.com",
          appRole: "ADMIN",
        }),
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.token_type, "Bearer");
  assert.ok(typeof result.body.access_token === "string" && result.body.access_token.length > 0);
  assert.ok(result.body.expires_in > 0);
  assert.strictEqual(result.body.access_token.split(".").length, 3);
});

test("issueAuthorizationCode creates and redirects with a valid client", async () => {
  const clientId = "valid-client";
  const redirectUri = "https://app.example.com/oauth/callback";

  const result = await issueAuthorizationCode({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile",
    state: "test-state",
    db: {
      oAuthClient: {
        findUnique: async () => ({
          clientId,
          enabled: true,
          redirectUris: [redirectUri],
        }),
      },
      oAuthAuthorizationCode: {
        create: async ({ data }) => ({ ...data }),
      },
    },
    user: { id: "user-123" },
  });

  assert.equal(result.status, 302);
  assert.ok(typeof result.body.redirect_uri === "string");
  assert.ok(result.body.redirect_uri.startsWith(`${redirectUri}?code=`));
  assert.ok(result.body.redirect_uri.includes("&state=test-state"));
});

test("issueClientCredentialsToken issues a bearer token for a valid authorization code grant", async () => {
  const code = "authorization-code-abc";
  const clientId = "valid-client";
  const redirectUri = "https://app.example.com/oauth/callback";

  const result = await issueClientCredentialsToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: "correct-secret",
    code,
    redirect_uri: redirectUri,
    db: {
      oAuthClient: {
        findUnique: async () => ({
          id: "client-123",
          userId: "user-123",
          clientId,
          clientSecretHash: sha256("correct-secret"),
          enabled: true,
        }),
      },
      oAuthAuthorizationCode: {
        findUnique: async () => ({
          id: "code-123",
          clientId,
          redirectUri,
          expiresAt: new Date(Date.now() + 1000 * 60),
          usedAt: null,
          client: { clientId },
          user: { id: "user-123", username: "auth-user", email: "auth@example.com", appRole: "USER" },
        }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      user: {
        findUnique: async () => null,
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.token_type, "Bearer");
  assert.ok(typeof result.body.access_token === "string" && result.body.access_token.length > 0);
  assert.ok(result.body.expires_in > 0);
});
