import axios, { AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./config";
import { useAuthStore } from "@/store/auth-store";

export type User = {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  avatar?: string | null;
  banner?: string | null;
  bio?: string | null;
  clanTag?: string | null;
  status: "ONLINE" | "IDLE" | "DND" | "OFFLINE";
  premium: boolean;
  premiumTier?: "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE";
  corePlusActivatedAt?: string | null;
  corePlusBoostLevel?: number;
  corePlusStreakDays?: number;
  createdAt: string;
  emailVerified?: boolean;
  appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";
  isAdmin?: boolean;
  currentActivity?: string | null;
  activityDetails?: string | null;
  
  // Creator & Live Status
  isCreator?: boolean;
  isFeatured?: boolean;
  creatorStatus?: "OFFLINE" | "LIVE";
  livePlatform?: string | null;
  liveStreamTitle?: string | null;
  liveStreamUrl?: string | null;
  liveGameCategory?: string | null;
  liveViewerCount?: number;
  liveStartedAt?: string | null;
  
  // Badges
  isStaff?: boolean;
  isRep?: boolean;
  isPartner?: boolean;
  
  // Enhanced Activity
  activityType?: "GAME" | "MUSIC" | "STREAMING" | "SOCIAL" | null;
  activityStatus?: string | null;
  activityMetadata?: any;
  showActivity?: boolean;
  socialLinks?: {
    discord?: string;
    x?: string;
    instagram?: string;
    kick?: string;
    youtube?: string;
    twitch?: string;
  } | null;

  game?: string | null;
  lastSeenAt?: string | null;
  appRank?: number;
  boostRank?: number;
  economyAccounts?: {
    currencyType: string;
    balance: string;
  }[];
};

export type Channel = {
  id: string;
  forgeId: string;
  name: string;
  topic?: string | null;
  type: "TEXT" | "VOICE" | "ANNOUNCEMENT" | "STAGE";
  position: number;
};

export type Forge = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  banner?: string | null;
  inviteCode: string;
  inviteViewCount?: number;
  inviteJoinCount?: number;
  inviteLastViewedAt?: string | null;
  inviteLastJoinedAt?: string | null;
  inviteSources?: InviteSourceStat[];
  createdAt: string;
};

export type ForgeInviteAvailability = {
  inviteCode: string;
  available: boolean;
  reason: "reserved" | "taken" | null;
};

export type InviteSourceStat = {
  id: string;
  source: string;
  viewCount: number;
  joinCount: number;
  lastViewedAt?: string | null;
  lastJoinedAt?: string | null;
};

export type ForgeInviteAnalytics = {
  summary: {
    views: number;
    joins: number;
    conversionRate: number;
    qualityScore: number;
    inviteLastViewedAt?: string | null;
    inviteLastJoinedAt?: string | null;
  };
  topSource: {
    id: string;
    source: string;
    viewCount: number;
    joinCount: number;
    sourceConversionRate: number;
    viewShare: number;
    joinShare: number;
    score: number;
    lastViewedAt?: string | null;
    lastJoinedAt?: string | null;
  } | null;
  underperformingSource: {
    id: string;
    source: string;
    viewCount: number;
    joinCount: number;
    sourceConversionRate: number;
    viewShare: number;
    joinShare: number;
    score: number;
    lastViewedAt?: string | null;
    lastJoinedAt?: string | null;
  } | null;
  sources: Array<{
    id: string;
    source: string;
    viewCount: number;
    joinCount: number;
    sourceConversionRate: number;
    viewShare: number;
    joinShare: number;
    score: number;
    lastViewedAt?: string | null;
    lastJoinedAt?: string | null;
  }>;
  campaignLoop: {
    capturedAt: string;
    generatedAt?: string | null;
    status: "collecting" | "improving" | "needs-attention";
    recommendation: string;
    improvedCount: number;
    stalledCount: number;
    collectingCount: number;
    evaluations: Array<{
      source: string;
      baselineViews: number;
      baselineJoins: number;
      baselineConversionRate: number;
      currentViews: number;
      currentJoins: number;
      currentConversionRate: number;
      deltaViews: number;
      deltaJoins: number;
      deltaConversionRate: number;
      state: "collecting" | "improved" | "stalled";
    }>;
  } | null;
  promotionLoop: {
    capturedAt: string;
    expiresAt: string;
    generatedAt?: string | null;
    status: "collecting" | "profitable" | "mixed" | "needs-pruning";
    recommendation: string;
    keepCount: number;
    holdCount: number;
    killCount: number;
    collectingCount: number;
    evaluations: Array<{
      source: string;
      baselineViews: number;
      baselineJoins: number;
      baselineConversionRate: number;
      currentViews: number;
      currentJoins: number;
      currentConversionRate: number;
      deltaViews: number;
      deltaJoins: number;
      deltaConversionRate: number;
      state: "collecting" | "keep" | "hold" | "kill";
    }>;
  } | null;
};

export type ForgeOnboardingHealth = {
  summary: {
    completedCount: number;
    totalCount: number;
    score: number;
  };
  tasks: Array<{
    id: string;
    label: string;
    description: string;
    completed: boolean;
    value: number;
    target: number;
    action: string;
    recommendedAction: ForgeOnboardingAction | null;
  }>;
  nextAction: string;
};

export type ForgeOnboardingAction =
  | "SEED_CORE_CHANNELS"
  | "CREATE_MODERATOR_ROLE"
  | "ENABLE_STARTER_AUTOMATION"
  | "LAUNCH_SHARE_CAMPAIGNS"
  | "PUBLISH_MEMBER_RECRUITMENT_POST"
  | "OPTIMIZE_CAMPAIGNS"
  | "PROMOTE_WINNING_CAMPAIGNS";

export type PublicForgeInvite = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  banner?: string | null;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  inviteViewCount: number;
  inviteJoinCount: number;
  inviteLastViewedAt?: string | null;
  inviteLastJoinedAt?: string | null;
  inviteSource: string;
  owner: {
    username: string;
  };
};

export type BotApp = {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  inviteCode: string;
  isPublic?: boolean;
  intents?: string[];
  ownerId?: string;
  createdAt: string;
};

export type DeveloperApiKey = {
  id: string;
  name: string;
  enabled: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
};

export type DeveloperOAuthClient = {
  id: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperWebhook = {
  id: string;
  url: string;
  description?: string | null;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BotCommand = {
  id: string;
  forgeId: string;
  installationId: string;
  name: string;
  description?: string | null;
  responseTemplate: string;
  commandPreset: "CUSTOM" | "MODERATION" | "UTILITY" | "ECONOMY";
  requiredPermission: "NONE" | "moderateChat" | "manageChannels" | "manageRoles" | "kickUsers" | "banUsers" | "streamAccess";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: string;
};

export type Message = {
  id: string;
  channelId: string;
  authorId?: string | null;
  botId?: string | null;
  botName?: string | null;
  botAvatar?: string | null;
  content: string;
  attachments?: string[];
  edited: boolean;
  createdAt: string;
  optimistic?: boolean;
  optimisticId?: string;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    authorId?: string | null;
    botName?: string | null;
    author?: { id: string; username: string } | null;
  } | null;
  reactions?: MessageReaction[];
  author?: {
    id: string;
    username: string;
    avatar?: string | null;
    premium: boolean;
  };
};

export type Friendship = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  sender: Pick<User, "id" | "username" | "avatar" | "status" | "game">;
  receiver: Pick<User, "id" | "username" | "avatar" | "status" | "game">;
};

