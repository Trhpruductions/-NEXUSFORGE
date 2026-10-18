/**
 * The server settings tabs a person can open, in the order the settings panel shows them. The panel and the
 * server's right-click menu both read this list, so they always offer the same tabs for the same permissions.
 */
export type ManageTab =
  | "overview"
  | "channels"
  | "roles"
  | "members"
  | "invites"
  | "reports"
  | "automod"
  | "emoji"
  | "stickers"
  | "sounds"
  | "webhooks"
  | "bots"
  | "bans"
  | "audit"
  | "danger";

/** Every tab id, for validating a `manage` query value. */
export const MANAGE_TAB_IDS: readonly ManageTab[] = [
  "overview",
  "channels",
  "roles",
  "members",
  "invites",
  "reports",
  "automod",
  "emoji",
  "stickers",
  "sounds",
  "webhooks",
  "bots",
  "bans",
  "audit",
  "danger",
];

export function isManageTab(value: string | null | undefined): value is ManageTab {
  return Boolean(value) && (MANAGE_TAB_IDS as readonly string[]).includes(value as string);
}

/** What the server reports about the caller: whether they own the server, and which permissions they hold. */
export type ForgeAccessForTabs = { isOwner: boolean; permissions: Partial<Record<string, boolean>> } | undefined;

export function manageTabsFor(access: ForgeAccessForTabs): Array<{ id: ManageTab; label: string }> {
  const can = (key: string) => Boolean(access?.isOwner || access?.permissions[key]);
  const list: Array<{ id: ManageTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "channels", label: "Channels" },
  ];
  if (can("manageRoles")) list.push({ id: "roles", label: "Roles" });
  list.push({ id: "members", label: "Members" });
  list.push({ id: "invites", label: "Invites" });
  if (can("moderateChat")) list.push({ id: "reports", label: "Reports" });
  if (can("manageForge")) list.push({ id: "automod", label: "AutoMod" });
  if (can("manageForge")) list.push({ id: "emoji", label: "Emoji" });
  if (can("manageForge")) list.push({ id: "stickers", label: "Stickers" });
  if (can("manageForge")) list.push({ id: "sounds", label: "Soundboard" });
  if (can("manageChannels")) list.push({ id: "webhooks", label: "Webhooks" });
  if (access?.isOwner) list.push({ id: "bots", label: "Bots" });
  if (can("banUsers")) list.push({ id: "bans", label: "Bans" });
  if (can("manageForge")) list.push({ id: "audit", label: "Audit log" });
  list.push({ id: "danger", label: access?.isOwner ? "Delete" : "Leave" });
  return list;
}
