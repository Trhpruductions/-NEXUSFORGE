import { promises as fs } from "fs";
import path from "path";
import type { AgeGateDeviceProfile } from "@/lib/age-gate-risk";

export type AgeGateAuditStatus = "approved" | "denied" | "blocked" | "rejected" | "error";
export type AgeGateAuditAction = "verify" | "reject";

export type AgeGateAuditEvent = {
  id: string;
  createdAt: string;
  action: AgeGateAuditAction;
  status: AgeGateAuditStatus;
  confirmed: boolean;
  fingerprint: string;
  ip: string;
  userAgent: string;
  risk: {
    score: number;
    level: "low" | "medium" | "high" | "critical";
    reasons: string[];
  };
  deviceProfile: AgeGateDeviceProfile;
  note?: string;
};

const auditLogFilePath = path.join(process.cwd(), "var", "age-gate-audit.jsonl");

async function ensureAuditDirectory() {
  await fs.mkdir(path.dirname(auditLogFilePath), { recursive: true });
}

export async function appendAgeGateAuditEvent(event: Omit<AgeGateAuditEvent, "id" | "createdAt">) {
  const entry: AgeGateAuditEvent = {
    id: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...event,
  };

  try {
    await ensureAuditDirectory();
    await fs.appendFile(auditLogFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[age-gate-audit] failed to persist event:", error);
  }

  return entry;
}
