"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Route guard for everything that needs an account. Children render only after the server has
 * confirmed the session. Until then, and for anyone signed out, nothing private is drawn.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((state) => state.sessionStatus);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  // Confirm the session once per page load. A session already confirmed on this page is reused.
  useEffect(() => {
    if (useAuthStore.getState().sessionStatus !== "ready") void restoreSession();
  }, [restoreSession]);

  // Read the live store here, not the render value: a "signed-out" left over from earlier must
  // not redirect before the restore above has started.
  useEffect(() => {
    const { sessionStatus, sessionEndReason } = useAuthStore.getState();
    if (sessionStatus !== "signed-out") return;

    if (sessionEndReason === "user") {
      router.replace("/login");
      return;
    }
    const params = new URLSearchParams({ redirect: `${window.location.pathname}${window.location.search}` });
    if (sessionEndReason === "expired") params.set("reason", "expired");
    router.replace(`/login?${params.toString()}`);
  }, [status, router]);

  if (status === "ready") return <>{children}</>;

  if (status === "unavailable") {
    return (
      <FullScreen>
        <p className="text-base font-semibold text-white">We can&apos;t reach Nexus Forge right now.</p>
        <p className="mt-2 text-sm text-slate-400">Check your connection. Your sign-in is still safe.</p>
        <button
          type="button"
          onClick={() => void restoreSession()}
          className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25"
        >
          Try again
        </button>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <p className="text-sm font-semibold text-slate-300" role="status" aria-live="polite">
        {status === "signed-out" ? "Taking you to sign in..." : "Checking your session..."}
      </p>
    </FullScreen>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <main className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#070a10] p-6 text-center">
      <Image src="/brand/nexusforge-emblem-256.png" alt="Nexus Forge" width={64} height={64} className="mb-6 h-16 w-16 rounded-2xl opacity-90" priority />
      {children}
    </main>
  );
}
