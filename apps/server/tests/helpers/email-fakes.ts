/**
 * In-memory stand-ins for the email pipeline's dependencies. No database, no SMTP: the tests drive the
 * real pipeline and webhook code through these fakes, so nothing can reach a real provider.
 */
import type { EmailPipelineDeps, EmailRecordRow, EmailRecordStore, MailMessage, TransportSend } from "../../src/lib/email-pipeline.js";
import type { EmailStatus } from "../../src/lib/email-status.js";
import type { EmailContext } from "../../src/lib/email-templates.js";

export type StoredRow = EmailRecordRow & { id: string; providerMessageId: string | null; createdAtMs: number };

export const TEST_CONTEXT: EmailContext = { appUrl: "https://nexus.example.org" };

export function createMemoryStore(startMs = Date.parse("2026-10-14T12:00:00Z")) {
  const rows = new Map<string, StoredRow>();
  let counter = 0;
  let clockMs = startMs;

  const store: EmailRecordStore = {
    async create(row) {
      counter += 1;
      const id = `row-${counter}`;
      rows.set(id, { ...row, id, providerMessageId: null, createdAtMs: clockMs });
      return id;
    },
    async transition(id, from, to, patch = {}) {
      const row = rows.get(id);
      if (!row || row.status !== from) return false;
      row.status = to;
      if (patch.providerMessageId !== undefined) row.providerMessageId = patch.providerMessageId;
      if (patch.attempts !== undefined) row.attempts = patch.attempts;
      if (patch.lastError !== undefined) row.lastError = patch.lastError;
      return true;
    },
    async findByProviderMessageId(messageId) {
      const matches = [...rows.values()].filter((row) => row.providerMessageId === messageId).sort((a, b) => b.createdAtMs - a.createdAtMs);
      return matches[0] ? { id: matches[0].id, status: matches[0].status } : null;
    },
    async latestSendAt({ userId, kind, subject, since }) {
      const matches = [...rows.values()].filter(
        (row) => row.userId === userId && row.kind === kind && row.subject === subject && row.status !== "FAILED" && row.createdAtMs >= since.getTime(),
      );
      if (!matches.length) return null;
      return new Date(Math.max(...matches.map((row) => row.createdAtMs)));
    },
  };

  return {
    store,
    rows,
    advance(ms: number) {
      clockMs += ms;
    },
    now: () => clockMs,
    setStatus(id: string, status: EmailStatus) {
      const row = rows.get(id);
      if (row) row.status = status;
    },
  };
}

export type Outcome = { ok: true; messageId?: string } | { ok: false; error: unknown };

/** Transport that plays back a script of outcomes. The last outcome repeats once the script runs out. */
export function scriptedTransport(script: Outcome[]) {
  const sent: MailMessage[] = [];
  let index = 0;
  const send: TransportSend = async (message) => {
    sent.push(message);
    const outcome = script[Math.min(index, script.length - 1)] ?? { ok: true as const };
    index += 1;
    if (!outcome.ok) throw outcome.error;
    return { messageId: outcome.messageId ?? `<msg-${index}@test.invalid>` };
  };
  return { send, sent, calls: () => sent.length };
}

export function smtpError(responseCode: number, message = `${responseCode} temporary failure`): Error & { responseCode: number } {
  return Object.assign(new Error(message), { responseCode });
}

export function netError(code: string, message = `${code} connection problem`): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/** Full pipeline dependencies with in-memory fakes. Override any piece per test. */
export function makePipelineDeps(overrides: Partial<EmailPipelineDeps> & { memory?: ReturnType<typeof createMemoryStore>; transport?: TransportSend } = {}) {
  const memory = overrides.memory ?? createMemoryStore();
  const transport = overrides.transport ?? scriptedTransport([{ ok: true }]).send;
  const sleeps: number[] = [];
  const logs: string[] = [];
  const deps: EmailPipelineDeps = {
    store: memory.store,
    transports: { smtp: transport, test: transport },
    mode: () => "smtp",
    context: () => TEST_CONTEXT,
    sender: () => ({ name: "Nexus Forge Gaming", address: "no-reply@nexus.example.org" }),
    replyTo: () => undefined,
    isOptedIn: async () => false,
    unsubscribeUrl: (userId, key) => `https://api.example.org/api/email/unsubscribe?token=fake-${userId}-${key}`,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => memory.now(),
    log: (line) => logs.push(line),
    ...overrides,
  };
  return { deps, memory, sleeps, logs };
}
