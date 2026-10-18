import type { NextFunction, Request, Response } from "express";

/**
 * Per-channel flood guard.
 *
 * Two separate rules: messages cannot be fired off faster than the cooldown, and the
 * exact same text cannot be repeated inside the duplicate window. The duplicate rule is
 * deliberately time-bounded. Gaming chat is full of "gg", "ready" and "+1", and a member
 * should be able to say the same short thing again later without being refused.
 */

export const MESSAGE_COOLDOWN_MS = 1_200;
export const DUPLICATE_WINDOW_MS = 30_000;

/** How long an idle entry is kept before the sweep drops it. */
const ENTRY_TTL_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

export type CooldownEntry = {
  timestamp: number;
  contentHash: string;
};

export type SpamVerdict = { blocked: false } | { blocked: true; reason: "cooldown" | "duplicate"; message: string };

const userChannelCooldown = new Map<string, CooldownEntry>();
let lastSweepAt = 0;

export function hashContent(input: string): string {
  let hash = 0;
  const normalized = input.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/** The whole decision, kept pure so the rules can be tested without an HTTP round trip. */
export function spamVerdict(previous: CooldownEntry | undefined, now: number, contentHash: string): SpamVerdict {
  if (!previous) return { blocked: false };

  if (now - previous.timestamp < MESSAGE_COOLDOWN_MS) {
    return { blocked: true, reason: "cooldown", message: "You are sending messages too quickly. Give it a second." };
  }

  if (previous.contentHash === contentHash && now - previous.timestamp < DUPLICATE_WINDOW_MS) {
    return { blocked: true, reason: "duplicate", message: "That is the same message you just sent." };
  }

  return { blocked: false };
}

/** Drops entries nobody has touched in a while so the map cannot grow without bound. */
export function sweepCooldowns(now: number, entries: Map<string, CooldownEntry> = userChannelCooldown): void {
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > ENTRY_TTL_MS) entries.delete(key);
  }
}

export function antiSpam(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user?.id;
  const channelId = req.body?.channelId;
  // Compare the whole message, not just its text: two different stickers (no text) or two
  // different files (sent with the same "Shared a file" text) aren't duplicates.
  const text = typeof req.body?.content === "string" ? req.body.content : "";
  const extras = [
    typeof req.body?.stickerId === "string" ? `sticker:${req.body.stickerId}` : "",
    Array.isArray(req.body?.attachments) ? `files:${req.body.attachments.join("|")}` : "",
    req.body?.poll && Array.isArray(req.body.poll.options) ? `poll:${req.body.poll.options.join("|")}` : "",
  ].filter(Boolean);
  const content = extras.length ? `${text}\u0000${extras.join("\u0000")}` : text;

  if (!userId || !channelId) {
    next();
    return;
  }

  const now = Date.now();
  if (now - lastSweepAt > SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    sweepCooldowns(now);
  }

  const key = `${userId}:${channelId}`;
  const contentHash = hashContent(content);
  const verdict = spamVerdict(userChannelCooldown.get(key), now, contentHash);

  if (verdict.blocked) {
    res.status(429).json({ error: verdict.message, reason: verdict.reason });
    return;
  }

  userChannelCooldown.set(key, { timestamp: now, contentHash });
  next();
}
