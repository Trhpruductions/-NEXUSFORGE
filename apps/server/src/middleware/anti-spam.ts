import type { NextFunction, Request, Response } from "express";

type CooldownEntry = {
  timestamp: number;
  contentHash: string;
};

const userChannelCooldown = new Map<string, CooldownEntry>();

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function antiSpam(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user?.id;
  const channelId = req.body?.channelId;
  const content = typeof req.body?.content === "string" ? req.body.content : "";

  if (!userId || !channelId) {
    next();
    return;
  }

  const key = `${userId}:${channelId}`;
  const now = Date.now();
  const contentHash = simpleHash(content.trim().toLowerCase());
  const previous = userChannelCooldown.get(key);

  if (previous) {
    const withinCooldown = now - previous.timestamp < 1200;
    const sameContent = previous.contentHash === contentHash;
    if (withinCooldown || sameContent) {
      res.status(429).json({ error: "Message blocked by anti-spam guard" });
      return;
    }
  }

  userChannelCooldown.set(key, { timestamp: now, contentHash });
  next();
}
