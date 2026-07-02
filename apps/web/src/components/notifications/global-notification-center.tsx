"use client";

import { X, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalNotifications } from "@/context/global-notifications";
import { Button } from "@/components/ui/button";

export function GlobalNotificationCenter() {
  const { updateState, notifications, removeNotification } = useGlobalNotifications();
  const [desktopUpdateBannerActive, setDesktopUpdateBannerActive] = useState(false);

  useEffect(() => {
    const bridge = (window as { nexusforgeDesktop?: { runtime?: string } }).nexusforgeDesktop;
    setDesktopUpdateBannerActive(Boolean(bridge?.runtime === "electron"));
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertCircle size={18} className="text-rose-400" />;
      case "success":
        return <CheckCircle size={18} className="text-amber-400" />;
      case "update":
        return <AlertCircle size={18} className="text-amber-400" />;
      default:
        return <Info size={18} className="text-slate-400" />;
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case "error":
        return "border-rose-200 bg-rose-50 text-rose-700";
      case "success":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "update":
        return "border-amber-200 bg-amber-50 text-amber-700";
      default:
        return "border-slate-900/10 bg-white text-slate-700";
    }
  };

  const updateStatusMessage = (): string | null => {
    if (!updateState) return null;
    const hasActionableUpdate =
      updateState.forceRequired ||
      updateState.downloading ||
      updateState.downloaded ||
      updateState.available ||
      updateState.checking;
    if (updateState.lastError && !hasActionableUpdate) {
      return null;
    }
    if (updateState.lastError) return updateState.lastError;
    if (updateState.forceRequired && updateState.downloaded) {
      return `Required update ${updateState.latestVersion ?? ""} downloaded. Installing now.`;
    }
    if (updateState.downloading) {
      const pct =
        typeof updateState.downloadPercent === "number" && updateState.downloadPercent > 0
          ? ` (${updateState.downloadPercent}%)`
          : "";
      const required = updateState.forceRequired ? "Required " : "";
      return `${required}downloading update ${updateState.latestVersion ?? ""}${pct}...`;
    }
    if (updateState.downloaded) return `Update ${updateState.latestVersion ?? ""} downloaded. Restart to install.`;
    if (updateState.available && updateState.forceRequired) return `Required update available: ${updateState.latestVersion ?? ""}`;
    if (updateState.available) return `Update available: ${updateState.latestVersion ?? ""}`;
    return null;
  };

  const updateMessage = updateStatusMessage();

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[120] flex max-h-screen w-[min(90vw,420px)] flex-col gap-2 overflow-y-auto">
      {updateMessage && !desktopUpdateBannerActive && (
        <div className={`pointer-events-auto rounded-[20px] border p-3 shadow-[0_16px_36px_rgba(2,6,23,0.18)] backdrop-blur ${getColors("update")}`}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Desktop Update Center</p>
              <p className="mt-1 text-sm font-medium">{updateMessage}</p>
            </div>
            <button
              onClick={() => {
                // Update will clear from updateState
              }}
              aria-label="Dismiss update notification"
              className="flex-shrink-0 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto rounded-[20px] border p-3 shadow-[0_16px_36px_rgba(2,6,23,0.18)] backdrop-blur ${getColors(notification.type)}`}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
              {notification.action && (
                <Button
                  onClick={() => {
                    notification.action!.callback();
                    removeNotification(notification.id);
                  }}
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-xs"
                >
                  {notification.action.label}
                </Button>
              )}
            </div>
            {notification.dismissible !== false && (
              <button
                onClick={() => removeNotification(notification.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
