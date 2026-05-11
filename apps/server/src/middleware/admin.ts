import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { hasAdminAccess } from "../lib/app-roles.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isAdmin: true, appRole: true },
  });

  if (!user || !hasAdminAccess(user.appRole, user.isAdmin)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
