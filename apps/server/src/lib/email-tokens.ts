/**
 * Signing and checking for two things: provider webhooks (HMAC-SHA256 over the raw body, with a
 * timestamp and replay guard) and unsubscribe links (HMAC-signed, expiring). Pure: the secrets are
 * passed in, nothing is read from the environment here.
 */
import crypto from "node:crypto";
import { OPTIONAL_PREFERENCE_KEYS, UNSUBSCRIBE_TTL_MS, type OptionalPreferenceKey } from "./email-policy.js";

export const WEBHOOK_TIMESTAMP_HEADER = "x-nexus-timestamp";
export const WEBHOOK_SIGNATURE_HEADER = "x-nexus-signature";
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;
export const MIN_SECRET_LENGTH = 32;

/** A secret is usable only when it is long enough to be worth trusting. */
export function secretUsable(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

/** Signature header value for a request: "v1=" + HMAC-SHA256 of `${timestamp}.${rawBody}`. */
export function signWebhookBody(secret: string, timestamp: string, rawBody: Buffer): string {
  const mac = crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
  return `v1=${mac}`;
}

/**
 * Remembers signatures that were accepted, so the exact same signed request cannot be replayed
 * inside its five-minute window. Bounded in size; expired entries are dropped first.
 */
export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly maxEntries = 10_000) {}

  /** True when the key is new (and is now remembered). False when it was already seen and is still live. */
  remember(key: string, expiresAtMs: number, nowMs: number): boolean {
    const existing = this.seen.get(key);
    if (existing !== undefined && existing > nowMs) return false;
    if (this.seen.size >= this.maxEntries) {
      for (const [entry, expiry] of this.seen) {
        if (expiry <= nowMs) this.seen.delete(entry);
      }
      if (this.seen.size >= this.maxEntries) {
        const oldest = this.seen.keys().next().value;
        if (oldest !== undefined) this.seen.delete(oldest);
      }
    }
    this.seen.set(key, expiresAtMs);
    return true;
  }
}

export type WebhookVerdict =
  | { ok: true }
  | { ok: false; reason: "disabled" | "missing-headers" | "bad-timestamp" | "stale-timestamp" | "bad-signature" | "replay" };

export function verifyWebhookSignature(params: {
  secret: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: Buffer;
  nowMs: number;
  replay: ReplayGuard;
}): WebhookVerdict {
  if (!secretUsable(params.secret)) return { ok: false, reason: "disabled" };
  if (!params.timestamp || !params.signature) return { ok: false, reason: "missing-headers" };
  // Unix seconds only. Anything else is refused before any comparison happens.
  if (!/^\d{10}$/.test(params.timestamp)) return { ok: false, reason: "bad-timestamp" };
  const timestampMs = Number(params.timestamp) * 1000;
  if (Math.abs(params.nowMs - timestampMs) > WEBHOOK_TOLERANCE_MS) return { ok: false, reason: "stale-timestamp" };

  const expected = Buffer.from(signWebhookBody(params.secret, params.timestamp, params.rawBody));
  const received = Buffer.from(params.signature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  // Only signatures that passed the check are remembered, so forged requests cannot fill the cache.
  if (!params.replay.remember(params.signature, timestampMs + WEBHOOK_TOLERANCE_MS, params.nowMs)) {
    return { ok: false, reason: "replay" };
  }
  return { ok: true };
}

/**
 * The key that signs unsubscribe links. EMAIL_UNSUBSCRIBE_SECRET when set; otherwise a key derived
 * from JWT_ACCESS_SECRET, so links still work on a server that has not set a dedicated secret.
 */
export function unsubscribeKey(params: { explicit?: string; fallbackSecret: string }): Buffer {
  if (secretUsable(params.explicit)) return Buffer.from(params.explicit, "utf8");
  return crypto.createHmac("sha256", params.fallbackSecret).update("nexus-forge:email-unsubscribe:v1").digest();
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function macOf(key: Buffer, body: string): string {
  return base64url(crypto.createHmac("sha256", key).update(body).digest());
}

export type UnsubscribeClaims = { userId: string; category: OptionalPreferenceKey; expiresAtMs: number };

/** Token format: base64url(JSON claims) + "." + base64url(HMAC-SHA256(claims)). */
export function signUnsubscribeToken(key: Buffer, claims: UnsubscribeClaims): string {
  const body = base64url(JSON.stringify({ u: claims.userId, c: claims.category, e: claims.expiresAtMs }));
  return `${body}.${macOf(key, body)}`;
}

export function issueUnsubscribeToken(key: Buffer, userId: string, category: OptionalPreferenceKey, nowMs: number): string {
  return signUnsubscribeToken(key, { userId, category, expiresAtMs: nowMs + UNSUBSCRIBE_TTL_MS });
}

export type UnsubscribeVerdict =
  | { ok: true; userId: string; category: OptionalPreferenceKey }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" | "unknown-category" };

export function verifyUnsubscribeToken(key: Buffer, token: string, nowMs: number): UnsubscribeVerdict {
  if (typeof token !== "string" || token.length === 0 || token.length > 1024) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, mac] = parts;

  // The signature is checked before the claims are read, so a tampered payload is never trusted.
  const expected = Buffer.from(macOf(key, body));
  const received = Buffer.from(mac);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof claims !== "object" || claims === null) return { ok: false, reason: "malformed" };
  const { u, c, e } = claims as { u?: unknown; c?: unknown; e?: unknown };
  if (typeof u !== "string" || u.length === 0 || u.length > 64 || typeof e !== "number" || !Number.isFinite(e)) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof c !== "string" || !(OPTIONAL_PREFERENCE_KEYS as readonly string[]).includes(c)) {
    return { ok: false, reason: "unknown-category" };
  }
  if (e <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true, userId: u, category: c as OptionalPreferenceKey };
}
