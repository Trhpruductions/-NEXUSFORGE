import { randomBytes } from "node:crypto";
import { type Request, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, sha256, verifyAccessToken, randomToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const oauthAuthorizeSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

const oauthTokenSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("client_credentials"),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
  }),
  z.object({
    grant_type: z.literal("authorization_code"),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    code: z.string().min(1),
    redirect_uri: z.string().url(),
  }),
]);

const REFRESH_COOKIE_NAME = "nf_refresh";

export function parseExpiresInSeconds(expiresIn: string): number {
  const match = expiresIn.match(/^([0-9]+)(s|m|h|d)?$/);
  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2] || "s";

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 24 * 60 * 60;
    default:
      return value;
  }
}

export async function issueClientCredentialsToken(
  data: {
    grant_type: string;
    client_id: string;
    client_secret: string;
    code?: string;
    redirect_uri?: string;
  } & {
    db: {
      oAuthClient: {
        findUnique: (args: { where: { clientId: string }; select: Record<string, boolean> }) => Promise<
          | { id: string; userId: string; clientSecretHash: string; enabled: boolean; clientId: string }
          | null
        >;
      };
      oAuthAuthorizationCode: {
        findUnique: (args: { where: { codeHash: string }; include: { client: boolean; user: boolean } }) => Promise<
          | {
              id: string;
              clientId: string;
              redirectUri: string;
              scope?: string | null;
              expiresAt: Date;
              usedAt: Date | null;
              client: { clientId: string };
              user: { id: string; username: string; email: string; appRole?: string | null };
            }
          | null
        >;
        update: (args: { where: { id: string }; data: { usedAt: Date } }) => Promise<unknown>;
        updateMany: (args: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => Promise<{ count: number }>;
      };
      user: {
        findUnique: (args: { where: { id: string }; select: Record<string, boolean> }) => Promise<
          | { id: string; username: string; email: string; appRole?: string | null }
          | null
        >;
      };
    };
  },
) {
  const parsed = oauthTokenSchema.safeParse(data);

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: "invalid_request",
        error_description: "Invalid OAuth token request payload.",
        details: parsed.error.flatten(),
      },
    } as const;
  }

  const client = await data.db.oAuthClient.findUnique({
    where: { clientId: parsed.data.client_id },
    select: {
      id: true,
      userId: true,
      clientId: true,
      clientSecretHash: true,
      enabled: true,
    },
  });

  if (!client || !client.enabled) {
    return {
      status: 401,
      body: { error: "invalid_client", error_description: "Client authentication failed." },
    } as const;
  }

  const submittedHash = sha256(parsed.data.client_secret);
  if (submittedHash !== client.clientSecretHash) {
    return {
      status: 401,
      body: { error: "invalid_client", error_description: "Client authentication failed." },
    } as const;
  }

  if (parsed.data.grant_type === "authorization_code") {
    const authorizationCode = await data.db.oAuthAuthorizationCode.findUnique({
      where: { codeHash: sha256(parsed.data.code) },
      include: { client: true, user: true },
    });

    if (
      !authorizationCode ||
      authorizationCode.usedAt ||
      authorizationCode.expiresAt < new Date() ||
      authorizationCode.clientId !== client.clientId ||
      authorizationCode.redirectUri !== parsed.data.redirect_uri
    ) {
      return {
        status: 400,
        body: { error: "invalid_grant", error_description: "Authorization code is invalid or has expired." },
      } as const;
    }

    // Claim the code atomically: two requests racing with the same code get one token.
    const claimed = await data.db.oAuthAuthorizationCode.updateMany({
      where: { id: authorizationCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return {
        status: 400,
        body: { error: "invalid_grant", error_description: "Authorization code is invalid or has expired." },
      } as const;
    }

    const user = authorizationCode.user;
    // An app token: marked with the app's client id, limited to what the user approved, and never carrying the
    // user's staff role (an admin who authorises an app must not hand it admin powers).
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      appRole: "USER",
      jti: randomToken(16),
      cid: client.clientId,
      scope: authorizationCode.scope ?? undefined,
    });

    return {
      status: 200,
      body: {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: parseExpiresInSeconds(env.ACCESS_TOKEN_EXPIRES_IN),
      },
    } as const;
  }

  const user = await data.db.user.findUnique({
    where: { id: client.userId },
    select: { id: true, username: true, email: true, appRole: true },
  });

  if (!user) {
    return {
      status: 401,
      body: { error: "invalid_client", error_description: "Client account is invalid." },
    } as const;
  }

  // The app acting as its developer's own account: still an app token, so a leaked client secret gives basic
  // profile access only, never the developer's full account (or staff powers) without two-factor sign-in.
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    appRole: "USER",
    jti: randomToken(16),
    cid: client.clientId,
    scope: "identify",
  });

  return {
    status: 200,
    body: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: parseExpiresInSeconds(env.ACCESS_TOKEN_EXPIRES_IN),
    },
  } as const;
}

/** What an app may read about the signed-in user: basic profile, and the email address only with the "email" scope. */
export function userInfoFor(user: { id: string; username: string; displayName?: string | null; avatar?: string | null; email?: string | null }, scope: string | undefined) {
  const scopes = new Set((scope ?? "").split(/\s+/).filter(Boolean));
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName ?? null,
    avatar: user.avatar ?? null,
    ...(scopes.has("email") && user.email ? { email: user.email } : {}),
  };
}


