import { api, authHeaders } from "@/lib/api";

export type OwnerMode = "live" | "test";

export const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
] as const;
export type PeriodValue = (typeof PERIODS)[number]["value"];

export type ServiceStatus = "Online" | "Degraded" | "Offline" | "Unknown" | "Not Configured";

export type ServiceCheck = {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail: string;
  checkedAt: string;
};

export type HostMetrics = {
  hostUptimeSeconds: number;
  processUptimeSeconds: number;
  cpuCount: number;
  loadAverage: number[];
  memory: { totalBytes: number; freeBytes: number; usedPercent: number };
  disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null;
  processMemoryBytes: number;
};

export type FinanceTotals = {
  grossCents: number;
  capturedCount: number;
  refundCents: number;
  refundCount: number;
  lostDisputeCents: number;
  lostDisputeCount: number;
  openDisputeCents: number;
  openDisputeCount: number;
  feeCents: number;
  feeKnownCount: number;
  netCents: number;
  pendingCents: number;
  pendingCount: number;
  failedCount: number;
  operatingExpenseCents: number;
  operatingExpenseCount: number;
  recordedProfitCents: number;
};

export type OwnerOverview = {
  generatedAt: string;
  mode: OwnerMode;
  users: { registered: number; onlineNow: number; onlineDefinition: string; registeredLast24h: number; registeredLast7d: number; registeredLast30d: number };
  communities: { forges: number };
  subscriptions: { activePaid: number; definition: string };
  revenue: { today: FinanceTotals; month: FinanceTotals };
  services: ServiceCheck[];
  alerts: Array<{ level: "critical" | "warning"; message: string }>;
  recentAdminActions: Array<{ id: string; operation: string; resourceType: string; resourceId: string; actorId: string | null; status: string; createdAt: string; endpoint: string | null }>;
};

export type FinanceSummary = {
  mode: OwnerMode;
  period: { key: PeriodValue; start: string | null; end: string | null };
  totals: FinanceTotals;
  previousTotals: FinanceTotals | null;
  breakdown: Array<{ featureCode: string; kind: string; provider: string; grossCents: number; feeCents: number; count: number }>;
  recurring: { mrrCents: number; arrCents: number; subscriptionsWithRevenueBasis: number; activeSubscriptions: number; assumption: string };
  subscriptions: { active: number; pastDue: number; canceled: number; byTier: Array<{ tier: string; count: number }> };
  trend: Array<{ day: string; grossCents: number; count: number }>;
  coverage: { capturedPaymentsWithFee: number; capturedPayments: number; expenseRecordsAllTime: number; profitLabel: string };
  provider: { name: string; configured: boolean; webhookConfigured: boolean; lastSyncedAt: string | null; settlementBalance: string };
};

export type TransactionRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "DISPUTED";
  kind: "SUBSCRIPTION" | "RENEWAL" | "ONE_TIME" | "COIN_PACK";
  provider: string;
  livemode: boolean;
  featureCode: string;
  tier: string | null;
  grossCents: number;
  refundedCents: number;
  feeCents: number | null;
  feeReported: boolean;
  netCents: number;
  currency: string;
  providerPaymentId: string | null;
  providerPaymentIntentId: string | null;
  providerSubscriptionId: string | null;
  user: { id: string; username: string; email: string };
  disputes: Array<{ id: string; amountCents: number; status: string; providerStatus: string; createdAt: string; closedAt: string | null }>;
};

export type TransactionDetail = {
  transaction: Omit<TransactionRow, "disputes" | "feeReported"> & { providerEventId: string | null };
  refunds: Array<{ id: string; providerRefundId: string; amountCents: number; status: string; reason: string | null; createdAt: string }>;
  disputes: Array<{ id: string; providerDisputeId: string; amountCents: number; status: string; providerStatus: string; createdAt: string; closedAt: string | null }>;
  subscription: { status: string; tier: string; interval: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; livemode: boolean } | null;
};

export type Expense = {
  id: string;
  category: ExpenseCategory;
  customCategory: string | null;
  description: string;
  amountCents: number;
  currency: string;
  incurredOn: string;
  recurring: boolean;
  reference: string | null;
};

export const EXPENSE_CATEGORIES = [
  "HOSTING",
  "SOFTWARE",
  "PAYMENT_PROCESSING",
  "REFUNDS_AND_CHARGEBACKS",
  "MARKETING",
  "CONTRACTORS",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseInput = {
  category: ExpenseCategory;
  customCategory?: string | null;
  description: string;
  amountCents: number;
  currency?: string;
  incurredOn: string;
  recurring?: boolean;
  reference?: string | null;
};

export type MembershipSummary = {
  mode: OwnerMode;
  totals: {
    totalAccounts: number;
    freeAccounts: number;
    premiumFlagAccounts: number;
    paidSubscribersActive: number;
    pastDue: number;
    canceledOrExpired: number;
    lifetime: string;
    suspendedAccounts: number;
  };
  reconciliation: {
    premiumWithBillingRecord: number;
    premiumWithoutBillingRecord: number;
    premiumWithoutVerifiedPayment: number;
    accountsWithVerifiedPayment: number;
    note: string;
  };
  premiumByTier: Array<{ tier: string; count: number }>;
};

export type UserRow = {
  id: string;
  username: string;
  email: string;
  appRole: string;
  premium: boolean;
  premiumTier: string;
  emailVerified: boolean;
  suspendedAt: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  online: boolean;
};

export type UserDetail = {
  user: {
    id: string;
    username: string;
    email: string;
    appRole: string;
    premium: boolean;
    premiumTier: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    ageVerified: boolean;
    suspendedAt: string | null;
    suspensionReason: string | null;
    createdAt: string;
    lastSeenAt: string | null;
    billingSubscriptions: Array<{ id: string; status: string; tier: string; interval: string; livemode: boolean; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string }>;
    paymentTransactions: Array<{ id: string; status: string; kind: string; featureCode: string; amountCents: number; refundedCents: number; currency: string; livemode: boolean; createdAt: string }>;
  };
  auditEvents: Array<{ id: string; operation: string; resourceType: string; status: string; createdAt: string; endpoint: string | null }>;
  membership: { hasVerifiedPayment: boolean; premiumWithoutBillingRecord: boolean };
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

export type Paged<T> = { page: number; pageSize: number; total: number; items: T[] };

export async function ownerGet<T>(accessToken: string, path: string, params?: Record<string, string | number | undefined>) {
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "")) : undefined;
  const response = await api.get<T>(`/api/owner${path}`, { headers: authHeaders(accessToken), params: cleanParams });
  return response.data;
}

export async function ownerWrite<T>(accessToken: string, method: "post" | "patch" | "delete", path: string, body?: unknown) {
  const response = await api.request<T>({
    method,
    url: `/api/owner${path}`,
    headers: authHeaders(accessToken),
    data: body,
  });
  return response.data;
}
