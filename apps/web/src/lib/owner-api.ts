import { api, authHeaders } from "@/lib/api";

export type FinanceWindow = "today" | "week" | "month" | "all";

export type FinanceTotals = {
  window: FinanceWindow;
  since: string | null;
  grossCents: number;
  refundCents: number;
  refundCount: number;
  lostDisputeCents: number;
  lostDisputeCount: number;
  openDisputeCents: number;
  openDisputeCount: number;
  feeCents: number;
  netCents: number;
  capturedCount: number;
  pendingCents: number;
  pendingCount: number;
  failedCount: number;
};

export type SubscriptionSnapshot = {
  active: number;
  pastDue: number;
  canceled: number;
  byTier: Array<{ tier: string; count: number }>;
};

export type OwnerOverview = {
  generatedAt: string;
  users: { total: number; active24h: number; active7d: number };
  communities: { forges: number };
  revenue: { today: FinanceTotals; month: FinanceTotals };
  subscriptions: SubscriptionSnapshot;
  recentAdminActions: Array<{
    id: string;
    operation: string;
    resourceType: string;
    resourceId: string;
    actorId: string | null;
    status: string;
    createdAt: string;
    endpoint: string | null;
  }>;
  alerts: Array<{ level: "critical" | "warning"; message: string }>;
};

export type FinanceSummary = {
  totals: FinanceTotals;
  subscriptions: SubscriptionSnapshot;
  trend: Array<{ day: string; grossCents: number; count: number }>;
  provider: { name: string; configured: boolean; webhookConfigured: boolean };
};

export type TransactionRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "DISPUTED";
  kind: "SUBSCRIPTION" | "RENEWAL" | "ONE_TIME" | "COIN_PACK";
  provider: string;
  featureCode: string;
  tier: string | null;
  amountCents: number;
  feeCents: number | null;
  refundedCents: number;
  currency: string;
  providerPaymentId: string | null;
  providerPaymentIntentId: string | null;
  providerSubscriptionId: string | null;
  user: { id: string; username: string; email: string };
  refunds: Array<{ id: string; amountCents: number; status: string; createdAt: string }>;
  disputes: Array<{ id: string; amountCents: number; status: string; providerStatus: string; createdAt: string; closedAt: string | null }>;
};

export type TransactionFilters = {
  status?: string;
  kind?: string;
  featureCode?: string;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export type WebhookRow = {
  id: string;
  type: string;
  providerEventId: string;
  status: "PROCESSED" | "FAILED";
  attempts: number;
  lastError: string | null;
  note: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export async function getOwnerOverview(accessToken: string) {
  const response = await api.get<OwnerOverview>("/api/owner/overview", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function getOwnerFinanceSummary(accessToken: string, window: FinanceWindow) {
  const response = await api.get<FinanceSummary>("/api/owner/finance/summary", {
    headers: authHeaders(accessToken),
    params: { window },
  });
  return response.data;
}

export async function getOwnerTransactions(accessToken: string, filters: TransactionFilters) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  const response = await api.get<{ page: number; pageSize: number; total: number; items: TransactionRow[] }>("/api/owner/finance/transactions", {
    headers: authHeaders(accessToken),
    params,
  });
  return response.data;
}

export async function getOwnerWebhooks(accessToken: string, status: "" | "PROCESSED" | "FAILED", page: number) {
  const response = await api.get<{ page: number; pageSize: number; total: number; items: WebhookRow[] }>("/api/owner/finance/webhooks", {
    headers: authHeaders(accessToken),
    params: { page, pageSize: 25, ...(status ? { status } : {}) },
  });
  return response.data;
}
