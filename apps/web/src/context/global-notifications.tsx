"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type DesktopUpdateState = {
  checking: boolean;
  available: boolean;
  forceRequired?: boolean;
  downloading: boolean;
  downloaded: boolean;
  downloadPercent?: number;
  currentVersion: string;
  latestVersion: string | null;
  lastError: string | null;
};

type UpdateNotification = {
  id: string;
  type: "update" | "info" | "success" | "error";
  message: string;
  action?: { label: string; callback: () => void };
  dismissible?: boolean;
};

type GlobalNotificationContextType = {
  updateState: DesktopUpdateState | null;
  setUpdateState: (state: DesktopUpdateState | null) => void;
  notifications: UpdateNotification[];
  addNotification: (notification: Omit<UpdateNotification, "id">) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
};

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

export function GlobalNotificationProvider({ children }: { children: ReactNode }) {
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<UpdateNotification, "id">) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newNotif: UpdateNotification = { ...notification, id };
    setNotifications((prev) => [...prev, newNotif]);

    // Auto-dismiss non-update notifications after 5 seconds
    if (notification.type !== "update" && notification.dismissible !== false) {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }

    return id;
  }, [removeNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <GlobalNotificationContext.Provider
      value={{
        updateState,
        setUpdateState,
        notifications,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </GlobalNotificationContext.Provider>
  );
}

export function useGlobalNotifications() {
  const context = useContext(GlobalNotificationContext);
  if (!context) {
    throw new Error("useGlobalNotifications must be used within GlobalNotificationProvider");
  }
  return context;
}
