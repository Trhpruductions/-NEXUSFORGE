/**
 * Where a server opens: its channel list, on the channel the person last used there.
 * The chat page falls back to the first text channel when the remembered channel no longer exists.
 */
export function serverLandingHref(forgeId: string, lastChannelId?: string | null): string {
  const base = `/app/chat?forge=${encodeURIComponent(forgeId)}`;
  return lastChannelId ? `${base}&channel=${encodeURIComponent(lastChannelId)}` : base;
}
