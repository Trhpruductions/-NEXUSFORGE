/**
 * In-memory registry of who is connected to which voice channel.
 * Fed by the socket gateway (voice:join / voice:leave / disconnect) and read
 * by the sidebar so the counts next to voice channels are real.
 */
const channels = new Map<string, Map<string, Set<string>>>(); // channelId -> userId -> socketIds
const socketChannels = new Map<string, Set<string>>(); // socketId -> channelIds

export function joinVoice(channelId: string, userId: string, socketId: string) {
  let users = channels.get(channelId);
  if (!users) {
    users = new Map();
    channels.set(channelId, users);
  }
  let sockets = users.get(userId);
  if (!sockets) {
    sockets = new Set();
    users.set(userId, sockets);
  }
  sockets.add(socketId);
  let mine = socketChannels.get(socketId);
  if (!mine) {
    mine = new Set();
    socketChannels.set(socketId, mine);
  }
  mine.add(channelId);
}

export function leaveVoice(channelId: string, userId: string, socketId: string) {
  const users = channels.get(channelId);
  const sockets = users?.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (!sockets.size) users!.delete(userId);
    if (!users!.size) channels.delete(channelId);
  }
  const mine = socketChannels.get(socketId);
  mine?.delete(channelId);
  if (mine && !mine.size) socketChannels.delete(socketId);
}

/** Drops every voice membership held by a socket; returns the channels it left. */
export function leaveAllVoice(userId: string, socketId: string) {
  const mine = Array.from(socketChannels.get(socketId) ?? []);
  for (const channelId of mine) leaveVoice(channelId, userId, socketId);
  return mine;
}

export function voiceMembers(channelId: string) {
  return Array.from(channels.get(channelId)?.keys() ?? []);
}

export function voiceOccupancyFor(channelIds: string[]) {
  return channelIds.map((channelId) => ({ channelId, userIds: voiceMembers(channelId) }));
}
