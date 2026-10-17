"use client";

import axios from "axios";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getMe, refreshAccessToken, revokeServerSession, type User } from "@/lib/api";

type PersistMode = "local" | "session";

/**
 * idle: nothing checked yet in this page load. restoring: asking the server. ready: the server
 * confirmed the session. signed-out: no session. unavailable: the server could not be reached.
 */
export type SessionStatus = "idle" | "restoring" | "ready" | "signed-out" | "unavailable";
/** Why the session ended: the user signed out, or the server rejected it (expired, revoked, suspended). */
export type SessionEndReason = "user" | "expired" | null;

/** The server said the session is not valid (401/403), as opposed to being unreachable. */
class SessionRejected extends Error {}

function isSessionRejection(error: unknown) {
  if (error instanceof SessionRejected) return true;
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return status === 401 || status === 403;
}

const AUTH_SESSION_KEY = "nexusforge-auth-session";
const AUTH_PERSIST_MODE_KEY = "nexusforge-auth-persist-mode";

let persistMode: PersistMode = "local";

function setPersistMode(mode: PersistMode) {
  persistMode = mode;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_PERSIST_MODE_KEY, mode);
}

const authStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;

    const localValue = window.localStorage.getItem(name);
    if (localValue) {
      setPersistMode("local");
      return localValue;
    }

    const sessionValue = window.sessionStorage.getItem(name);
    if (sessionValue) {
      setPersistMode("session");
      return sessionValue;
    }

    const rememberedMode = window.localStorage.getItem(AUTH_PERSIST_MODE_KEY);
    if (rememberedMode === "session" || rememberedMode === "local") {
      setPersistMode(rememberedMode);
    }

    return null;
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;

    try {
      const parsed = JSON.parse(value) as {
        state?: { accessToken?: string | null; csrfToken?: string | null; user?: unknown | null };
      };
      const isEmptyAuthState =
        !parsed?.state?.accessToken &&
        !parsed?.state?.csrfToken &&
        !parsed?.state?.user;

      if (isEmptyAuthState) {
        window.localStorage.removeItem(name);
        window.sessionStorage.removeItem(name);
        window.localStorage.removeItem(AUTH_PERSIST_MODE_KEY);
        return;
      }
    } catch {
      // Fallback to normal storage writes for non-JSON payloads.
    }

    const primaryStorage = persistMode === "session" ? window.sessionStorage : window.localStorage;
    const secondaryStorage = persistMode === "session" ? window.localStorage : window.sessionStorage;

    primaryStorage.setItem(name, value);
    secondaryStorage.removeItem(name);
    window.localStorage.setItem(AUTH_PERSIST_MODE_KEY, persistMode);
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(name);
    window.sessionStorage.removeItem(name);
    window.localStorage.removeItem(AUTH_PERSIST_MODE_KEY);
  },
};

type AuthState = {
  accessToken: string | null;
  csrfToken: string | null;
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  /** Not persisted: every page load has to confirm the session with the server again. */
  sessionStatus: SessionStatus;
  sessionEndReason: SessionEndReason;
  setSession: (payload: { accessToken: string; csrfToken?: string | null; user: User; rememberMe?: boolean }) => void;
  /** The user signs out: ends the session on the server too, so the refresh cookie stops working. */
  clearSession: () => void;
  /** The server rejected the session (expired, revoked, suspended). Local only: a sibling tab may hold a live cookie. */
  expireSession: () => void;
  /** Confirms the session with the server, using the refresh cookie when needed. One call runs at a time. */
  restoreSession: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setHydrated: (value: boolean) => void;
};

let restoreInFlight: Promise<void> | null = null;

/** Trades the refresh cookie for an access token when there is none, then loads the account. */
async function establishSession(get: () => AuthState) {
  if (!get().accessToken || !get().csrfToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new SessionRejected("Refresh cookie rejected");
  }
  const payload = await getMe(get().accessToken!);
  return payload.user;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      csrfToken: null,
      user: null,
      loading: false,
      hydrated: false,
      sessionStatus: "idle",
      sessionEndReason: null,
      setHydrated: (value) => set({ hydrated: value }),
      setSession: ({ accessToken, csrfToken, user, rememberMe }) => {
        if (rememberMe !== undefined) {
          setPersistMode(rememberMe ? "local" : "session");
        }

        set((state) => ({
          accessToken,
          csrfToken: csrfToken ?? state.csrfToken,
          user,
          sessionStatus: "ready",
          sessionEndReason: null,
        }));
      },
      clearSession: () => {
        const wasSignedIn = Boolean(get().accessToken);
        if (wasSignedIn) revokeServerSession();
        set({
          accessToken: null,
          csrfToken: null,
          user: null,
          sessionStatus: "signed-out",
          // Keep an earlier "expired" reason: the cleanup that follows an expiry is not a sign-out.
          sessionEndReason: wasSignedIn ? "user" : (get().sessionEndReason ?? "user"),
        });
      },
      expireSession: () =>
        set({ accessToken: null, csrfToken: null, user: null, sessionStatus: "signed-out", sessionEndReason: "expired" }),
      restoreSession: () => {
        if (!restoreInFlight) {
          restoreInFlight = (async () => {
            const hadUser = Boolean(get().user);
            set({ sessionStatus: "restoring" });
            try {
              let user: User;
              try {
                user = await establishSession(get);
              } catch (error) {
                if (!hadUser || !isSessionRejection(error)) throw error;
                // A sibling tab may be rotating the same cookie right now. One retry usually lands on the new one.
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
                user = await establishSession(get);
              }
              set({ user, sessionStatus: "ready", sessionEndReason: null });
            } catch (error) {
              if (isSessionRejection(error)) {
                set({
                  accessToken: null,
                  csrfToken: null,
                  user: null,
                  sessionStatus: "signed-out",
                  sessionEndReason: hadUser ? "expired" : null,
                });
              } else {
                // Offline or server trouble is not a verdict: keep what we have and let the user retry.
                set({ sessionStatus: "unavailable" });
              }
            } finally {
              restoreInFlight = null;
            }
          })();
        }
        return restoreInFlight;
      },
      fetchMe: async () => {
        const token = get().accessToken;
        if (!token) return;

        set({ loading: true });
        try {
          const payload = await getMe(token);
          set({ user: payload.user });
        } catch (error) {
          // Only a definitive auth rejection ends the session. Network blips and server
          // errors keep the user signed in; the API client retries with a refreshed token.
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if (status === 401 || status === 403) {
            console.warn(`[auth] session ended: /api/auth/me returned ${status}`);
            set({ accessToken: null, csrfToken: null, user: null, sessionStatus: "signed-out", sessionEndReason: "expired" });
          }
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: AUTH_SESSION_KEY,
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        csrfToken: state.csrfToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          state?.setHydrated(true);
          return;
        }
        state?.setHydrated(true);
      },
    },
  ),
);
