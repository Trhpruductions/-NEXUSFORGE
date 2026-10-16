import type { NextFunction, Request, Response } from "express";
import { AppRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/**
 * Owner-only gate for the Owner Console. Reads the role from the database on every request,
 * so a role change takes effect immediately. ADMIN and EXEC do not pass this check.
 */
export async function requireOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { appRole: true, suspendedAt: true },
  });

  if (!user || user.appRole !== AppRole.OWNER || user.suspendedAt) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }

  next();
}
