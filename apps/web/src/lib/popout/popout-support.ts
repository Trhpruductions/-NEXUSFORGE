/**
 * Whether panels can open in their own window here. Browsers can (a normal popup window). The desktop app can from
 * 1.0.16, which allows these windows and says so in its bridge; older desktop apps refuse every new window, so the
 * popout buttons are hidden there instead of doing nothing.
 */
type DesktopBridge = { runtime?: string; features?: readonly string[] };

export function popoutsSupported(): boolean {
  if (typeof window === "undefined" || typeof window.open !== "function") return false;
  const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
  if (bridge?.runtime === "electron") return Array.isArray(bridge.features) && bridge.features.includes("popouts");
  // Phones and small tablets: a second window isn't useful there.
  return window.matchMedia?.("(min-width: 900px)").matches ?? true;
}

/** Window names the desktop app accepts for popouts (it refuses any other new window). */
export function popoutWindowName(kind: "voice" | "share" | "members"): string {
  return `nf-popout-${kind}`;
}
