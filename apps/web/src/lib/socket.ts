"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { handleSuspended, isSuspensionInfo } from "./suspension";
import { useAuthStore } from "@/store/auth-store";

let socket: Socket | null = null;
/** The account the realtime connection was opened for. */
let socketUserId: string | null = null;
let watchingSession = false;

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
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
      auth: accessToken ? { token: `Bearer ${accessToken}` } : undefined,
    });
    socketUserId = useAuthStore.getState().user?.id ?? null;
    // Suspended while using the app, or trying to reconnect after it.
    socket.on("account:suspended", (info: unknown) => handleSuspended(isSuspensionInfo(info) ? info : null));
    socket.on("connect_error", (error) => {
      if (error.message === "Account suspended") handleSuspended(null);
    });
  }

  if (accessToken) {
    socket.auth = { token: `Bearer ${accessToken}` };
  }

  return socket;
}