export type DmParticipant = {
  id: string;
  user: Pick<User, "id" | "username" | "avatar" | "status">;
};

export type DmThread = {
  id: string;
  isGroup: boolean;
  name?: string | null;
  participants: DmParticipant[];
  messages?: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type DmMessage = {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatar?: string | null;
    premium: boolean;
  };
};

export type UserSearchResult = {
  id: string;
  username: string;
  avatar?: string | null;
  status: User["status"];
  premium: boolean;
  clanTag?: string | null;
};

export type CorePlusTelemetry = {
  activeMembers: number;
  upgradesToday: number;
  tierDistribution: {
    CORE: number;
    PLUS: number;
    ELITE: number;
    INFINITE: number;
  };
  avgBoostLevel: number;
  highestBoostLevel: number;
};

export type PaidFeatureCode =
  | "CORE_PLUS"
  | "FORGE_BOOST_PACK"
  | "CREATOR_CAMPAIGN_SLOT"
  | "EVENT_TICKET_PASS"
  | "TEAM_BRANDING_KIT"
  | "ADVANCED_MODERATION_AI";

export type BillingEntitlements = {
  premium: {
    active: boolean;
    tier: User["premiumTier"] | "NONE";
    subscription?: {
      tier: User["premiumTier"];
      interval: "MONTHLY" | "YEARLY";
      status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
      currentPeriodEnd?: string | null;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  entitlements: Array<{
    featureCode: PaidFeatureCode;
    quantity: number;
    expiresAt?: string | null;
  }>;
};

export type BillingReadiness = {
  provider: "stripe";
  ready: boolean;
  configured: {
    stripeSecretKey: boolean;
    corePlusTierPrices: boolean;
    addOnPrices: boolean;
  };
  missing: {
    tierPrices: string[];
    addOnPrices: string[];
  };
};

export type AdminRevenue = {
  revenue: {
    last30DaysCents: number;
    previous30DaysCents: number;
    growthPct: number;
    activeSubscriptions: number;
    failedPayments: number;
  };
  tierDistribution: {
    CORE: number;
    PLUS: number;
    ELITE: number;
    INFINITE: number;
  };
  featureRevenue: Array<{
    featureCode: PaidFeatureCode;
    featureLabel?: string;
    priceLabel?: string | null;
    revenueCents: number;
    transactions: number;
  }>;
};

export type AdminAiInsights = {
  insights: {
    pressureScore: number;
    recentMessages: number;
    recentAccounts: number;
    pendingFriends: number;
    unreadNotifications: number;
    premiumUsers: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    incidentLikelihoodPct: number;
    automationActions: string[];
    recommendedPlaybooks: Array<{
      title: string;
      detail: string;
      priority: "immediate" | "today" | "monitor";
    }>;
    bottlenecks: string[];
  };
};

export type AdminSeedMedalsResponse = {
  medals: Array<{ key: string; created: boolean }>;
  created: number;
  updated: number;
};

export type AdminGenerateSampleProfilesResponse = {
  usersProcessed: number;
  reputationUpdates: number;
  createdActivities: number;
  totalUserMedalLinks: number;
};

export type AdminReputationAdjustResponse = {
  user: {
    id: string;
    username: string;
    reputation: number;
  };
};

export type AdminResetGenerationLockResponse = {
  recovered: boolean;
  message: string;
  jobId?: string;
};

export type AdminProfileAuditResponse = {
  total: number;
  limit: number;
  offset: number;
  logs: Array<{
    id: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      id: string;
      username: string;
    };
  }>;
};

export type AgeGateAuditLogEntry = {
  id: string;
  createdAt: string;
  action: "verify" | "reject";
  status: "approved" | "denied" | "blocked" | "rejected" | "error";
  confirmed: boolean;
  fingerprint: string;
  ip: string;
  userAgent: string;
  risk: {
    score: number;
    level: "low" | "medium" | "high" | "critical";
    reasons: string[];
  };
  deviceProfile?: Record<string, unknown>;
  note?: string;
};

export type AdminAgeGateAuditResponse = {
  total: number;
  limit: number;
  offset: number;
  logs: AgeGateAuditLogEntry[];
};

export type AdminProfileToolsStatus = {
  inProgress: boolean;
  startedAt: string | null;
  lastCompletedAt: string | null;
  cooldownMs: number;
  cooldownRemainingMs: number;
  latestJob: {
    id: string;
    title: string;
    description?: string | null;
    createdAt: string;
    metadata?: {
      source?: string;
      action?: string;
      status?: "RUNNING" | "SUCCEEDED" | "FAILED";
      payload?: {
        userLimit?: number;
        activitiesPerUser?: number;
        minReputation?: number;
        maxReputation?: number;
        awardRandomMedals?: boolean;
      };
      result?: {
        usersProcessed?: number;
        reputationUpdates?: number;
        createdActivities?: number;
        totalUserMedalLinks?: number;
      };
      errorMessage?: string | null;
      startedAt?: string;
      completedAt?: string | null;
    } | null;
    actor: {
      id: string;
      username: string;
    };
  } | null;
};

export type LaunchModeState = {
  desktopOnly: boolean;
  updatedAt: string;
  updatedBy: {
    id: string;
    username: string;
  } | null;
  source: "env" | "runtime";
};

const LOCAL_API_BASE_URL = "http://127.0.0.1:4000";
const LOCAL_API_FALLBACK_URL = "http://127.0.0.1:4001";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableRequestConfig extends AxiosRequestConfig {
  __retriedOnFallbackPort?: boolean;
  __retriedAfterRefresh?: boolean;
}

let unauthorizedHandler: (() => void) | null = null;
let lastUnauthorizedHandledAt = 0;

type RefreshedSession = { accessToken: string; csrfToken: string };
let refreshInFlight: Promise<RefreshedSession | null> | null = null;

const authEndpointsWithoutRefresh = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"];

function isNonRefreshableAuthUrl(url?: string) {
  if (!url) return false;
  return authEndpointsWithoutRefresh.some((endpoint) => url.includes(endpoint));
}

/**
 * Exchange the httpOnly refresh cookie for a new access token. Concurrent 401s share one refresh call.
 * Returns null when the refresh cookie is missing, expired or revoked.
 */
export function refreshAccessToken(): Promise<RefreshedSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<RefreshedSession>(`${api.defaults.baseURL ?? API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const data = response.data;
        if (!data?.accessToken) return null;
        useAuthStore.setState({ accessToken: data.accessToken, csrfToken: data.csrfToken ?? null });
        return { accessToken: data.accessToken, csrfToken: data.csrfToken };
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetriableRequestConfig | undefined;

    if (
      axios.isAxiosError(error) &&
      !error.response &&
      config?.baseURL === LOCAL_API_BASE_URL &&
      !config.__retriedOnFallbackPort
    ) {
      return api.request({
        ...(config as RetriableRequestConfig),
        __retriedOnFallbackPort: true,
        baseURL: LOCAL_API_FALLBACK_URL,
      } as RetriableRequestConfig);
    }

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const hadSession = Boolean(useAuthStore.getState().accessToken);
      const canRetry =
        hadSession &&
        config &&
        !config.__retriedAfterRefresh &&
        !isNonRefreshableAuthUrl(config.url);

      if (canRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const headers = { ...(config.headers as Record<string, string> | undefined) };
          headers.Authorization = `Bearer ${refreshed.accessToken}`;
          if (refreshed.csrfToken) headers["x-csrf-token"] = refreshed.csrfToken;
          return api.request({
            ...(config as RetriableRequestConfig),
            __retriedAfterRefresh: true,
            headers,
          } as RetriableRequestConfig);
        }
      }

      const now = Date.now();
      if (unauthorizedHandler && now - lastUnauthorizedHandledAt > 500) {
        lastUnauthorizedHandledAt = now;
        unauthorizedHandler();
      }
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const serverMessage =
      responseData && typeof responseData === "object" ? (responseData as { error?: string }).error : undefined;

    return (
      serverMessage ||
      (typeof responseData === "string" ? responseData : undefined) ||
      error.message ||
      `Request failed with status code ${error.response?.status ?? "unknown"}`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
}

export function authHeaders(
  accessToken: string | null,
  csrfToken?: string | null,
): Record<string, string> {
  if (!accessToken) return {};
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  };
}

export async function register(payload: { username: string; email: string; password: string; birthdate: string }) {
  const response = await api.post<{
    accessToken: string;
    csrfToken: string;
    user: User;
    verification: { token: string };
  }>(
    "/api/auth/register",
    payload,
  );
  return response.data;
}

export async function login(payload: { email: string; password: string }) {
  const response = await api.post<{ accessToken: string; csrfToken: string; user: User }>(
    "/api/auth/login",
    payload,
  );
  return response.data;
}

export async function forgotPassword(payload: { email: string }) {
  const response = await api.post<{ message: string; token?: string }>("/api/auth/forgot-password", payload);
  return response.data;
}

export async function verifyEmail(token: string) {
  const response = await api.get<{ message: string }>("/api/auth/verify-email", {
    params: { token },
  });
  return response.data;
}

export async function resetPassword(payload: { token: string; newPassword: string }) {
  const response = await api.post<{ message: string }>("/api/auth/reset-password", payload);
  return response.data;
}

export async function getMe(accessToken: string) {
  const response = await api.get<{ user: User }>("/api/auth/me", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function updateMe(
  accessToken: string,
  csrfToken: string,
  payload: Partial<Pick<User, "username" | "avatar" | "banner" | "bio" | "clanTag" | "status" | "currentActivity" | "activityDetails">>,
) {
  const response = await api.patch<{ user: User }>("/api/auth/me", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function savePushSubscription(
  accessToken: string,
  csrfToken: string,
  payload: { endpoint: string; p256dh: string; auth: string; deviceName?: string; platform?: string },
) {
  const response = await api.post<{ subscription: unknown }>("/api/auth/push-subscriptions", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function activateCorePlus(
  accessToken: string,
  csrfToken: string,
  payload?: { tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE" },
) {
  const response = await api.post<{ user: User }>("/api/auth/core-plus/activate", payload ?? {}, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function createCheckoutSession(
  accessToken: string,
  csrfToken: string,
  payload: {
    featureCode: PaidFeatureCode;
    tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE";
    interval?: "MONTHLY" | "YEARLY";
    quantity?: number;
  },
) {
  const response = await api.post<{ sessionId: string; url?: string | null }>(
    "/api/billing/checkout/session",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function createPortalSession(accessToken: string, csrfToken: string) {
  const response = await api.post<{ url: string }>(
    "/api/billing/portal/session",
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getBillingEntitlements(accessToken: string) {
  const response = await api.get<BillingEntitlements>("/api/billing/entitlements", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getBillingReadiness() {
  const response = await api.get<{ billing: BillingReadiness }>("/api/billing/status");
  return response.data;
}

export async function consumeCreatorCampaignSlot(accessToken: string, csrfToken: string, quantity = 1) {
  const response = await api.post<{ ok: true; consumed: number; remaining: number }>(
    "/api/billing/features/creator-campaign-slot/consume",
    { quantity },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function consumeAdvancedModerationAI(accessToken: string, csrfToken: string) {
  const response = await api.post<{ ok: true; message: string }>(
    "/api/billing/features/advanced-moderation-ai/consume",
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function consumeForgeBoostPack(accessToken: string, csrfToken: string, quantity = 1) {
  const response = await api.post<{ ok: true; consumed: number; remaining: number }>(
    "/api/billing/features/forge-boost-pack/consume",
    { quantity },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function consumeEventTicketPass(accessToken: string, csrfToken: string, quantity = 1) {
  const response = await api.post<{ ok: true; consumed: number; remaining: number }>(
    "/api/billing/features/event-ticket-pass/consume",
    { quantity },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getCorePlusTelemetry(accessToken: string) {
  const response = await api.get<{ telemetry: CorePlusTelemetry }>("/api/auth/core-plus/telemetry", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listForges(accessToken: string) {
  const response = await api.get<{ forges: Forge[] }>("/api/forges", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createForge(
  accessToken: string,
  csrfToken: string,
  payload: {
    name: string;
    description?: string;
    icon?: string;
    banner?: string;
    inviteCode?: string;
    template?: "TRH" | "GAMING" | "CREATOR" | "ESPORTS" | "STUDY";
  },
) {
  const response = await api.post<{ forge: Forge }>("/api/forges", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateForgeInviteCode(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  inviteCode: string,
) {
  const response = await api.patch<{ forge: Pick<Forge, "id" | "inviteCode"> }>(
    `/api/forges/${forgeId}/invite`,
    { inviteCode },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function joinForge(accessToken: string, csrfToken: string, inviteCode: string) {
  const response = await api.post<{ forgeId: string; inviteCode: string }>(
    "/api/forges/join",
    { inviteCode },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function joinForgeFromSource(
  accessToken: string,
  csrfToken: string,
  payload: { inviteCode: string; source?: string },
) {
  const response = await api.post<{ forgeId: string; inviteCode: string }>("/api/forges/join", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function getForgeInviteAvailability(inviteCode: string, currentForgeId?: string) {
  const response = await api.get<ForgeInviteAvailability>(`/api/forges/availability/${encodeURIComponent(inviteCode)}`, {
    params: currentForgeId ? { currentForgeId } : {},
  });
  return response.data;
}

export async function getPublicForgeInvite(inviteCode: string, source?: string) {
  try {
    const response = await api.get<{ forge: PublicForgeInvite }>(`/api/forges/public/${encodeURIComponent(inviteCode)}`, {
      params: source ? { src: source } : {},
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { forge: null };
    }

    throw error;
  }
}

export type ForgePermissionKey =
  | "manageForge"
  | "manageChannels"
  | "manageRoles"
  | "kickUsers"
  | "banUsers"
  | "moderateChat"
  | "streamAccess";

export type ForgePermissionSet = Record<ForgePermissionKey, boolean>;

export const forgePermissionKeys: ForgePermissionKey[] = [
  "manageForge",
  "manageChannels",
  "manageRoles",
  "kickUsers",
  "banUsers",
  "moderateChat",
  "streamAccess",
];

export type ForgeRole = {
  id: string;
  forgeId: string;
  name: string;
  color: string;
  permissions: Partial<ForgePermissionSet> | null;
  position: number;
};

export type ForgeMemberEntry = {
  id: string;
  userId: string;
  nickname?: string | null;
  joinedAt: string;
  roleLinks: Array<{ roleId: string }>;
  user: {
    id: string;
    username: string;
    avatar?: string | null;
    status: "ONLINE" | "IDLE" | "DND" | "OFFLINE";
    premium: boolean;
  };
};

export type ForgeBan = {
  id: string;
  forgeId: string;
  userId: string;
  bannedById: string;
  reason?: string | null;
  createdAt: string;
  user: { id: string; username: string; avatar?: string | null };
  bannedBy: { id: string; username: string };
};

export type ForgeAccess = {
  forgeId: string;
  isOwner: boolean;
  topPosition: number;
  permissions: ForgePermissionSet;
};

export type ForgeDetail = Forge & {
  ownerId: string;
  channels: Channel[];
  roles: ForgeRole[];
  botInstallations: Array<{
    id: string;
    enabled: boolean;
    createdAt: string;
    commands: BotCommand[];
    bot: BotApp;
  }>;
  inviteSources: InviteSourceStat[];
  members: ForgeMemberEntry[];
};

export async function getForge(accessToken: string, forgeId: string) {
  const response = await api.get<{ forge: ForgeDetail }>(`/api/forges/${forgeId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Forge management (settings, channels, roles, members, bans)
// ---------------------------------------------------------------------------

export async function getForgePermissions(accessToken: string, forgeId: string) {
  const response = await api.get<ForgeAccess>(`/api/forges/${forgeId}/permissions`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function updateForge(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  payload: { name?: string; description?: string | null; icon?: string | null; banner?: string | null },
) {
  const response = await api.patch<{ forge: Forge & { ownerId: string } }>(`/api/forges/${forgeId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteForge(accessToken: string, csrfToken: string, forgeId: string) {
  const response = await api.delete<{ ok: true; forgeId: string }>(`/api/forges/${forgeId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function leaveForge(accessToken: string, csrfToken: string, forgeId: string) {
  const response = await api.post<{ ok: true; forgeId: string }>(`/api/forges/${forgeId}/leave`, {}, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function createForgeChannel(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  payload: { name: string; type: Channel["type"]; topic?: string },
) {
  const response = await api.post<{ channel: Channel }>(`/api/forges/${forgeId}/channels`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateForgeChannel(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  channelId: string,
  payload: { name?: string; topic?: string | null; position?: number },
) {
  const response = await api.patch<{ channel: Channel }>(`/api/forges/${forgeId}/channels/${channelId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteForgeChannel(accessToken: string, csrfToken: string, forgeId: string, channelId: string) {
  const response = await api.delete<{ ok: true; channelId: string }>(`/api/forges/${forgeId}/channels/${channelId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function createForgeRole(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  payload: { name: string; color?: string; permissions?: Partial<ForgePermissionSet>; position?: number },
) {
  const response = await api.post<{ role: ForgeRole }>(`/api/forges/${forgeId}/roles`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateForgeRole(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  roleId: string,
  payload: { name?: string; color?: string; permissions?: Partial<ForgePermissionSet>; position?: number },
) {
  const response = await api.patch<{ role: ForgeRole }>(`/api/forges/${forgeId}/roles/${roleId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteForgeRole(accessToken: string, csrfToken: string, forgeId: string, roleId: string) {
  const response = await api.delete<{ ok: true; roleId: string }>(`/api/forges/${forgeId}/roles/${roleId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function setForgeMemberRoles(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  userId: string,
  roleIds: string[],
) {
  const response = await api.put<{ userId: string; roleIds: string[] }>(
    `/api/forges/${forgeId}/members/${userId}/roles`,
    { roleIds },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function updateForgeMemberNickname(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  userId: string,
  nickname: string | null,
) {
  const response = await api.patch<{ member: { id: string; userId: string; nickname: string | null } }>(
    `/api/forges/${forgeId}/members/${userId}`,
    { nickname },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function kickForgeMember(accessToken: string, csrfToken: string, forgeId: string, userId: string) {
  const response = await api.delete<{ ok: true; userId: string }>(`/api/forges/${forgeId}/members/${userId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function listForgeBans(accessToken: string, forgeId: string) {
  const response = await api.get<{ bans: ForgeBan[] }>(`/api/forges/${forgeId}/bans`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function banForgeUser(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  payload: { userId: string; reason?: string },
) {
  const response = await api.post<{ ban: ForgeBan }>(`/api/forges/${forgeId}/bans`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function unbanForgeUser(accessToken: string, csrfToken: string, forgeId: string, userId: string) {
  const response = await api.delete<{ ok: true; userId: string }>(`/api/forges/${forgeId}/bans/${userId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function getForgeInviteAnalytics(accessToken: string, forgeId: string) {
  const response = await api.get<{ analytics: ForgeInviteAnalytics }>(`/api/forges/${forgeId}/invite-analytics`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getForgeOnboardingHealth(accessToken: string, forgeId: string) {
  const response = await api.get<{ health: ForgeOnboardingHealth }>(`/api/forges/${forgeId}/onboarding-health`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function runForgeOnboardingAction(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  action: ForgeOnboardingAction,
) {
  const response = await api.post<{ ok: boolean; action: ForgeOnboardingAction; message: string }>(
    `/api/forges/${forgeId}/onboarding-actions`,
    { action },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function listMyBots(accessToken: string) {
  const response = await api.get<{ bots: BotApp[] }>("/api/bots/my", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listBotCatalog(accessToken: string, query?: string) {
  const response = await api.get<{ bots: BotApp[] }>("/api/bots/catalog", {
    params: query ? { q: query } : {},
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createBotApp(
  accessToken: string,
  csrfToken: string,
  payload: { name: string; description?: string; avatar?: string; isPublic?: boolean; intents?: string[] },
) {
  const response = await api.post<{ bot: BotApp }>("/api/bots", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function installBotToForge(
  accessToken: string,
  csrfToken: string,
  payload: { forgeId: string; inviteCode: string },
) {
  const response = await api.post<{ installation: { id: string; createdAt: string; bot: BotApp } }>(
    "/api/bots/install",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function updateBotApp(
  accessToken: string,
  csrfToken: string,
  botId: string,
  payload: { name?: string; description?: string; avatar?: string; isPublic?: boolean; intents?: string[] },
) {
  const response = await api.patch<{ bot: BotApp }>(`/api/bots/${botId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteBotApp(accessToken: string, csrfToken: string, botId: string) {
  const response = await api.delete(`/api/bots/${botId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function listDeveloperApiKeys(accessToken: string) {
  const response = await api.get<{ keys: DeveloperApiKey[] }>("/api/developer/keys", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createDeveloperApiKey(accessToken: string, csrfToken: string, payload: { name: string }) {
  const response = await api.post<{ apiKey: DeveloperApiKey; secret: string }>("/api/developer/keys", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateDeveloperApiKey(
  accessToken: string,
  csrfToken: string,
  keyId: string,
  payload: { name?: string; enabled?: boolean },
) {
  const response = await api.patch<{ apiKey: DeveloperApiKey }>(`/api/developer/keys/${keyId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function revokeDeveloperApiKey(accessToken: string, csrfToken: string, keyId: string) {
  const response = await api.delete(`/api/developer/keys/${keyId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function listDeveloperOAuthClients(accessToken: string) {
  const response = await api.get<{ clients: DeveloperOAuthClient[] }>("/api/developer/oauth-clients", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createDeveloperOAuthClient(
  accessToken: string,
  csrfToken: string,
  payload: { name: string; redirectUris?: string[] },
) {
  const response = await api.post<{ client: DeveloperOAuthClient; secret: string }>(
    "/api/developer/oauth-clients",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function updateDeveloperOAuthClient(
  accessToken: string,
  csrfToken: string,
  clientId: string,
  payload: { name?: string; redirectUris?: string[]; enabled?: boolean },
) {
  const response = await api.patch<{ client: DeveloperOAuthClient }>(`/api/developer/oauth-clients/${clientId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function revokeDeveloperOAuthClient(accessToken: string, csrfToken: string, clientId: string) {
  const response = await api.delete(`/api/developer/oauth-clients/${clientId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function rotateDeveloperOAuthClientSecret(accessToken: string, csrfToken: string, clientId: string) {
  const response = await api.post<{ client: DeveloperOAuthClient; secret: string }>(
    `/api/developer/oauth-clients/${clientId}/rotate-secret`,
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export type OAuthTokenPayload =
  | { grant_type: "client_credentials"; client_id: string; client_secret: string }
  | {
      grant_type: "authorization_code";
      client_id: string;
      client_secret: string;
      code: string;
      redirect_uri: string;
    };

export async function requestOAuthToken(payload: OAuthTokenPayload) {
  const body = new URLSearchParams();
  body.append("grant_type", payload.grant_type);
  body.append("client_id", payload.client_id);
  body.append("client_secret", payload.client_secret);

  if (payload.grant_type === "authorization_code") {
    body.append("code", payload.code);
    body.append("redirect_uri", payload.redirect_uri);
  }

  const response = await api.post<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>(
    "/api/oauth/token",
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  return response.data;
}

export async function listDeveloperWebhooks(accessToken: string) {
  const response = await api.get<{ webhooks: DeveloperWebhook[] }>("/api/developer/webhooks", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createDeveloperWebhook(
  accessToken: string,
  csrfToken: string,
  payload: { url: string; description?: string; events?: string[]; enabled?: boolean },
) {
  const response = await api.post<{ webhook: DeveloperWebhook; secret: string }>("/api/developer/webhooks", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateDeveloperWebhook(
  accessToken: string,
  csrfToken: string,
  webhookId: string,
  payload: { url?: string; description?: string; events?: string[]; enabled?: boolean },
) {
  const response = await api.patch<{ webhook: DeveloperWebhook }>(`/api/developer/webhooks/${webhookId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteDeveloperWebhook(accessToken: string, csrfToken: string, webhookId: string) {
  const response = await api.delete(`/api/developer/webhooks/${webhookId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function testDeveloperWebhook(accessToken: string, csrfToken: string, webhookId: string) {
  const response = await api.post<{ ok: boolean; status: number; response: string }>(
    `/api/developer/webhooks/${webhookId}/test`,
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function setBotInstallationEnabled(
  accessToken: string,
  csrfToken: string,
  installationId: string,
  enabled: boolean,
) {
  const response = await api.patch<{ installation: { id: string; enabled: boolean; createdAt: string; bot: BotApp } }>(
    `/api/bots/installations/${installationId}`,
    { enabled },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function createBotCommand(
  accessToken: string,
  csrfToken: string,
  payload: {
    forgeId: string;
    installationId: string;
    name: string;
    description?: string;
    responseTemplate: string;
    preset?: BotCommand["commandPreset"];
    requiredPermission?: BotCommand["requiredPermission"];
  },
) {
  const response = await api.post<{ command: BotCommand }>("/api/bots/commands", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateBotCommand(
  accessToken: string,
  csrfToken: string,
  commandId: string,
  payload: {
    description?: string;
    responseTemplate?: string;
    requiredPermission?: BotCommand["requiredPermission"];
    enabled?: boolean;
  },
) {
  const response = await api.patch<{ command: BotCommand }>(`/api/bots/commands/${commandId}`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function executeBotCommand(
  accessToken: string,
  csrfToken: string,
  payload: { forgeId: string; name: string },
) {
  const response = await api.post<{ ok: true; output: { command: string; botName: string; intents: string[]; response: string } }>(
    "/api/bots/commands/execute",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getMessages(accessToken: string, channelId: string, cursor?: string | null) {
  const response = await api.get<{ messages: Message[]; nextCursor: string | null }>(`/api/messages/${channelId}`, {
    headers: authHeaders(accessToken),
    params: cursor ? { cursor } : {},
  });
  return response.data;
}

export async function editMessage(accessToken: string, csrfToken: string, messageId: string, content: string) {
  const response = await api.patch<{ message: Message }>(
    `/api/messages/${messageId}`,
    { content },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function toggleReaction(accessToken: string, csrfToken: string, messageId: string, emoji: string) {
  const response = await api.post<{ reactions: MessageReaction[]; active: boolean }>(
    `/api/messages/${messageId}/reactions`,
    { emoji },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function postMessage(
  accessToken: string,
  csrfToken: string,
  payload: { channelId: string; content: string; optimisticId?: string; attachments?: string[]; replyToId?: string },
) {
  const response = await api.post<{ message: Message }>("/api/messages", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function deleteMessage(accessToken: string, csrfToken: string, messageId: string) {
  await api.delete(`/api/messages/${messageId}`, {
    headers: authHeaders(accessToken, csrfToken),
  });
}

export async function searchUsers(accessToken: string, query: string) {
  const response = await api.get<{ users: UserSearchResult[] }>("/api/search/users", {
    params: { q: query },
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listFriends(accessToken: string) {
  const response = await api.get<{ friends: Friendship[] }>("/api/friends", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function sendFriendRequest(accessToken: string, csrfToken: string, receiverId: string) {
  const response = await api.post<{ friend: Friendship }>(
    "/api/friends/request",
    { receiverId },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function updateFriendStatus(
  accessToken: string,
  csrfToken: string,
  friendId: string,
  status: "ACCEPTED" | "BLOCKED",
) {
  const response = await api.patch<{ friend: Friendship }>(
    `/api/friends/${friendId}`,
    { status },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function listDmThreads(accessToken: string) {
  const response = await api.get<{ threads: DmThread[] }>("/api/dms/threads", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createDmThread(accessToken: string, csrfToken: string, userId: string) {
  const response = await api.post<{ thread: DmThread }>(
    "/api/dms/threads",
    { userId },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function createDmGroup(
  accessToken: string,
  csrfToken: string,
  payload: { name: string; participantIds: string[] },
) {
  const response = await api.post<{ thread: DmThread }>("/api/dms/groups", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function getDmMessages(accessToken: string, threadId: string) {
  const response = await api.get<{ messages: DmMessage[] }>(`/api/dms/threads/${threadId}/messages`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function postDmMessage(
  accessToken: string,
  csrfToken: string,
  threadId: string,
  payload: { content: string; attachments?: string[] },
) {
  const response = await api.post<{ message: DmMessage }>(`/api/dms/threads/${threadId}/messages`, payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function createUploadPresign(
  accessToken: string,
  csrfToken: string,
  payload: { filename: string; contentType: string; size: number },
) {
  const response = await api.post<{ key: string; uploadUrl: string; fileUrl: string }>(
    "/api/uploads/presign",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function requestVoiceToken(accessToken: string, csrfToken: string, channelId: string) {
  const response = await api.post<{ token: string; wsUrl: string; roomName: string }>(
    "/api/voice/token",
    { channelId },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export type VoiceTokenResponse = Awaited<ReturnType<typeof requestVoiceToken>>;

export async function getAdminRevenue(accessToken: string, csrfToken: string) {
  const response = await api.get<AdminRevenue>("/api/admin/revenue", {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function getAdminAiInsights(accessToken: string, csrfToken: string) {
  const response = await api.get<AdminAiInsights>("/api/admin/ai-insights", {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function adminSeedMedals(accessToken: string, csrfToken: string) {
  const response = await api.post<AdminSeedMedalsResponse>(
    "/api/admin/profile-tools/seed-medals",
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function adminGenerateSampleProfiles(
  accessToken: string,
  csrfToken: string,
  payload?: {
    userLimit?: number;
    activitiesPerUser?: number;
    minReputation?: number;
    maxReputation?: number;
    awardRandomMedals?: boolean;
  },
) {
  const response = await api.post<AdminGenerateSampleProfilesResponse>(
    "/api/admin/profile-tools/generate-sample-data",
    payload ?? {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getLiveCreators(accessToken: string, csrfToken: string) {
  const response = await api.get<User[]>("/api/profiles/creators/live", {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function updateActivity(accessToken: string, csrfToken: string, data: {
  activityType: "GAME" | "MUSIC" | "STREAMING" | "SOCIAL" | "CLEAR";
  activityStatus?: string;
  activityMetadata?: any;
  showActivity?: boolean;
}) {
  const response = await api.post("/api/profiles/activity", data, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

export async function adminAdjustReputation(
  accessToken: string,
  csrfToken: string,
  payload: {
    userId: string;
    delta: number;
    reason?: string;
  },
) {
  const response = await api.post<AdminReputationAdjustResponse>(
    "/api/admin/profile-tools/reputation",
    payload,
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function adminResetGenerationLock(accessToken: string, csrfToken: string) {
  const response = await api.post<AdminResetGenerationLockResponse>(
    "/api/admin/profile-tools/reset-generation-lock",
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getAdminProfileAudit(
  accessToken: string,
  csrfToken: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: "seed-medals" | "generate-sample-data" | "adjust-reputation";
    actorId?: string;
  },
) {
  const response = await api.get<AdminProfileAuditResponse>(
    "/api/admin/profile-tools/audit",
    {
      params: {
        limit: options?.limit ?? 25,
        offset: options?.offset ?? 0,
        action: options?.action,
        actorId: options?.actorId,
      },
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getAdminAgeGateAudit(
  accessToken: string,
  csrfToken: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: "verify" | "reject";
    status?: "approved" | "denied" | "blocked" | "rejected" | "error";
    riskLevel?: "low" | "medium" | "high" | "critical";
  },
) {
  const response = await api.get<AdminAgeGateAuditResponse>(
    "/api/admin/age-gate/audit",
    {
      params: {
        limit: options?.limit ?? 25,
        offset: options?.offset ?? 0,
        action: options?.action,
        status: options?.status,
        riskLevel: options?.riskLevel,
      },
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function approveAdminAgeGateAudit(
  accessToken: string,
  csrfToken: string,
  auditId: string,
  note?: string,
) {
  const response = await api.post<{ ok: boolean; id: string; fingerprint: string }>(
    `/api/admin/age-gate/audit/${auditId}/approve`,
    { note },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function rejectAdminAgeGateAudit(
  accessToken: string,
  csrfToken: string,
  auditId: string,
  note?: string,
) {
  const response = await api.post<{ ok: boolean; id: string; fingerprint: string }>(
    `/api/admin/age-gate/audit/${auditId}/reject`,
    { note },
    { headers: authHeaders(accessToken, csrfToken) },
  );
  return response.data;
}

export async function getAdminProfileToolsStatus(accessToken: string, csrfToken: string) {
  const response = await api.get<AdminProfileToolsStatus>(
    "/api/admin/profile-tools/status",
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function getAdminLaunchMode(accessToken: string, csrfToken: string) {
  const response = await api.get<LaunchModeState>(
    "/api/admin/launch-mode",
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function setAdminLaunchMode(accessToken: string, csrfToken: string, desktopOnly: boolean) {
  const response = await api.post<LaunchModeState>(
    "/api/admin/launch-mode",
    { desktopOnly },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function updateVoiceState(
  accessToken: string,
  csrfToken: string,
  payload: {
    channelId: string;
    muted?: boolean;
    deafened?: boolean;
    screenSharing?: boolean;
    noiseSuppression?: boolean;
    voiceActivity?: boolean;
  },
) {
  const response = await api.post<{ ok: true }>("/api/voice/state", payload, {
    headers: authHeaders(accessToken, csrfToken),
  });
  return response.data;
}

// Profile & User Systems API
export type Medal = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  grantedAt?: string;
};

export type UserActivity = {
  id: string;
  type: "JOINED_FORGE" | "CREATED_FORGE" | "MESSAGE_SENT" | "FRIEND_ADDED" | "MEDAL_EARNED" | "LEVEL_UP" | "PREMIUM_UPGRADE" | "CUSTOM";
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
};

export type PublicProfile = User & {
  reputation: number;
  forgesOwned: number;
  forgesMember: number;
  medals: Medal[];
  appRank: number;
  boostRank: number;
};

export type LeaderboardEntry = {
  id: string;
  username: string;
  avatar?: string | null;
  clanTag?: string | null;
  premium: boolean;
  premiumTier?: string;
  reputation?: number;
  corePlusBoostLevel?: number;
  corePlusStreakDays?: number;
  medalCount?: number;
  createdAt: string;
};

export async function searchProfiles(accessToken: string, query: string, limit = 20, offset = 0) {
  const response = await api.get<{
    users: Array<{
      id: string;
      username: string;
      avatar?: string | null;
      clanTag?: string | null;
      premium: boolean;
      premiumTier: string;
      reputation: number;
      createdAt: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>("/api/profiles/users/search", {
    params: { q: query, limit, offset },
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getUserGroups(accessToken: string) {
  const response = await api.get<{
    groups: Array<{
      tag: string;
      name: string;
      description: string;
      totalUsers: number;
      onlineUsers: number;
      premiumUsers: number;
      avgReputation: number;
      sampleUsers: Array<{
        id: string;
        username: string;
        avatar?: string | null;
        status: User["status"];
        premiumTier?: User["premiumTier"];
        reputation: number;
      }>;
    }>;
  }>("/api/profiles/users/groups", {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getPublicProfile(accessToken: string, userId: string) {
  const response = await api.get<PublicProfile>(`/api/profiles/users/${userId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getLeaderboard(accessToken: string, type: "reputation" | "streaks" | "medals", limit = 20, offset = 0) {
  const response = await api.get<{
    leaderboard: LeaderboardEntry[];
    type: string;
    total: number;
    limit: number;
    offset: number;
  }>(`/api/profiles/leaderboards/${type}`, {
    params: { limit, offset },
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getUserActivity(accessToken: string, userId: string, limit = 20, offset = 0) {
  const response = await api.get<{
    activities: UserActivity[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/profiles/users/${userId}/activity`, {
    params: { limit, offset },
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getUserMedals(accessToken: string, userId: string) {
  const response = await api.get<{
    medals: Medal[];
    total: number;
  }>(`/api/profiles/users/${userId}/medals`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function grantMedal(accessToken: string, csrfToken: string, userId: string, medalKey: string) {
  const response = await api.post<{
    message: string;
    medal: Medal;
  }>(
    `/api/profiles/users/${userId}/medals/${medalKey}`,
    {},
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

// ===========================================================================
// Vexora workspace: unreads, home, events, social, cosmetics, avatar, discover, settings
// ===========================================================================

export type ChannelUnread = { channelId: string; unread: number; mentions: number; lastReadAt: string | null };
export type ForgeUnreadSummary = { forgeId: string; unread: number; mentions: number };

export async function getUnreadSummary(accessToken: string) {
  const response = await api.get<{ forges: ForgeUnreadSummary[] }>("/api/reads/summary", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function getForgeUnreads(accessToken: string, forgeId: string) {
  const response = await api.get<{ forgeId: string; channels: ChannelUnread[] }>(`/api/reads/forge/${forgeId}`, { headers: authHeaders(accessToken) });
  return response.data;
}

export async function markChannelRead(accessToken: string, csrfToken: string, channelId: string) {
  const response = await api.post<{ channelId: string; lastReadAt: string }>(`/api/reads/channel/${channelId}`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export type HomeSummary = {
  forge: { id: string; name: string; description?: string | null; icon?: string | null; banner?: string | null; inviteCode: string; ownerId: string; category: string } | null;
  stats: { members: number; online: number; channels: number; upcomingEvents: number; uptimeHours: number };
  featuredEvent: (VexoraEvent & { _count: { participants: number } }) | null;
  recentActivity: Array<{
    id: string;
    content: string;
    createdAt: string;
    channel: { id: string; name: string };
    author: { id: string; username: string; displayName?: string | null; avatar?: string | null } | null;
    reactions: number;
    replies: number;
  }>;
  topCreators: Array<{ id: string; username: string; displayName?: string | null; avatar?: string | null; live: boolean; followers: number; viewers: number }>;
  liveNow: Array<{
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    livePlatform?: string | null;
    liveStreamTitle?: string | null;
    liveStreamUrl?: string | null;
    liveGameCategory?: string | null;
    liveViewerCount: number;
    liveStartedAt?: string | null;
  }>;
};

export async function getHomeSummary(accessToken: string, forgeId?: string | null) {
  const response = await api.get<HomeSummary>("/api/home/summary", { headers: authHeaders(accessToken), params: forgeId ? { forgeId } : {} });
  return response.data;
}

export type EventParticipant = {
  id: string;
  userId: string;
  status: "GOING" | "INTERESTED" | "CHECKED_IN" | "ELIMINATED";
  seed?: number | null;
  user: { id: string; username: string; avatar?: string | null; status: string };
};

export type BracketMatch = { a: string | null; b: string | null; winner: string | null };

export type VexoraEvent = {
  id: string;
  forgeId?: string | null;
  createdById: string;
  type: "EVENT" | "TOURNAMENT";
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
  title: string;
  description?: string | null;
  game?: string | null;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  maxParticipants?: number | null;
  prizePool?: string | null;
  bracket?: { rounds: BracketMatch[][]; generatedAt: string } | null;
  createdAt: string;
  forge?: { id: string; name: string; icon?: string | null } | null;
  createdBy?: { id: string; username: string; avatar?: string | null };
  participants?: EventParticipant[];
};

export async function listEvents(accessToken: string, params: { scope?: "upcoming" | "live" | "past"; forgeId?: string; type?: "EVENT" | "TOURNAMENT" } = {}) {
  const response = await api.get<{ events: VexoraEvent[]; selfId: string }>("/api/events", { headers: authHeaders(accessToken), params });
  return response.data;
}

export async function getEvent(accessToken: string, eventId: string) {
  const response = await api.get<{ event: VexoraEvent; selfId: string; canManage: boolean }>(`/api/events/${eventId}`, { headers: authHeaders(accessToken) });
  return response.data;
}

export async function createEvent(
  accessToken: string,
  csrfToken: string,
  payload: {
    forgeId?: string;
    type?: "EVENT" | "TOURNAMENT";
    title: string;
    description?: string;
    game?: string;
    bannerUrl?: string;
    startsAt: string;
    endsAt?: string;
    maxParticipants?: number;
    prizePool?: string;
  },
) {
  const response = await api.post<{ event: VexoraEvent }>("/api/events", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function rsvpEvent(accessToken: string, csrfToken: string, eventId: string, status: "GOING" | "INTERESTED") {
  const response = await api.post<{ participant: EventParticipant }>(`/api/events/${eventId}/rsvp`, { status }, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function leaveEvent(accessToken: string, csrfToken: string, eventId: string) {
  await api.delete(`/api/events/${eventId}/rsvp`, { headers: authHeaders(accessToken, csrfToken) });
}

export async function startEvent(accessToken: string, csrfToken: string, eventId: string) {
  const response = await api.post<{ event: VexoraEvent }>(`/api/events/${eventId}/start`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function reportMatch(accessToken: string, csrfToken: string, eventId: string, payload: { round: number; match: number; winnerUserId: string }) {
  const response = await api.post<{ event: VexoraEvent; champion: string | null }>(`/api/events/${eventId}/matches`, payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function deleteEvent(accessToken: string, csrfToken: string, eventId: string) {
  await api.delete(`/api/events/${eventId}`, { headers: authHeaders(accessToken, csrfToken) });
}

export type ProfileSummary = {
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    banner?: string | null;
    bio?: string | null;
    clanTag?: string | null;
    status: "ONLINE" | "IDLE" | "DND" | "OFFLINE";
    premium: boolean;
    premiumTier: string;
    isStaff: boolean;
    isRep: boolean;
    isPartner: boolean;
    isCreator: boolean;
    creatorStatus: "OFFLINE" | "LIVE";
    livePlatform?: string | null;
    liveStreamTitle?: string | null;
    liveStreamUrl?: string | null;
    liveGameCategory?: string | null;
    liveViewerCount: number;
    reputation: number;
    socialLinks?: Record<string, string | null> | null;
    avatarConfig?: AvatarConfig | null;
    createdAt: string;
    lastSeenAt?: string | null;
    points: number;
    _count: { followers: number; following: number; posts: number; medals: number; memberships: number };
  };
  isSelf: boolean;
  isFollowing: boolean;
  followsYou: boolean;
};

export async function getProfileSummary(accessToken: string, userId: string | "me") {
  const response = await api.get<ProfileSummary>(`/api/social/users/${userId}/summary`, { headers: authHeaders(accessToken) });
  return response.data;
}

export async function followUser(accessToken: string, csrfToken: string, userId: string) {
  const response = await api.post<{ following: boolean }>(`/api/social/follow/${userId}`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function unfollowUser(accessToken: string, csrfToken: string, userId: string) {
  const response = await api.delete<{ following: boolean }>(`/api/social/follow/${userId}`, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export type Post = {
  id: string;
  authorId: string;
  kind: "POST" | "CLIP";
  content: string;
  mediaUrl?: string | null;
  tags: string[];
  createdAt: string;
  liked: boolean;
  author: { id: string; username: string; displayName?: string | null; avatar?: string | null; isStaff: boolean; isPartner: boolean; isCreator: boolean };
  _count: { likes: number };
};

export async function listPosts(accessToken: string, params: { authorId?: string | "me"; kind?: "POST" | "CLIP"; scope?: "following" | "all" } = {}) {
  const response = await api.get<{ posts: Post[] }>("/api/social/posts", { headers: authHeaders(accessToken), params });
  return response.data;
}

export async function createPost(accessToken: string, csrfToken: string, payload: { kind?: "POST" | "CLIP"; content: string; mediaUrl?: string; tags?: string[] }) {
  const response = await api.post<{ post: Post }>("/api/social/posts", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function deletePost(accessToken: string, csrfToken: string, postId: string) {
  await api.delete(`/api/social/posts/${postId}`, { headers: authHeaders(accessToken, csrfToken) });
}

export async function togglePostLike(accessToken: string, csrfToken: string, postId: string) {
  const response = await api.post<{ liked: boolean; likes: number }>(`/api/social/posts/${postId}/like`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export type CosmeticSlot = "HEAD" | "FACE" | "TOP" | "BOTTOM" | "SHOES" | "BACK" | "ACCESSORY" | "EMOTE";
export type CosmeticRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

export type CosmeticItem = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  slot: CosmeticSlot;
  rarity: CosmeticRarity;
  priceCoins: number;
  imageUrl?: string | null;
  color?: string | null;
  metadata?: { accent?: string } | null;
  owned: boolean;
  equipped: boolean;
  acquiredAt?: string;
};

export type Loadout = Partial<Record<CosmeticSlot, string>>;

export async function getCosmeticCatalog(accessToken: string, slot?: CosmeticSlot) {
  const response = await api.get<{ items: CosmeticItem[]; loadout: Loadout; coins: number }>("/api/cosmetics/catalog", { headers: authHeaders(accessToken), params: slot ? { slot } : {} });
  return response.data;
}

export async function getCosmeticInventory(accessToken: string) {
  const response = await api.get<{ items: CosmeticItem[]; loadout: Loadout; coins: number }>("/api/cosmetics/inventory", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function purchaseCosmetic(accessToken: string, csrfToken: string, itemId: string) {
  const response = await api.post<{ item: CosmeticItem; coins: number }>(`/api/cosmetics/${itemId}/purchase`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function setLoadoutSlot(accessToken: string, csrfToken: string, slot: CosmeticSlot, itemId: string | null) {
  const response = await api.put<{ loadout: Loadout }>("/api/cosmetics/loadout", { slot, itemId }, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export type AvatarConfig = {
  body: "slim" | "athletic" | "broad";
  skin: string;
  hair: "spiky" | "fade" | "curls" | "long" | "bun" | "buzz" | "mohawk" | "none";
  hairColor: string;
  hairLength: number;
  eyes: "sharp" | "round" | "calm" | "visor";
  eyeColor: string;
  face: "neutral" | "smirk" | "focused" | "grin";
  accessory: "none" | "shades" | "headset" | "mask" | "bandana";
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  accent: string;
  background: "city" | "forge" | "void" | "arena";
};

export type AvatarPreset = { id: string; name: string; tagline?: string | null; config: AvatarConfig; createdAt: string };

export async function getAvatar(accessToken: string) {
  const response = await api.get<{ config: AvatarConfig; presets: AvatarPreset[]; maxPresets: number }>("/api/avatar", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function saveAvatar(accessToken: string, csrfToken: string, config: AvatarConfig) {
  const response = await api.put<{ config: AvatarConfig }>("/api/avatar", config, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function createAvatarPreset(accessToken: string, csrfToken: string, payload: { name: string; tagline?: string; config: AvatarConfig }) {
  const response = await api.post<{ preset: AvatarPreset }>("/api/avatar/presets", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function deleteAvatarPreset(accessToken: string, csrfToken: string, presetId: string) {
  await api.delete(`/api/avatar/presets/${presetId}`, { headers: authHeaders(accessToken, csrfToken) });
}

export async function applyAvatarPreset(accessToken: string, csrfToken: string, presetId: string) {
  const response = await api.post<{ config: AvatarConfig }>(`/api/avatar/presets/${presetId}/apply`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export type DiscoverForge = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  banner?: string | null;
  inviteCode: string;
  category: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
  memberCount: number;
  channelCount: number;
  joined: boolean;
};

export async function getDiscover(accessToken: string, params: { category?: string; q?: string } = {}) {
  const response = await api.get<{
    categories: string[];
    featured: DiscoverForge[];
    recommended: DiscoverForge[];
    popularTags: Array<{ tag: string; score: number }>;
    forges: DiscoverForge[];
  }>("/api/discover", { headers: authHeaders(accessToken), params });
  return response.data;
}

export type PrivacySettings = {
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowDmsFromFriends: boolean;
  allowDmsFromMembers: boolean;
  showActivity: boolean;
  showJoinedServers: boolean;
  contentFilter: "off" | "friends" | "everyone";
};

export type SettingsPayload = {
  account: {
    id: string;
    username: string;
    displayName?: string | null;
    email: string;
    emailVerified: boolean;
    bio?: string | null;
    clanTag?: string | null;
    avatar?: string | null;
    banner?: string | null;
    appRole: string;
    premiumTier: string;
    createdAt: string;
  };
  privacy: PrivacySettings;
  linkedAccounts: Record<string, string | null>;
  sessions: Array<{ id: string; createdAt: string; expiresAt: string }>;
  twoFactor: { enabled: boolean; available: boolean };
};

export async function getSettings(accessToken: string) {
  const response = await api.get<SettingsPayload>("/api/settings", { headers: authHeaders(accessToken) });
  return response.data;
}

export async function updateAccountSettings(accessToken: string, csrfToken: string, payload: { displayName?: string | null; email?: string; bio?: string | null; clanTag?: string | null }) {
  const response = await api.patch<{ account: SettingsPayload["account"] }>("/api/settings/account", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function updatePrivacySettings(accessToken: string, csrfToken: string, privacy: PrivacySettings) {
  const response = await api.put<{ privacy: PrivacySettings }>("/api/settings/privacy", privacy, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function updateLinkedAccounts(accessToken: string, csrfToken: string, payload: Record<string, string | null>) {
  const response = await api.put<{ linkedAccounts: Record<string, string | null> }>("/api/settings/linked-accounts", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function changePassword(accessToken: string, csrfToken: string, payload: { currentPassword: string; newPassword: string }) {
  const response = await api.post<{ ok: true; message: string }>("/api/settings/password", payload, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

export async function revokeSession(accessToken: string, csrfToken: string, sessionId: string) {
  await api.delete(`/api/settings/sessions/${sessionId}`, { headers: authHeaders(accessToken, csrfToken) });
}
