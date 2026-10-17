import { api, authHeaders } from "@/lib/api";

/** Staff email tools. Every call needs a staff account; the server checks the role on each request. */

export type EmailMode = "smtp" | "test" | "unconfigured";
export type EmailCategory = "ESSENTIAL" | "OPTIONAL";
export type EmailMessageStatus = "QUEUED" | "ACCEPTED" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "FAILED" | "UNKNOWN";

export const EMAIL_STATUS_VALUES: EmailMessageStatus[] = ["QUEUED", "ACCEPTED", "DELIVERED", "BOUNCED", "COMPLAINED", "FAILED", "UNKNOWN"];

export type EmailStatusResponse = {
  mode: EmailMode;
  testMode: boolean;
  smtp: { hostConfigured: boolean; userConfigured: boolean; passwordConfigured: boolean; secure: boolean };
  sender: { name: string; address: string };
  replyToConfigured: boolean;
  contacts: { support: string | null; security: string | null; updates: string | null };
  webhook: { enabled: boolean; path: string };
  unsubscribe: { keySource: "dedicated" | "derived-from-jwt-secret" };
  testAllowlistCount: number;
  appWebUrl: string;
  dedupeWindowSeconds: number;
  maxRetries: number;
  nodeEnv: string;
  warnings: string[];
};

export type EmailMessageRow = {
  id: string;
  kind: string;
  category: EmailCategory;
  transport: string;
  status: EmailMessageStatus;
  recipientMasked: string;
  subject: string;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailMessagesResponse = { messages: EmailMessageRow[]; nextCursor: string | null };

export type EmailStatsResponse = {
  windowDays: number;
  since: string;
  total: number;
  byStatus: Record<EmailMessageStatus, number>;
  byKind: Array<{ kind: string; count: number }>;
};

export type EmailTemplateInfo = {
  kind: string;
  category: EmailCategory;
  label: string;
  description: string;
  optInKey: string | null;
};

export type EmailTemplatePreview = { kind: string; category: EmailCategory; subject: string; text: string; html: string };

export type EmailTestResult = { accepted: boolean; transport: string; mode: EmailMode; suppressed: boolean; error: string | null };

export async function getEmailStatus(accessToken: string) {
  return (await api.get<EmailStatusResponse>("/api/admin/email/status", { headers: authHeaders(accessToken) })).data;
}

export async function listEmailMessages(
  accessToken: string,
  params: { status?: EmailMessageStatus | ""; kind?: string; cursor?: string | null; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.kind) query.set("kind", params.kind);
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? 50));
  return (await api.get<EmailMessagesResponse>(`/api/admin/email/messages?${query.toString()}`, { headers: authHeaders(accessToken) })).data;
}

export async function getEmailStats(accessToken: string) {
  return (await api.get<EmailStatsResponse>("/api/admin/email/stats", { headers: authHeaders(accessToken) })).data;
}

export async function listEmailTemplates(accessToken: string) {
  return (await api.get<{ templates: EmailTemplateInfo[] }>("/api/admin/email/templates", { headers: authHeaders(accessToken) })).data.templates;
}

export async function getEmailTemplatePreview(accessToken: string, kind: string) {
  return (await api.get<EmailTemplatePreview>(`/api/admin/email/templates/${encodeURIComponent(kind)}`, { headers: authHeaders(accessToken) })).data;
}

/** Sends one test email. Allowed only to the admin's own verified address or the server's test allowlist. */
export async function sendEmailTest(accessToken: string, csrfToken: string, payload: { to: string; password: string }) {
  return (await api.post<EmailTestResult>("/api/admin/email/test", payload, { headers: authHeaders(accessToken, csrfToken) })).data;
}