export async function issueAuthorizationCode(
  data: {
    response_type: string;
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state?: string;
    db: {
      oAuthClient: {
        findUnique: (args: { where: { clientId: string }; select: Record<string, boolean> }) => Promise<
          | { clientId: string; enabled: boolean; redirectUris: string[] }
          | null
        >;
      };
      oAuthAuthorizationCode: {
        create: (args: {
          data: {
            clientId: string;
            userId: string;
            codeHash: string;
            redirectUri: string;
            scope?: string;
            expiresAt: Date;
          };
        }) => Promise<unknown>;
      };
    };
    user: { id: string };
  },
) {
  const parsed = oauthAuthorizeSchema.safeParse({
    response_type: data.response_type,
    client_id: data.client_id,
    redirect_uri: data.redirect_uri,
    scope: data.scope,
    state: data.state,
  });

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: "invalid_request",
        error_description: "Invalid OAuth authorization request payload.",
        details: parsed.error.flatten(),
      },
    } as const;
  }

  const client = await data.db.oAuthClient.findUnique({
    where: { clientId: parsed.data.client_id },
    select: { clientId: true, enabled: true, redirectUris: true },
  });

  if (!client || !client.enabled) {
    return {
      status: 401,
      body: { error: "unauthorized_client", error_description: "OAuth client is invalid or disabled." },
    } as const;
  }

  if (!client.redirectUris.includes(parsed.data.redirect_uri)) {
    return {
      status: 400,
      body: { error: "invalid_request", error_description: "Redirect URI is not registered for this client." },
    } as const;
  }

  const code = randomBytes(24).toString("hex");
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

  await data.db.oAuthAuthorizationCode.create({
    data: {
      clientId: client.clientId,
      userId: data.user.id,
      codeHash,
      redirectUri: parsed.data.redirect_uri,
      scope: parsed.data.scope,
      expiresAt,
    },
  });

  const separator = parsed.data.redirect_uri.includes("?") ? "&" : "?";
  return {
    status: 302,
    body: {
      redirect_uri: `${parsed.data.redirect_uri}${separator}code=${encodeURIComponent(code)}${parsed.data.state ? `&state=${encodeURIComponent(parsed.data.state)}` : ""}`,
    },
  } as const;
}

export const oauthRouter = Router();

/**
 * Step 1 of "Sign in with Nexus Forge": never issues anything by itself. It sends the browser to
 * the approval page in the app, which shows the app's name and what it gets. (It used to
 * hand out a code straight away, even from just the sign-in cookie, so any registered app
 * could take over whoever opened its link.)
 */
oauthRouter.get("/authorize", (req, res) => {
  const params = new URLSearchParams();
  for (const key of ["response_type", "client_id", "redirect_uri", "scope", "state"]) {
    const value = req.query[key];
    if (typeof value === "string") params.set(key, value);
  }
  res.redirect(`${env.APP_WEB_URL.replace(/\/+$/, "")}/oauth/authorize?${params.toString()}`);
});

/** Validates a request and returns what the approval page shows. */
async function describeRequest(clientId: unknown, redirectUri: unknown) {
  if (typeof clientId !== "string" || typeof redirectUri !== "string") return null;
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { name: true, enabled: true, redirectUris: true, createdAt: true, user: { select: { username: true } } },
  });
  if (!client || !client.enabled || !client.redirectUris.includes(redirectUri)) return null;
  let host = redirectUri;
  try {
    host = new URL(redirectUri).host;
  } catch {
    /* keep the raw value */
  }
  return { name: client.name, developer: client.user.username, createdAt: client.createdAt, redirectHost: host };
}

oauthRouter.get("/authorize/info", requireAuth, async (req, res) => {
  const app = await describeRequest(req.query.client_id, req.query.redirect_uri);
  if (!app) {
    res.status(400).json({ error: "This sign-in link isn't valid: the app doesn't exist, is disabled, or the return address isn't registered." });
    return;
  }
  res.json({ app });
});

/** Step 2: you pressed Allow (signed in, with CSRF). Issue the code and say where to go. */
oauthRouter.post("/authorize/approve", requireAuth, requireCsrf, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await issueAuthorizationCode({
    response_type: String(body.response_type ?? ""),
    client_id: String(body.client_id ?? ""),
    redirect_uri: String(body.redirect_uri ?? ""),
    scope: typeof body.scope === "string" ? body.scope : undefined,
    state: typeof body.state === "string" ? body.state : undefined,
    db: prisma,
    user: { id: req.user!.id },
  });
  if (result.status === 302) {
    res.json({ redirect: result.body.redirect_uri });
    return;
  }
  res.status(result.status).json(result.body);
});

/** You pressed Cancel: tell the app, the standard way. */
oauthRouter.post("/authorize/deny", requireAuth, requireCsrf, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const app = await describeRequest(body.client_id, body.redirect_uri);
  if (!app) {
    res.status(400).json({ error: "This sign-in link isn't valid." });
    return;
  }
  const redirectUri = String(body.redirect_uri);
  const separator = redirectUri.includes("?") ? "&" : "?";
  const state = typeof body.state === "string" ? `&state=${encodeURIComponent(body.state)}` : "";
  res.json({ redirect: `${redirectUri}${separator}error=access_denied${state}` });
});

/**
 * Who signed in, for an app holding an app token (the one route such tokens may use): id, username, display
 * name and avatar, plus the email address only if the user approved the "email" scope.
 */
oauthRouter.get("/userinfo", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, displayName: true, avatar: true, email: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Nexus Forge's own sign-in (no app) sees its own email; an app sees what its scopes allow.
  res.json(userInfoFor(user, req.user!.appClientId ? req.user!.appScope : "email"));
});

oauthRouter.post("/token", async (req, res) => {
  const result = await issueClientCredentialsToken({
    grant_type: req.body.grant_type,
    client_id: req.body.client_id,
    client_secret: req.body.client_secret,
    code: req.body.code,
    redirect_uri: req.body.redirect_uri,
    db: prisma,
  });

  res.status(result.status).json(result.body);
});
