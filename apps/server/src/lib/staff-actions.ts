import type { Request } from "express";
import { AuditOperation, AuditStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { initializeAuditLogger } from "../utils/audit-logger.js";
import { anonymizeIP } from "./ip-security.js";
import { canAssignRole, canModifyTarget, hasAdminAccess, resolveEffectiveRole, type AppRole } from "./app-roles.js";

type StaffSubject = { id: string; appRole: AppRole | null; isAdmin: boolean };

/** The role "toggle admin" moves an account to: staff accounts become USER, everyone else becomes ADMIN. */
export function toggledAdminRole(target: StaffSubject): AppRole {
  const targetRole = resolveEffectiveRole(target.appRole, target.isAdmin);
  return hasAdminAccess(targetRole, target.isAdmin) ? "USER" : "ADMIN";
}

/**
 * Why this staff member may not use "toggle admin" on this account, or null when they may. The same hierarchy as
 * set-role: only accounts ranked below you, only to a role you could assign yourself, never the owner or exec
 * accounts, and never your own account. The route used to check only the last part, so an admin could remove
 * another admin (or themselves).
 */
export function toggleAdminDenial(actor: StaffSubject, target: StaffSubject): { status: 403; error: string } | null {
  const actorRole = resolveEffectiveRole(actor.appRole, actor.isAdmin);
  const targetRole = resolveEffectiveRole(target.appRole, target.isAdmin);
  if (!hasAdminAccess(actorRole, actor.isAdmin)) return { status: 403, error: "Admin access required" };
  if (actor.id === target.id) return { status: 403, error: "You can't change your own role" };
  if (targetRole === "OWNER" || targetRole === "EXEC") return { status: 403, error: "Cannot modify protected higher-up roles" };
  if (!canModifyTarget(actor.id, target.id, actorRole, targetRole)) return { status: 403, error: "Cannot modify users with equal or higher role" };
  if (!canAssignRole(actorRole, toggledAdminRole(target))) return { status: 403, error: "Cannot assign this role with current permissions" };
  return null;
}

/**
 * Writes a staff change to someone's account (role, badge) to the audit log: who did it, to whom, and the
 * values before and after. Never throws; a failed audit write is logged by the audit logger.
 */
export async function recordStaffAction(
  req: Request,
  input: { action: string; targetUserId: string; before: Record<string, unknown>; after: Record<string, unknown>; metadata?: Record<string, unknown> },
): Promise<void> {
  await initializeAuditLogger(prisma).log({
    operation: AuditOperation.UPDATE,
    resourceType: "User",
    resourceId: input.targetUserId,
    actorId: req.user?.id,
    status: AuditStatus.SUCCESS,
    ipAddress: anonymizeIP(req.ip || "unknown"),
    userAgent: req.get("user-agent")?.slice(0, 300) || undefined,
    // The route without its query string.
    endpoint: `${req.baseUrl}${req.path}`,
    method: req.method,
    beforeValues: input.before,
    afterValues: input.after,
    metadata: { action: input.action, ...input.metadata },
  });
}
