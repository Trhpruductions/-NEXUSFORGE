export type AppRole = "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";

export const privilegedAppRoles: AppRole[] = ["ADMIN", "EXEC", "OWNER"];

export const privilegedAppRoleSet = new Set<AppRole>(privilegedAppRoles);

export const appRoleRank: Record<AppRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  EXEC: 3,
  OWNER: 4,
};

export function resolveEffectiveRole(role: AppRole | null | undefined, isAdmin: boolean): AppRole {
  if (role) return role;
  return isAdmin ? "ADMIN" : "USER";
}

export function hasAdminAccess(role: AppRole | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || (role ? privilegedAppRoleSet.has(role) : false);
}

export function canAssignHighRoles(actorRole: AppRole): boolean {
  return actorRole === "OWNER";
}

export function canAssignRole(actorRole: AppRole, nextRole: AppRole): boolean {
  if (appRoleRank[nextRole] > appRoleRank[actorRole]) {
    return false;
  }

  if ((nextRole === "EXEC" || nextRole === "OWNER") && !canAssignHighRoles(actorRole)) {
    return false;
  }

  return true;
}

export function canModifyTarget(actorId: string, targetId: string, actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorId === targetId) {
    return true;
  }

  return appRoleRank[targetRole] < appRoleRank[actorRole];
}
