/**
 * The send pipeline: record, dedupe, send, retry, record the outcome. Everything it touches comes in
 * through `deps`, so the same code runs against Prisma and nodemailer in production and against a
 * memory store and fake transports in the tests. Nothing here connects to a database or a mail server.
 *
 * Status rules: this pipeline records QUEUED, then ACCEPTED (SMTP took the message) or FAILED.
 * Only a provider webhook can move a record to DELIVERED, BOUNCED or COMPLAINED.
 */
import { DUPLICATE_WINDOW_MS, OPTIONAL_PREFERENCE_BY_KIND, TEMPLATE_CATEGORY, type EmailCategory, type EmailKind, type OptionalPreferenceKey } from "./email-policy.js";
import { renderEmail, sanitizeSubject, type EmailContext, type EmailKindData } from "./email-templates.js";
import {
  classifySendError,
  isUndeliverableAddress,
  MAX_SEND_RETRIES,
  maskRecipient,
  normaliseRecipient,
  PROVIDER_EVENT_STATUS,
  planEmailTransition,
  recipientHash,
  redactErrorText,
  retryDelayMs,
  type EmailStatus,
  type ProviderEventType,
} from "./email-status.js";

export type EmailMode = "smtp" | "test" | "unconfigured";
export type TransportLabel = "smtp" | "test" | "console";

