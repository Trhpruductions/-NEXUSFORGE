import { api, authHeaders } from "@/lib/api";

export type LegalPolicySummary = {
  slug: string;
  title: string;
  summary: string | null;
  requiredAtSignup: boolean;
  published: { version: number; effectiveAt: string | null; publishedAt: string | null } | null;
};

export type LegalVersion = {
  id: string;
  version: number;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  content: string;
  changeSummary: string | null;
  effectiveAt: string | null;
  publishedAt: string | null;
  requiresConsent: boolean;
  consentText: string | null;
};

export type LegalHistoryEntry = { version: number; status: string; effectiveAt: string | null; publishedAt: string | null; changeSummary: string | null };

export type RequiredPolicy = { policyId: string; slug: string; title: string; versionId: string; version: number; requiresConsent: boolean; consentText: string };

export async function listLegalPolicies() {
  const response = await api.get<{ policies: LegalPolicySummary[] }>("/api/legal/policies");
  return response.data;
}

export async function getLegalPolicy(slug: string, version?: number) {
  const response = await api.get<{ policy: Omit<LegalPolicySummary, "published">; version: LegalVersion | null; history: LegalHistoryEntry[] }>(`/api/legal/policies/${encodeURIComponent(slug)}`, {
    params: version ? { version } : undefined,
  });
  return response.data;
}

export async function getRequiredPolicies() {
  const response = await api.get<{ policies: RequiredPolicy[] }>("/api/legal/required");
  return response.data;
}

export async function getPendingConsents(accessToken: string) {
  const response = await api.get<{ pending: RequiredPolicy[] }>("/api/legal/me/pending", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function acceptPolicies(accessToken: string, csrfToken: string, versionIds: string[]) {
  const response = await api.post<{ ok: true; pending: RequiredPolicy[] }>("/api/legal/me/accept", { versionIds }, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

// --- admin ---------------------------------------------------------------

export type AdminVersionRow = Omit<LegalVersion, "content" | "consentText"> & { createdById: string; createdAt: string; updatedAt: string; restoredFromId: string | null };
export type AdminPolicy = { id: string; slug: string; title: string; summary: string | null; requiredAtSignup: boolean; versions: AdminVersionRow[] };
export type LegalAuditRow = { id: string; actorId: string; actorName: string; action: string; policySlug: string; version: number | null; details: Record<string, unknown> | null; createdAt: string };

export async function adminListPolicies(accessToken: string) {
  const response = await api.get<{ policies: AdminPolicy[]; canPublish: boolean }>("/api/legal/admin/policies", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function adminGetVersion(accessToken: string, id: string) {
  const response = await api.get<{ version: LegalVersion & { policy: { slug: string; title: string } }; placeholders: string[]; acceptanceCount: number }>(`/api/legal/admin/versions/${id}`, { headers: authHeaders(accessToken) });
  return response.data;
}

export async function adminCreateDraft(accessToken: string, csrfToken: string, slug: string, payload: { content?: string; changeSummary?: string } = {}) {
  const response = await api.post<{ version: LegalVersion }>(`/api/legal/admin/policies/${slug}/versions`, payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function adminEditVersion(accessToken: string, csrfToken: string, id: string, payload: { content?: string; changeSummary?: string | null; requiresConsent?: boolean; consentText?: string }) {
  const response = await api.patch<{ version: LegalVersion; placeholders: string[] }>(`/api/legal/admin/versions/${id}`, payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function adminTransition(
  accessToken: string,
  csrfToken: string,
  id: string,
  payload: { action: "submit" | "return" | "publish" | "archive" | "restore"; confirm?: boolean; effectiveAt?: string; requiresConsent?: boolean },
) {
  const response = await api.post<{ version: LegalVersion; replaced?: number | null }>(`/api/legal/admin/versions/${id}/transition`, payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function adminLegalAudit(accessToken: string, slug?: string) {
  const response = await api.get<{ entries: LegalAuditRow[] }>("/api/legal/admin/audit", { headers: authHeaders(accessToken), params: slug ? { slug } : undefined });
  return response.data;
}
