import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  username: string;
  email: string;
  appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";
  jti: string; // Add a unique token ID to prevent reuse if revoked
  /**
   * Set only on tokens issued to a third-party app through OAuth (the app's client id). Such tokens never carry
   * staff powers and are accepted only where app tokens are allowed (see APP_TOKEN_ROUTES in middleware/auth.ts).
   */
  cid?: string;
  /** The scopes the user approved for that app (space-separated), e.g. "identify email". */
  scope?: string;
};

/** True for a token issued to a third-party app rather than to Nexus Forge's own website or desktop app. */
export function isAppToken(payload: AccessTokenPayload): boolean {
  return typeof payload.cid === "string" && payload.cid.length > 0;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  // Two-factor challenge tokens are signed with this same key (purpose: "2fa"). They only prove
  // the password, so they must never be accepted as a bearer credential. Real access tokens
  // always carry a subject and a token id, and never a purpose.
  if (typeof payload === "string" || "purpose" in payload || typeof payload.sub !== "string" || typeof payload.jti !== "string") {
    throw new jwt.JsonWebTokenError("Not an access token");
  }
  return payload as AccessTokenPayload;
}

export function randomToken(size = 48): string {
  return crypto.randomBytes(size).toString("hex");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
