/**
 * Delivery status rules, error redaction, recipient masking and send-error classification.
 * Pure functions only: nothing here touches the database, SMTP or the environment.
 */
import crypto from "node:crypto";

export const EMAIL_STATUSES = ["QUEUED", "ACCEPTED", "DELIVERED", "BOUNCED", "COMPLAINED", "FAILED", "UNKNOWN"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** "pipeline" is our own send code. "webhook" is a verified provider event. */
export type EmailActor = "pipeline" | "webhook";

/** Statuses only the pipeline may set. */
const PIPELINE_TARGETS: ReadonlySet<EmailStatus> = new Set<EmailStatus>(["QUEUED", "ACCEPTED", "FAILED", "UNKNOWN"]);
/** Statuses only a provider webhook may set. We never claim delivery ourselves. */
const WEBHOOK_TARGETS: ReadonlySet<EmailStatus> = new Set<EmailStatus>(["DELIVERED", "BOUNCED", "COMPLAINED", "FAILED"]);

type Edge = { to: EmailStatus; by: EmailActor };

/** Every allowed move between two different statuses. Anything not listed is refused. */
const EDGES: Record<EmailStatus, readonly Edge[]> = {
  QUEUED: [
    { to: "ACCEPTED", by: "pipeline" },
    { to: "FAILED", by: "pipeline" },
    { to: "UNKNOWN", by: "pipeline" },
    { to: "DELIVERED", by: "webhook" },
    { to: "BOUNCED", by: "webhook" },
    { to: "FAILED", by: "webhook" },
  ],
  ACCEPTED: [
    { to: "UNKNOWN", by: "pipeline" },
    { to: "DELIVERED", by: "webhook" },
    { to: "BOUNCED", by: "webhook" },
    { to: "COMPLAINED", by: "webhook" },
    { to: "FAILED", by: "webhook" },
  ],
  DELIVERED: [{ to: "COMPLAINED", by: "webhook" }],
  UNKNOWN: [
    { to: "DELIVERED", by: "webhook" },
    { to: "BOUNCED", by: "webhook" },
    { to: "COMPLAINED", by: "webhook" },
    { to: "FAILED", by: "webhook" },
  ],
  // Terminal: nothing moves out of these.
  BOUNCED: [],
  COMPLAINED: [],
  FAILED: [],
};

export type TransitionPlan = { ok: true; changed: boolean } | { ok: false; reason: string };

/**
 * Decide whether `actor` may move a record from `from` to `to`.
 * Setting the status it already has is allowed and changes nothing, so repeated events are harmless.
 */
export function planEmailTransition(from: EmailStatus, to: EmailStatus, actor: EmailActor): TransitionPlan {
  const allowedTargets = actor === "pipeline" ? PIPELINE_TARGETS : WEBHOOK_TARGETS;
  if (!allowedTargets.has(to)) {
    return { ok: false, reason: `${actor} may not set ${to}` };
  }
  if (from === to) {
    return { ok: true, changed: false };
  }
  if (EDGES[from].some((edge) => edge.to === to && edge.by === actor)) {
    return { ok: true, changed: true };
  }
  return { ok: false, reason: `${from} to ${to} is not allowed for ${actor}` };
}

/** Provider event types (the generic webhook body) mapped to the status they set. */
export const PROVIDER_EVENT_STATUS = {
  delivered: "DELIVERED",
  bounced: "BOUNCED",
  complained: "COMPLAINED",
  failed: "FAILED",
} as const satisfies Record<string, EmailStatus>;

export type ProviderEventType = keyof typeof PROVIDER_EVENT_STATUS;

export const MAX_ERROR_CHARS = 200;

/**
 * Makes an error string safe to store and show. Removes links, addresses, anything that looks like
 * a token or secret, and one-time codes, then caps the length. Input can be an Error or raw text.
 */
export function redactErrorText(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  let text = input instanceof Error ? input.message : String(input);
  text = text.replace(/[\u0000-\u001f\u007f]/g, " ");
  text = text.replace(/\bhttps?:\/\/\S+/gi, "[link]");
  text = text.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[address]");
  text = text.replace(/\b(pass(?:word)?|pwd|token|secret|api[_-]?key|otp|code)\b\s*[:=]\s*\S+/gi, "$1=[redacted]");
  text = text.replace(/\b\d{6,8}\b/g, "[code]");
  text = text.replace(/[A-Za-z0-9_\-+/=.]{24,}/g, "[redacted]");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS - 3)}...` : text;
}

export function normaliseRecipient(address: string): string {
  return address.trim().toLowerCase();
}

/** Display form only: first two letters of the local part, then the domain. The full address is never stored. */
export function maskRecipient(address: string): string {
  const normalised = normaliseRecipient(address);
  const at = normalised.lastIndexOf("@");
  if (at <= 0) return "[invalid]";
  const local = normalised.slice(0, at);
  const domain = normalised.slice(at + 1);
  const masked = `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
  return masked.length > 160 ? masked.slice(0, 160) : masked;
}

/** SHA-256 of the normalised address. Used to match records to an address without storing it. */
export function recipientHash(address: string): string {
  return crypto.createHash("sha256").update(normaliseRecipient(address)).digest("hex");
}

/** RFC 2606 / 6761 reserved names: mail to them can never arrive, it only bounces back to us. */
export function isUndeliverableAddress(address: string): boolean {
  const domain = normaliseRecipient(address).split("@")[1] ?? "";
  return /\.(test|invalid|example|localhost)$/.test(domain) || /^example\.(com|net|org)$/.test(domain);
}

export type FailureKind = "transient" | "permanent";

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ETIMEOUT", "ECONNECTION", "ESOCKET", "EPIPE"]);

/**
 * 4xx SMTP replies, connection resets and timeouts are worth retrying. 5xx replies, bad
 * addresses, failed logins and anything unrecognised are not, so they fail at once.
 */
export function classifySendError(error: unknown): FailureKind {
  const record = (typeof error === "object" && error !== null ? error : {}) as { code?: unknown; responseCode?: unknown; message?: unknown };
  const responseCode = typeof record.responseCode === "number" ? record.responseCode : null;
  if (responseCode !== null) {
    if (responseCode >= 400 && responseCode < 500) return "transient";
    return "permanent";
  }
  if (typeof record.code === "string") {
    if (TRANSIENT_CODES.has(record.code)) return "transient";
    if (record.code === "EAUTH" || record.code === "EENVELOPE" || record.code === "EMESSAGE") return "permanent";
  }
  const message = typeof record.message === "string" ? record.message : "";
  if (/ECONNRESET|ETIMEDOUT|timed out|timeout|socket hang up|connection reset/i.test(message)) {
    return "transient";
  }
  return "permanent";
}

/** Retries after the first attempt: at most two, so three attempts in total. */
export const MAX_SEND_RETRIES = 2;
const RETRY_DELAYS_MS = [1_000, 3_000] as const;

/** Wait before retry number `retryIndex` (0 for the first retry). */
export function retryDelayMs(retryIndex: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(retryIndex, 0), RETRY_DELAYS_MS.length - 1)];
}