export type MailMessage = {
  from: { name: string; address: string };
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/** Hands one message to a transport. Resolves with the provider's message id when it has one. */
export type TransportSend = (message: MailMessage) => Promise<{ messageId?: string }>;

export type EmailRecordRow = {
  kind: string;
  category: EmailCategory;
  transport: string;
  userId: string | null;
  recipientHash: string;
  recipientMasked: string;
  subject: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
};

export interface EmailRecordStore {
  create(row: EmailRecordRow): Promise<string>;
  /** Moves a record from `from` to `to` only if it is still in `from`. Returns false when it has moved on. */
  transition(
    id: string,
    from: EmailStatus,
    to: EmailStatus,
    patch?: { providerMessageId?: string | null; attempts?: number; lastError?: string | null },
  ): Promise<boolean>;
  findByProviderMessageId(messageId: string): Promise<{ id: string; status: EmailStatus } | null>;
  /** Most recent non-failed send of this kind and subject to this account, at or after `since`. */
  latestSendAt(params: { userId: string; kind: string; subject: string; since: Date }): Promise<Date | null>;
}

export type EmailPipelineDeps = {
  store: EmailRecordStore;
  transports: Record<"smtp" | "test", TransportSend>;
  mode: () => EmailMode;
  context: () => EmailContext;
  sender: () => { name: string; address: string };
  replyTo: () => string | undefined;
  isOptedIn: (userId: string, key: OptionalPreferenceKey) => Promise<boolean>;
  unsubscribeUrl: (userId: string, key: OptionalPreferenceKey) => string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log: (line: string) => void;
};

export type SendResult = {
  delivered: boolean;
  transport: TransportLabel;
  error?: string;
  /** True when an identical essential email went out moments ago, so this one was not sent. */
  suppressed?: boolean;
  /** True when optional mail was skipped because the account has not opted in. */
  skipped?: "not-subscribed";
  messageId?: string;
};

export type SendMessageInput = {
  kind: string;
  category: EmailCategory;
  to: string;
  subject: string;
  text: string;
  html: string;
  userId?: string | null;
  unsubscribeUrl?: string;
};

export const NOT_CONFIGURED_ERROR = "Email delivery is not configured (SMTP_HOST missing)";

export function transportLabel(mode: EmailMode): TransportLabel {
  return mode === "unconfigured" ? "console" : mode;
}

export function createEmailPipeline(deps: EmailPipelineDeps) {
  /** Same-process guard: two identical sends racing each other. The database check covers the rest. */
  const inFlight = new Set<string>();

  async function safely<T>(label: string, action: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await action();
    } catch (error) {
      // A failed record write must never stop the email itself (or break the sign-in that asked for it).
      deps.log(`[MAIL] ${label} failed: ${redactErrorText(error) ?? "unknown error"}`);
      return fallback;
    }
  }

  /** How many seconds until an identical essential send is allowed again. 0 means it is allowed now. */
  async function duplicateWaitSeconds(userId: string, kind: string, subject: string): Promise<number> {
    const nowMs = deps.now();
    const sentAt = await safely(
      "duplicate check",
      () => deps.store.latestSendAt({ userId, kind, subject, since: new Date(nowMs - DUPLICATE_WINDOW_MS) }),
      null,
    );
    if (!sentAt) return 0;
    return Math.max(1, Math.ceil((sentAt.getTime() + DUPLICATE_WINDOW_MS - nowMs) / 1000));
  }

  async function advance(
    id: string | null,
    from: EmailStatus,
    to: EmailStatus,
    patch: { providerMessageId?: string | null; attempts?: number; lastError?: string | null } = {},
  ) {
    if (!id) return;
    // The pipeline may only set QUEUED, ACCEPTED, FAILED or UNKNOWN. Anything else is a programming error.
    const plan = planEmailTransition(from, to, "pipeline");
    if (!plan.ok) {
      deps.log(`[MAIL] refused status change: ${plan.reason}`);
      return;
    }
    await safely("status update", () => deps.store.transition(id, from, to, patch), false);
  }

  async function createRecord(row: EmailRecordRow): Promise<string | null> {
    return safely("record write", () => deps.store.create(row), null);
  }

  async function sendMessage(input: SendMessageInput): Promise<SendResult> {
    const mode = deps.mode();
    const label = transportLabel(mode);
    const address = normaliseRecipient(input.to);
    const subject = sanitizeSubject(input.subject);
    const base = {
      kind: input.kind,
      category: input.category,
      userId: input.userId ?? null,
      recipientHash: recipientHash(address),
      recipientMasked: maskRecipient(address),
      subject,
    };

    if (isUndeliverableAddress(address)) {
      await createRecord({ ...base, transport: label, status: "FAILED", attempts: 0, lastError: "Reserved test address" });
      return { delivered: false, transport: "console", error: "Reserved test address" };
    }

    // Essential mail (codes, links, security notices) is not sent twice to the same account within a
    // short window. Optional mail is not deduplicated here: it is sent deliberately, once.
    const dedupeKey = input.userId && input.category === "ESSENTIAL" ? `${input.userId}|${input.kind}|${subject}` : null;
    // Claim the key before the first await, so two racing sends cannot both pass the check.
    if (dedupeKey && inFlight.has(dedupeKey)) {
      deps.log(`[MAIL] suppressed duplicate kind=${input.kind}`);
      return { delivered: false, transport: label, error: "Duplicate suppressed", suppressed: true };
    }
    if (dedupeKey) inFlight.add(dedupeKey);

    try {
      if (dedupeKey && (await duplicateWaitSeconds(input.userId!, input.kind, subject)) > 0) {
        deps.log(`[MAIL] suppressed duplicate kind=${input.kind}`);
        return { delivered: false, transport: label, error: "Duplicate suppressed", suppressed: true };
      }

      if (mode === "unconfigured") {
        await createRecord({ ...base, transport: label, status: "FAILED", attempts: 0, lastError: NOT_CONFIGURED_ERROR });
        return { delivered: false, transport: "console", error: NOT_CONFIGURED_ERROR };
      }

      const rowId = await createRecord({ ...base, transport: label, status: "QUEUED", attempts: 0, lastError: null });
      const message: MailMessage = {
        from: deps.sender(),
        ...(deps.replyTo() ? { replyTo: deps.replyTo() } : {}),
        to: input.to.trim(),
        subject,
        text: input.text,
        html: input.html,
        ...(input.unsubscribeUrl
          ? { headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
          : {}),
      };

      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          const info = await deps.transports[mode](message);
          const messageId = info.messageId ?? undefined;
          await advance(rowId, "QUEUED", "ACCEPTED", { providerMessageId: messageId ?? null, attempts: attempt });
          return { delivered: true, transport: label, ...(messageId ? { messageId } : {}) };
        } catch (error) {
          const failure = classifySendError(error);
          const reason = redactErrorText(error) ?? "SMTP send failed";
          if (failure === "transient" && attempt <= MAX_SEND_RETRIES) {
            deps.log(`[MAIL] transient failure kind=${input.kind} attempt=${attempt}, retrying`);
            await deps.sleep(retryDelayMs(attempt - 1));
            continue;
          }
          await advance(rowId, "QUEUED", "FAILED", { attempts: attempt, lastError: reason });
          return { delivered: false, transport: label, error: reason };
        }
      }
    } finally {
      if (dedupeKey) inFlight.delete(dedupeKey);
    }
  }

  /**
   * Renders a template and sends it. OPTIONAL kinds are sent only to accounts that opted in, and
   * carry a signed unsubscribe link. ESSENTIAL kinds never do.
   */
  async function sendTemplate<K extends EmailKind>(
    kind: K,
    to: string,
    data: EmailKindData[K],
    options: { userId?: string | null } = {},
  ): Promise<SendResult> {
    const label = transportLabel(deps.mode());
    const category = TEMPLATE_CATEGORY[kind];
    const key = OPTIONAL_PREFERENCE_BY_KIND[kind];
    let unsubscribe: string | undefined;

    if (category === "OPTIONAL") {
      if (!options.userId || !key) {
        return { delivered: false, transport: label, skipped: "not-subscribed" };
      }
      if (!(await deps.isOptedIn(options.userId, key))) {
        return { delivered: false, transport: label, skipped: "not-subscribed" };
      }
      unsubscribe = deps.unsubscribeUrl(options.userId, key);
    }

    const rendered = renderEmail(kind, data, deps.context(), unsubscribe ? { unsubscribeUrl: unsubscribe } : {});
    return sendMessage({
      kind,
      category,
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      userId: options.userId ?? null,
      ...(unsubscribe ? { unsubscribeUrl: unsubscribe } : {}),
    });
  }

  /**
   * Applies a verified provider event. Only a webhook may call this, and the transition table decides
   * whether the change is allowed. A repeat of the same event changes nothing.
   */
  async function recordProviderEvent(input: { messageId: string; type: ProviderEventType }): Promise<{ matched: boolean; applied: boolean; status?: EmailStatus }> {
    const row = await deps.store.findByProviderMessageId(input.messageId);
    if (!row) return { matched: false, applied: false };
    const target = PROVIDER_EVENT_STATUS[input.type];
    const plan = planEmailTransition(row.status, target, "webhook");
    if (!plan.ok || !plan.changed) return { matched: true, applied: false, status: row.status };
    const applied = await deps.store.transition(row.id, row.status, target);
    return { matched: true, applied, status: applied ? target : row.status };
  }

  return { sendMessage, sendTemplate, recordProviderEvent, duplicateWaitSeconds };
}

export type EmailPipeline = ReturnType<typeof createEmailPipeline>;
