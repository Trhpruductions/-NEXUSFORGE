import type { NextFunction, Request, Response } from "express";
import { reportDiscordAlert } from "../lib/discord-bot.js";

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(7).toUpperCase();
  
  // Industrial logging: Trace ID + Anonymized Context
  console.error(`[CRITICAL_FAILURE][${requestId}] ${timestamp}`);
  console.error(`PATH: ${req.method} ${req.url}`);
  console.error(`CLIENT: ${req.headers["user-agent"] || "unknown"}`);
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || "Internal System Irregularity";
  const code = err.code || "SYSTEM_PANIC";

  // Automated Discord Recovery Alerts for Production 500s
  if (status === 500 && process.env.NODE_ENV === "production") {
    reportDiscordAlert(`[KERNEL_PANIC][${requestId}] ${message}\nPath: ${req.method} ${req.url}\nCode: ${code}`).catch(() => {
      console.warn("[RECOVERY_FAILURE] Failed to dispatch Discord alert.");
    });
  }

  // Industrial JSON response
  res.status(status).json({
    status: "ERROR",
    trace_id: requestId,
    integrity: "COMPROMISED",
    error: {
      message: message,
      code: code,
      severity: status >= 500 ? "CRITICAL" : "CAUTION",
    },
    ...(process.env.NODE_ENV === "development" && { 
      stack: err.stack,
      context: {
        method: req.method,
        url: req.url,
        body: req.body
      }
    }),
  });
}

