import { promises as fs } from "fs";
import path from "path";

export type AgeGateAllowlistEntry = {
  id: string;
  fingerprint: string;
  createdAt: string;
  approvedBy?: string;
  note?: string;
};

const allowlistFilePath = path.join(process.cwd(), "var", "age-gate-allowlist.jsonl");

async function ensureAllowlistDirectory() {
  await fs.mkdir(path.dirname(allowlistFilePath), { recursive: true });
}

export async function loadAgeGateAllowlistEntries(): Promise<AgeGateAllowlistEntry[]> {
  try {
    const content = await fs.readFile(allowlistFilePath, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AgeGateAllowlistEntry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error("[age-gate-allowlist] failed to read allowlist:", error);
    return [];
  }
}

export async function isAgeGateFingerprintAllowed(fingerprint: string) {
  const entries = await loadAgeGateAllowlistEntries();
  return entries.some((entry) => entry.fingerprint === fingerprint);
}

export async function addAgeGateAllowlistEntry(fingerprint: string, approvedBy?: string, note?: string) {
  const entry: AgeGateAllowlistEntry = {
    id: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    fingerprint,
    createdAt: new Date().toISOString(),
    approvedBy,
    note,
  };

  try {
    await ensureAllowlistDirectory();
    await fs.appendFile(allowlistFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[age-gate-allowlist] failed to persist entry:", error);
  }

  return entry;
}
