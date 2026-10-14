import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { reportDiscordAlert } from "../lib/discord-bot.js";
import { cleanPath, recordError } from "../lib/error-log.js";

/**
 * Last stop for anything a route didn't handle.
 *
 * - Request problems (bad JSON, body too large…) keep their 4xx status and a plain message.
 * - Anything else is a 500: the person gets a friendly message and a reference code, never
 *   the internal error (which can contain database details). The full error goes to the
 *   log, the staff error page (/admin/errors) and, in production, Discord.
 *
 * The response always has `error` as a string, which is what the app shows.
 */
export function globalErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const error = (err ?? {}) as { status?: number; statusCode?: number; expose?: boolean; message?: string; stack?: string; type?: string };
  const rawStatus = error.status ?? error.statusCode;
  const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const reference = crypto.randomBytes(4).toString("hex").toUpperCase();
  const path = cleanPath(req.originalUrl);

  if (status < 500) {
    const message =
      error.type === "entity.too.large" ? "That's too big to send." :
      error.type === "entity.parse.failed" ? "The request wasn't valid JSON." :
      error.expose && error.message ? error.message : "That request couldn't be handled.";
    res.status(status).json({ error: message });
    return;
  }

  console.error(`[error ${reference}] ${req.method} ${path}`, err);
  void recordError({ source: "server", message: `${req.method} ${path}: ${error.message ?? String(err)}`, stack: error.stack, path });
  if (process.env.NODE_ENV === "production") {
    reportDiscordAlert(`Server error ${reference}: ${req.method} ${path}\n${(error.message ?? "").slice(0, 300)}`).catch(() => {
      console.warn("[error-handler] couldn't send the Discord alert");
    });
  }

  // Half-sent response: let Express close the connection.
  if (res.headersSent) {
    _next(err);
    return;
  }
  res.status(500).json({ error: `Something went wrong on our side. Please try again. (Reference ${reference})`, reference });
}
