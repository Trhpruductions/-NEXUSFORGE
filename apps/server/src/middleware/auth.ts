import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      appRole: payload.appRole,
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
    select: { ageVerified: true, birthdate: true },
  });

  if (!user || (!user.ageVerified && !isOver18(user.birthdate))) {
    res.status(403).json({ error: "Access denied: 18+ verification required" });
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
