"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { setApiUnauthorizedHandler } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { GlobalNotificationProvider } from "@/context/global-notifications";
import { GlobalNotificationCenter } from "@/components/notifications/global-notification-center";
import { DesktopUpdateListener } from "@/components/desktop/desktop-update-listener";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 10_000,
          },
        },
      }),
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return;
      }

      console.error("Service worker registration failed", error);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !accessToken) return;
    void fetchMe();
  }, [hydrated, accessToken, fetchMe]);

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      clearSession();
      void useAuthStore.persist.clearStorage();
      queryClient.clear();
    });

    return () => {
      setApiUnauthorizedHandler(null);
    };
  }, [clearSession, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalNotificationProvider>
        <DesktopUpdateListener />
        <GlobalNotificationCenter />
        {children}
      </GlobalNotificationProvider>
    </QueryClientProvider>
  );
}
