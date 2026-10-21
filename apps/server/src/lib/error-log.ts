import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { redactPathForLog } from "./log-format.js";

/** Most distinct problems kept at once, so a flood of junk reports can't fill the database. */
export const MAX_GROUPS = 2000;
/**
 * Browser reports (crashes and content-policy violations) can come from anyone, signed out too, so together they
 * may only use part of the room. A flood of made-up crash reports used to fill all 2000 slots, after which real
 * server errors were no longer recorded.
 */
export const MAX_WEB_GROUPS = 1000;

/** Whether a new problem of this kind may start a group, given how many groups exist now (`web`: all browser-sent groups). */
export function hasRoomForNewGroup(source: ErrorReport["source"], counts: { total: number; web: number }): boolean {
  if (counts.total >= MAX_GROUPS) return false;
  return source === "server" || counts.web < MAX_WEB_GROUPS;
}

export type ErrorReport = {
  /** "csp": a page broke (or would break) the Content-Security-Policy; sent by browsers, like "web". */
  source: "server" | "web" | "csp";
  message: string;
  stack?: string | null;
  path?: string | null;
};

/**
 * Paths without query strings or ids, so reset tokens never land in the log and repeats group together.
 * Token path segments (incoming webhooks: /api/webhooks/:id/:token) are removed too; the server error handler
 * prints this path and sends it to Discord.
 */
export function cleanPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw;
  try {
    path = new URL(raw, "http://x").pathname;
  } catch {
    path = raw.split("?")[0];
  }
  return redactPathForLog(path)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d{3,}(?=\/|$)/g, "/:n")
    .slice(0, 200);
}

/** The first line of a stack that points at our code: what identifies "the same bug". */
function topFrame(stack: string | null | undefined) {
  return (stack ?? "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.startsWith("at ") && !line.includes("node_modules") && !line.includes("node:internal")) ?? "";
}

/** Normalises numbers and ids out of a message so "row 17" and "row 18" are one problem. */
function messageKey(message: string) {
  return message.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").replace(/\d+/g, "#").slice(0, 200);
}

export function errorFingerprint(report: ErrorReport) {
  const frame = topFrame(report.stack).replace(/:\d+:\d+\)?$/, "");
  return crypto.createHash("sha256").update(`${report.source}|${messageKey(report.message)}|${frame}|${cleanPath(report.path) ?? ""}`).digest("hex");
}

/** Record a problem. Never throws: logging an error must not cause another one. */
export async function recordError(report: ErrorReport) {
  try {
    const message = (report.message || "Unknown error").replace(/\s+/g, " ").trim().slice(0, 400);
    const detail = report.stack ? report.stack.slice(0, 4000) : null;
    const path = cleanPath(report.path);
    const fingerprint = errorFingerprint({ ...report, message });
    const bumped = await prisma.errorEvent.updateMany({ where: { fingerprint }, data: { count: { increment: 1 }, lastSeenAt: new Date() } });
    if (bumped.count) return;
    const [total, web] = await Promise.all([
      prisma.errorEvent.count(),
      report.source === "server" ? Promise.resolve(0) : prisma.errorEvent.count({ where: { source: { not: "server" } } }),
    ]);
    if (!hasRoomForNewGroup(report.source, { total, web })) return;
    await prisma.errorEvent.create({ data: { source: report.source, fingerprint, message, detail, path } }).catch(async (error) => {
      // Two copies of a brand-new problem at once: the other one created it, so count this one.
      if ((error as { code?: string }).code === "P2002") {
        await prisma.errorEvent.updateMany({ where: { fingerprint }, data: { count: { increment: 1 }, lastSeenAt: new Date() } });
      }
    });
  } catch (error) {
    console.error("[error-log] could not record an error:", error);
  }
}
