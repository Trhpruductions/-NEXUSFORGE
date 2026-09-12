export const forgePermissionKeys = [
  "manageForge",
  "manageChannels",
  "manageRoles",
  "kickUsers",
  "banUsers",
  "moderateChat",
  "streamAccess",
] as const;

export type ForgePermissionKey = (typeof forgePermissionKeys)[number];

export type ForgePermissionSet = Record<ForgePermissionKey, boolean>;

export type RoleLike = {
  id: string;
  position: number;
  permissions: unknown;
};

export const emptyForgePermissions: ForgePermissionSet = {
  manageForge: false,
  manageChannels: false,
  manageRoles: false,
  kickUsers: false,
  banUsers: false,
  moderateChat: false,
  streamAccess: false,
};

export const fullForgePermissions: ForgePermissionSet = {
  manageForge: true,
  manageChannels: true,
  manageRoles: true,
  kickUsers: true,
  banUsers: true,
  moderateChat: true,
  streamAccess: true,
};

/** Highest role position a non-owner can create or hold. The Owner role sits at 100. */
export const ownerRolePosition = 100;
export const maxAssignableRolePosition = 99;

export function normalizePermissions(raw: unknown): ForgePermissionSet {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result: ForgePermissionSet = { ...emptyForgePermissions };
  for (const key of forgePermissionKeys) {
    result[key] = Boolean(source[key]);
  }
  return result;
}

export type ResolvedForgeAccess = {
  isOwner: boolean;
  permissions: ForgePermissionSet;
  /** Highest role position held. Owners resolve to ownerRolePosition. Members without roles resolve to -1. */
  topPosition: number;
};

export function resolveForgeAccess(isOwner: boolean, roles: RoleLike[]): ResolvedForgeAccess {
  if (isOwner) {
    return { isOwner: true, permissions: { ...fullForgePermissions }, topPosition: ownerRolePosition };
  }

  const permissions: ForgePermissionSet = { ...emptyForgePermissions };
  let topPosition = -1;

  for (const role of roles) {
    const rolePermissions = normalizePermissions(role.permissions);
    for (const key of forgePermissionKeys) {
      if (rolePermissions[key]) permissions[key] = true;
    }
    if (role.position > topPosition) topPosition = role.position;
  }

  // manageForge implies channel + role administration.
  if (permissions.manageForge) {
    permissions.manageChannels = true;
    permissions.manageRoles = true;
  }

  return { isOwner: false, permissions, topPosition };
}

export function hasForgePermission(access: ResolvedForgeAccess, key: ForgePermissionKey): boolean {
  return access.isOwner || access.permissions[key];
}

/**
 * A member may only create, edit, delete, or assign roles that sit strictly below their own top role.
 * Owners can manage everything except the protected Owner role itself.
 */
export function canManageRolePosition(access: ResolvedForgeAccess, rolePosition: number): boolean {
  if (rolePosition >= ownerRolePosition) return false;
  if (access.isOwner) return true;
  return access.permissions.manageRoles && rolePosition < access.topPosition;
}

/**
 * Moderation actions (kick, ban, nickname override) require the actor to outrank the target.
 * The owner can never be targeted.
 */
export function canModerateMember(actor: ResolvedForgeAccess, target: ResolvedForgeAccess): boolean {
  if (target.isOwner) return false;
  if (actor.isOwner) return true;
  return actor.topPosition > target.topPosition;
}

export function isProtectedOwnerRole(role: { name: string; position: number }): boolean {
  return role.position >= ownerRolePosition || role.name.trim().toLowerCase() === "owner";
}
