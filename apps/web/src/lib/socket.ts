"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { refreshAccessToken } from "./api";
import { handleSuspended, isSuspensionInfo } from "./suspension";
import { useAuthStore } from "@/store/auth-store";

let socket: Socket | null = null;
/** The account the realtime connection was opened for. */
let socketUserId: string | null = null;
let watchingSession = false;
/** Refused-sign-in reconnects in a row; reset once a connection succeeds. */
let authRetries = 0;
/** Updates the token a new connection falls back to before the auth store has one. */
let socketTokenSetter: ((token: string) => void) | null = null;
const MAX_AUTH_RETRIES = 3;

/** The server refused the token (expired or otherwise invalid), as opposed to a network or server problem. */
export function isTokenRefusal(message: string) {
  return message === "Invalid token" || message === "Unauthorized";
}

/**
 * A reconnect (after a network drop or a server restart) can carry a token that expired while the page sat in a
 * call making no other requests. The server refuses it and socket.io doesn't retry a refusal by itself, so voice and
 * live chat stayed dead until a reload. Get a fresh token and connect again, a few times at most.
 */
async function recoverFromTokenRefusal(target: Socket) {
  if (authRetries >= MAX_AUTH_RETRIES) return;
  authRetries += 1;
  let refreshed: Awaited<ReturnType<typeof refreshAccessToken>> = null;
  try {
    refreshed = await refreshAccessToken();
  } catch {
    // Network trouble: wait and try the same token path again below.
  }
  if (socket !== target) return; // signed out or switched account meanwhile
  if (refreshed === null && !useAuthStore.getState().accessToken) return; // the session is over
  setTimeout(() => {
    if (socket === target && !target.connected) target.connect();
  }, 1000 * authRetries);
}

/**
 * Closes the realtime connection and forgets it; the next getSocket() opens a fresh one. The server only checks
 * the token when a connection opens, so a connection kept after sign-out stayed signed in as the previous person
 * (their DMs, notifications and voice), even after someone else signed in on the same tab.
 */
export function resetSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  socketUserId = null;
  socketTokenSetter = null;
  authRetries = 0;
}

/** Sign-out, an expired session or a different account: drop the connection. A token refresh keeps it. */
function watchSession() {
  if (watchingSession || typeof window === "undefined") return;
  watchingSession = true;
  useAuthStore.subscribe((state) => {
    const userId = state.user?.id ?? null;
    if (!state.accessToken) {
      if (socket) resetSocket();
      return;
    }
    if (socketUserId && userId && userId !== socketUserId) resetSocket();
    else if (socket && !socketUserId && userId) socketUserId = userId;
  });
}

export function getSocket(accessToken?: string): Socket {
  watchSession();
  if (!socket) {
    let fallbackToken = accessToken;
    const created = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
      // Read at every (re)connection attempt, so a reconnect always carries the newest token.
      auth: (send) => {
        const token = useAuthStore.getState().accessToken ?? fallbackToken;
        send(token ? { token: `Bearer ${token}` } : {});
      },
    });
    socket = created;
    socketUserId = useAuthStore.getState().user?.id ?? null;
    // Suspended while using the app, or trying to reconnect after it.
    created.on("account:suspended", (info: unknown) => handleSuspended(isSuspensionInfo(info) ? info : null));
    created.on("connect", () => {
      authRetries = 0;
    });
    created.on("connect_error", (error) => {
      if (error.message === "Account suspended") handleSuspended(null);
      else if (isTokenRefusal(error.message)) void recoverFromTokenRefusal(created);
    });
    // Callers pass the token they have; keep the newest as a fallback for the moment before the store has one.
    socketTokenSetter = (token) => {
      fallbackToken = token;
    };
  }

  if (accessToken) socketTokenSetter?.(accessToken);

  return socket;
}
