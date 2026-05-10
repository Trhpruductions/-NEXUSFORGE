"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getMe, type User } from "@/lib/api";

type PersistMode = "local" | "session";

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
  setSession: (payload: { accessToken: string; csrfToken?: string | null; user: User; rememberMe?: boolean }) => void;
  clearSession: () => void;
  fetchMe: () => Promise<void>;
  setHydrated: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      csrfToken: null,
      user: null,
      loading: false,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSession: ({ accessToken, csrfToken, user, rememberMe }) => {
        if (rememberMe !== undefined) {
          setPersistMode(rememberMe ? "local" : "session");
        }

        set((state) => ({
          accessToken,
          csrfToken: csrfToken ?? state.csrfToken,
          user,
        }));
      },
      clearSession: () => set({ accessToken: null, csrfToken: null, user: null }),
      fetchMe: async () => {
        const token = get().accessToken;
        if (!token) return;

        set({ loading: true });
        try {
          const payload = await getMe(token);
          set({ user: payload.user });
        } catch {
          set({ accessToken: null, csrfToken: null, user: null });
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
