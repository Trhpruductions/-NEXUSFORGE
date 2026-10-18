import type { NextFunction, Request, Response } from "express";
import { isAppToken, verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { cachedSuspension, suspendedResponse } from "../lib/account-suspension.js";

/**
 * The only requests a third-party app's token may make (method and path). Everything else on the API, from
 * DMs to admin tools, belongs to Nexus Forge's own website and apps. App tokens used to be ordinary sign-in
 * tokens, so any app a user authorised could do anything that user could, including staff actions.
 */
export const APP_TOKEN_ROUTES = new Set(["GET /api/oauth/userinfo"]);

export function appTokenAllowed(method: string, originalUrl: string): boolean {
  const path = originalUrl.split("?")[0].replace(/\/+$/, "");
  return APP_TOKEN_ROUTES.has(`${method.toUpperCase()} ${path}`);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const appToken = isAppToken(payload);
    if (appToken && !appTokenAllowed(req.method, req.originalUrl)) {
      res.status(403).json({ error: "This token belongs to a third-party app and can only read basic profile information.", code: "APP_TOKEN_NOT_ALLOWED" });
      return;
    }
    // Suspended by Nexus Forge staff: an access token issued earlier stops working right away.
    const suspension = cachedSuspension(payload.sub);
    if (suspension) {
      res.status(403).json(suspendedResponse(suspension));
      return;
    }
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      // An app token never carries staff powers, whatever the token says.
      appRole: appToken ? "USER" : payload.appRole,
      jti: payload.jti,
      ...(appToken ? { appClientId: payload.cid, appScope: payload.scope ?? "" } : {}),
    };
    
    // Non-blocking update of lastSeenAt to keep stats accurate
    prisma.user.update({
      where: { id: payload.sub },
      data: { lastSeenAt: new Date() },
    }).catch(() => { /* ignore update failures */ });

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

export async function requireAge(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { ageVerified: true, birthdate: true, ageVerificationLevel: true },
  });

  if (!user || user.ageVerificationLevel === "NONE" || !isOver18(user.birthdate)) {
    res.status(403).json({ error: "Confirm you are 18 or older to use this feature", code: "AGE_REQUIRED" });
    return;
  }

  next();
}

function isOver18(birthdate: Date | null): boolean {
  if (!birthdate) return false;
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return age >= 18;
}
