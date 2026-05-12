"use client";

import { useEffect } from "react";
import { useGlobalNotifications } from "@/context/global-notifications";

type DesktopBridge = {
  runtime?: string;
  getUpdateState?: () => Promise<any>;
  checkUpdatesNow?: () => Promise<any>;
  restartForUpdate?: () => Promise<{ restarting: boolean }>;
  onUpdateState?: (callback: (payload: any) => void) => () => void;
};

export function DesktopUpdateListener() {
  const { setUpdateState } = useGlobalNotifications();

  useEffect(() => {
    const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    if (!bridge || bridge.runtime !== "electron") {
      return;
    }

    if (typeof bridge.getUpdateState === "function") {
      void bridge.getUpdateState().then(setUpdateState).catch(() => undefined);
    }

    const dispose =
      typeof bridge.onUpdateState === "function"
        ? bridge.onUpdateState((payload) => {
            setUpdateState(payload);
          })
        : undefined;

    return () => {
      if (typeof dispose === "function") {
        dispose();
      }
    };
  }, [setUpdateState]);

  return null;
}
