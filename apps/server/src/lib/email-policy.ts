/**
 * Email policy in one place: which kinds of email exist, whether each one is essential or optional,
 * and what "opted in" means. Pure: no database, no SMTP, no environment reads.
 */
import { z } from "zod";

export const EMAIL_KINDS = [
  "verification-code",
  "email-change-requested",
  "verify-email-link",
  "password-reset",
  "password-changed",
  "email-changed",
  "welcome",
  "planned-maintenance",
  "service-notice",
  "release-notes",
  "product-announcement",
] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

/**
 * ESSENTIAL mail (codes, links, security and account-change notices, service messages) is never
 * unsubscribable and never gated by preferences. OPTIONAL mail needs an explicit opt-in.
 */
export type EmailCategory = "ESSENTIAL" | "OPTIONAL";

export const TEMPLATE_CATEGORY: Record<EmailKind, EmailCategory> = {
  "verification-code": "ESSENTIAL",
  "email-change-requested": "ESSENTIAL",
  "verify-email-link": "ESSENTIAL",
  "password-reset": "ESSENTIAL",
  "password-changed": "ESSENTIAL",
  "email-changed": "ESSENTIAL",
  welcome: "ESSENTIAL",
  "planned-maintenance": "ESSENTIAL",
  "service-notice": "ESSENTIAL",
  "release-notes": "OPTIONAL",
  "product-announcement": "OPTIONAL",
};

export const OPTIONAL_PREFERENCE_KEYS = ["announcements", "releaseNotes", "promotions"] as const;
export type OptionalPreferenceKey = (typeof OPTIONAL_PREFERENCE_KEYS)[number];

/** Which opt-in an optional kind needs. "promotions" is reserved: no promotions template exists yet. */
export const OPTIONAL_PREFERENCE_BY_KIND: Partial<Record<EmailKind, OptionalPreferenceKey>> = {
  "product-announcement": "announcements",
  "release-notes": "releaseNotes",
};

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === "string" && (EMAIL_KINDS as readonly string[]).includes(value);
}

/** Stored at User.preferences.email. Every flag defaults to OFF. */
export const emailOptInSchema = z.object({
  announcements: z.boolean().default(false),
  releaseNotes: z.boolean().default(false),
  promotions: z.boolean().default(false),
});

export type EmailOptIns = z.infer<typeof emailOptInSchema>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the opt-in flags from a User.preferences value. Anything but an explicit true is "no". */
export function parseEmailOptIns(raw: unknown): EmailOptIns {
  const parsed = emailOptInSchema.safeParse(isPlainObject(raw) ? raw : {});
  return parsed.success ? parsed.data : emailOptInSchema.parse({});
}

export function isOptedIn(preferences: unknown, key: OptionalPreferenceKey): boolean {
  const section = isPlainObject(preferences) ? preferences.email : undefined;
  return parseEmailOptIns(section)[key] === true;
}

/** Returns a new preferences object with one opt-in flag set. Other preference sections are kept. */
export function withOptIn(preferences: unknown, key: OptionalPreferenceKey, value: boolean): Record<string, unknown> {
  const base = isPlainObject(preferences) ? preferences : {};
  return { ...base, email: { ...parseEmailOptIns(base.email), [key]: value } };
}

/** Two sends of the same kind (same subject) to the same account closer together than this are one send. */
export const DUPLICATE_WINDOW_MS = 60_000;

/** Unsubscribe links stay valid for a year, so an old newsletter's link still works. */
export const UNSUBSCRIBE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type EmailMode = "smtp" | "test" | "unconfigured";

/**
 * Which transport handles mail. Test mode wins whenever it is on, even with SMTP configured, so a
 * dry run can never reach a real inbox. Outside production, a missing SMTP host means test mode.
 * In production, a missing SMTP host means sends fail loudly (never a silent JSON "send").
 */
export function resolveEmailMode(input: { testMode: boolean; smtpHost?: string | undefined; production: boolean }): EmailMode {
  if (input.testMode) return "test";
  if (input.smtpHost) return "smtp";
  return input.production ? "unconfigured" : "test";
}
