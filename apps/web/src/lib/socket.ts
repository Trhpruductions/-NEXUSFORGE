"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";

let socket: Socket | null = null;

export function getSocket(accessToken?: string): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
      auth: accessToken ? { token: `Bearer ${accessToken}` } : undefined,
    });
  }

  if (accessToken) {
    socket.auth = { token: `Bearer ${accessToken}` };
  }

  return socket;
}
