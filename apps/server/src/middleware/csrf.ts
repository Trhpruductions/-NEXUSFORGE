import type { NextFunction, Request, Response } from "express";

const CSRF_COOKIE = "nf_csrf";
const CSRF_HEADER = "x-csrf-token";

export function csrfCookieName(): string {
  return CSRF_COOKIE;
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
}
