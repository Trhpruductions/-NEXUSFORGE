import { randomBytes } from "node:crypto";
import { type Request, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, sha256, verifyAccessToken, randomToken } from "../lib/jwt.js";
import { env } from "../config/env.js";

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
              expiresAt: Date;
              usedAt: Date | null;
              client: { clientId: string };
              user: { id: string; username: string; email: string; appRole?: string | null };
            }
          | null
        >;
        update: (args: { where: { id: string }; data: { usedAt: Date } }) => Promise<unknown>;
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

    await data.db.oAuthAuthorizationCode.update({
      where: { id: authorizationCode.id },
      data: { usedAt: new Date() },
    });

    const user = authorizationCode.user;
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      appRole: (user.appRole as "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER") ?? "USER",
      jti: randomToken(16),
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

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    appRole: (user.appRole as "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER") ?? "USER",
    jti: randomToken(16),
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

async function getSessionUser(req: Request) {
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      return { id: payload.sub, username: payload.username, email: payload.email, appRole: payload.appRole };
    } catch {
      // continue to cookie fallback
    }
  }

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    return null;
  }

  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    email: session.user.email,
    appRole: session.user.appRole,
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

oauthRouter.get("/authorize", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const result = await issueAuthorizationCode({
    response_type: req.query.response_type as string,
    client_id: req.query.client_id as string,
    redirect_uri: req.query.redirect_uri as string,
    scope: typeof req.query.scope === "string" ? req.query.scope : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    db: prisma,
    user,
  });

  if (result.status === 302) {
    res.redirect(result.body.redirect_uri);
    return;
  }

  res.status(result.status).json(result.body);
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
