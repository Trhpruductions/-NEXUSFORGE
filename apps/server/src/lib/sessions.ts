import type { Request } from "express";
import { env } from "../config/env.js";
import { sendEmail } from "./delivery.js";
import { createNotification } from "./notifications.js";
import { prisma } from "./prisma.js";

// Sign-in sessions as the user sees them (Settings > Active sessions), and the
// "new sign-in" alert. See the RefreshToken model for how rotation chains rows.

export type DeviceContext = { userAgent: string | null; deviceLabel: string; ipPrefix: string | null };

/** "Chrome on Windows", "Vexora Desktop on Windows", "Safari on iPhone" ... */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const app = /Vexora Gaming Desktop|Electron\//i.test(ua)
    ? "Vexora Desktop"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /curl|node|axios|python|okhttp/i.test(ua)
                ? "API client"
                : "Browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return os ? `${app} on ${os}` : app;
}

/** Network prefix only, so the list can say "same network" without storing addresses. */
export function ipPrefix(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return `${v4.split(".").slice(0, 3).join(".")}.x`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return null;
}

export function deviceContext(req: Request): DeviceContext {
  const userAgent = (req.get("user-agent") ?? "").slice(0, 300) || null;
  return { userAgent, deviceLabel: describeDevice(userAgent), ipPrefix: ipPrefix(req.ip) };
}

/**
 * Alerts the user when a device type they haven't used in the last 180 days signs in.
 * Needs device history to compare against: skipped for an account's first session, and
 * for accounts whose only earlier sessions predate device tracking (deviceLabel null),
 * which would otherwise all get a false alarm on their first sign-in after this shipped.
 */
export async function alertIfNewDevice(user: { id: string; email: string; username: string }, ctx: DeviceContext, sessionId: string) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const [earlierSessions, seenDevice] = await Promise.all([
    prisma.refreshToken.count({ where: { userId: user.id, deviceLabel: { not: null }, NOT: { sessionId } } }),
    prisma.refreshToken.findFirst({ where: { userId: user.id, deviceLabel: ctx.deviceLabel, createdAt: { gte: since }, NOT: { sessionId } }, select: { id: true } }),
  ]);
  if (earlierSessions === 0 || seenDevice) return;

  const when = new Date().toUTCString();
  const where = ctx.ipPrefix ? ` from network ${ctx.ipPrefix}` : "";
  const settingsUrl = `${env.APP_WEB_URL.replace(/\/$/, "")}/app/settings`;

  await Promise.allSettled([
    createNotification({
      userId: user.id,
      type: "SYSTEM",
      title: "New sign-in to your account",
      body: `${ctx.deviceLabel}${where}. If this wasn't you, change your password and sign out other sessions in Settings.`,
      data: { kind: "new-sign-in", sessionId },
    }),
    sendEmail(
      user.email,
      "New sign-in to your Vexora Gaming account",
      [
        `Hi ${user.username},`,
        "",
        "Your Vexora Gaming account was just signed in to from a device we haven't seen before:",
        "",
        `  Device: ${ctx.deviceLabel}`,
        `  Time:   ${when}`,
        ctx.ipPrefix ? `  Network: ${ctx.ipPrefix}` : "",
        "",
        "If this was you, there's nothing to do.",
        `If it wasn't, change your password now and sign out the session: ${settingsUrl}`,
      ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n"),
    ),
  ]);
}
