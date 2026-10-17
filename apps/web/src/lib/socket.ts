"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { handleSuspended, isSuspensionInfo } from "./suspension";

let socket: Socket | null = null;

export function getSocket(accessToken?: string): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
      auth: accessToken ? { token: `Bearer ${accessToken}` } : undefined,
    });
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
