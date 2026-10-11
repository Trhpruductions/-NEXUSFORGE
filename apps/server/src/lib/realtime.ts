import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setIo(io: Server): void {
  ioInstance = io;
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
 */
export async function evictUserFromForge(forgeId: string, userId: string, channelIds: string[]): Promise<void> {
  if (!ioInstance) return;
  const rooms = [`forge:${forgeId}`, ...channelIds.flatMap((id) => [`channel:${id}`, `voice:${id}`])];
  ioInstance.in(`user:${userId}`).socketsLeave(rooms);
}

/**
 * Pull a user out of specific channels (lost access to a private channel, or timed out of
 * voice). The client is told to hang up so voice occupancy updates through its normal leave.
 */
export function evictUserFromChannels(userId: string, channelIds: string[], options: { voiceOnly?: boolean; reason?: string } = {}): void {
  if (!ioInstance || !channelIds.length) return;
  const rooms = channelIds.flatMap((id) => (options.voiceOnly ? [`voice:${id}`] : [`channel:${id}`, `voice:${id}`]));
  ioInstance.to(`user:${userId}`).emit("voice:force-leave", { channelIds, reason: options.reason ?? "access" });
  ioInstance.in(`user:${userId}`).socketsLeave(rooms);
}
