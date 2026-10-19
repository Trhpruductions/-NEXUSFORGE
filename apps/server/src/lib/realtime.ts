import type { Server } from "socket.io";
import { removeUserFromVoiceChannels } from "./voice-occupancy.js";

let ioInstance: Server | null = null;

/** Told about every voice channel a user was pulled out of, so the gateway can update occupancy and stages. */
type VoiceRemovedListener = (channelId: string, userId: string) => void;
let voiceRemovedListener: VoiceRemovedListener | null = null;

/** The socket gateway (index.ts) registers this once at startup. Pass null to remove it (tests). */
export function onVoiceRemoved(listener: VoiceRemovedListener | null): void {
  voiceRemovedListener = listener;
}

/**
 * Takes a user off the server's voice member list for these channels and tells everyone else (through the
 * gateway's listener). The others' apps then drop their peer connections to that user, and the voice relay
 * stops passing call signalling to or from them, even if the user's own app ignores the hang-up request.
 */
function removeFromVoice(userId: string, channelIds: string[]): string[] {
  const left = removeUserFromVoiceChannels(userId, channelIds);
  for (const channelId of left) {
    try {
      voiceRemovedListener?.(channelId, userId);
    } catch (error) {
      console.error("[realtime] voice removal listener failed", error);
    }
  }
  return left;
}

export function setIo(io: Server): void {
  ioInstance = io;
}

export function resetIoForTests(): void {
  ioInstance = null;
}

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error("Socket.IO server not initialized");
  }
  return ioInstance;
}

/**
 * Pull a user's open sockets out of every room belonging to a forge (the forge room and
 * each channel's message and voice room). Call this when someone is kicked, banned or
 * leaves, so they stop receiving live messages and voice signalling immediately.
 *
 * If they are in one of the forge's voice channels, their app is told to hang up and they
 * are taken off the voice member list straight away, so the others stop sending them audio
 * and video. Returns the voice channels they were taken out of.
 */
export async function evictUserFromForge(forgeId: string, userId: string, channelIds: string[], reason = "removed"): Promise<string[]> {
  if (!ioInstance) return [];
  const rooms = [`forge:${forgeId}`, ...channelIds.flatMap((id) => [`channel:${id}`, `voice:${id}`])];
  if (channelIds.length) ioInstance.to(`user:${userId}`).emit("voice:force-leave", { channelIds, reason });
  ioInstance.in(`user:${userId}`).socketsLeave(rooms);
  // After leaving the forge room, so the occupancy update goes to the people who stay.
  return removeFromVoice(userId, channelIds);
}

type SocketLike = { data: { jti?: string }; emit: (event: string, payload: unknown) => unknown; disconnect: (close?: boolean) => unknown };

/** The sockets to drop when a user's sessions are revoked. The socket of the device that made the request is kept, when its token id is given. */
export function socketsToDisconnect<T extends SocketLike>(sockets: T[], exceptAccessJti?: string): T[] {
  return exceptAccessJti ? sockets.filter((socket) => socket.data.jti !== exceptAccessJti) : sockets;
}

/**
 * Drop a user's live sockets once their sessions have been revoked (password changed or reset, sign out everywhere,
 * account deletion). The socket is told why first, so the app can show the sign-in screen instead of retrying.
 * Pass exceptAccessJti to keep the device that made the request connected.
 *
 * This stops live connections right away. It does not stop a reconnect that uses an access token issued before the
 * revocation: those stay valid until they expire (ACCESS_TOKEN_EXPIRES_IN, 15 minutes by default).
 */
export async function disconnectUserSockets(userId: string, options: { reason: string; exceptAccessJti?: string }): Promise<number> {
  if (!ioInstance) return 0;
  const sockets = socketsToDisconnect(await ioInstance.in(`user:${userId}`).fetchSockets(), options.exceptAccessJti);
  for (const socket of sockets) socket.emit("session:revoked", { reason: options.reason });
  // Give the event a moment to leave before the socket closes, as the suspension path does.
  setTimeout(() => {
    for (const socket of sockets) socket.disconnect(true);
  }, 250);
  return sockets.length;
}

/**
 * Pull a user out of specific channels (lost access to a private channel after a role or
 * permission change, or timed out of voice). The client is told to hang up, and the server
 * takes them off the voice member list itself instead of waiting for the app to leave (an app
 * that ignored the request used to stay in the call). Returns the voice channels they left.
 */
export function evictUserFromChannels(userId: string, channelIds: string[], options: { voiceOnly?: boolean; reason?: string } = {}): string[] {
  if (!ioInstance || !channelIds.length) return [];
  const rooms = channelIds.flatMap((id) => (options.voiceOnly ? [`voice:${id}`] : [`channel:${id}`, `voice:${id}`]));
  ioInstance.to(`user:${userId}`).emit("voice:force-leave", { channelIds, reason: options.reason ?? "access" });
  ioInstance.in(`user:${userId}`).socketsLeave(rooms);
  return removeFromVoice(userId, channelIds);
}
