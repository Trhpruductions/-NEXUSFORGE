import { manageTabsFor, type ForgeAccessForTabs } from "@/components/chat/forge-manage-tabs";

/**
 * The right-click menu on a server in the rail. It lists the same settings tabs the settings panel shows for this
 * person's permissions, plus "Open server" and "Mark as read". Settings items open the panel on that tab, so the
 * destructive confirmations (delete, leave) stay in the panel where they already live.
 */
export type ServerMenuItem = {
  id: string;
  label: string;
  /** Opens the settings panel on this tab. Items without an href run `action` instead. */
  href?: string;
  action?: "open" | "read";
  danger?: boolean;
  /** Draws a divider above this item. */
  dividerBefore?: boolean;
};

/** Menu labels for the settings tabs. The panel keeps its own tab labels. */
const MENU_LABEL: Record<string, string> = { overview: "Server settings" };

export function serverMenuItems(input: { forgeId: string; access: ForgeAccessForTabs; unread: boolean; mentions: boolean }): ServerMenuItem[] {
  const items: ServerMenuItem[] = [{ id: "open", label: "Open server", action: "open" }];
  if (input.unread || input.mentions) items.push({ id: "read", label: "Mark as read", action: "read", dividerBefore: false });

  const forgeParam = encodeURIComponent(input.forgeId);
  manageTabsFor(input.access).forEach((tab, index) => {
    const href = `/app/chat?forge=${forgeParam}&manage=${tab.id}`;
    if (tab.id === "danger") {
      items.push({ id: "danger", label: input.access?.isOwner ? "Delete server" : "Leave server", href, danger: true, dividerBefore: true });
      return;
    }
    items.push({ id: tab.id, label: MENU_LABEL[tab.id] || tab.label, href, dividerBefore: index === 0 });
  });
  return items;
}
