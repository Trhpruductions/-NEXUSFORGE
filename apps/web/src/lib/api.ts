import axios from "axios";
import { API_BASE_URL } from "./config";

export type User = {
  id: string;
  username: string;
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
  isAdmin?: boolean;
  currentActivity?: string | null;
  activityDetails?: string | null;
  lastSeenAt?: string | null;
};

export type Channel = {
  id: string;
  forgeId: string;
  name: string;
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
};

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
  sender: Pick<User, "id" | "username" | "avatar" | "status">;
  receiver: Pick<User, "id" | "username" | "avatar" | "status">;
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

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let unauthorizedHandler: (() => void) | null = null;
let lastUnauthorizedHandledAt = 0;

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const now = Date.now();
      if (unauthorizedHandler && now - lastUnauthorizedHandledAt > 500) {
        lastUnauthorizedHandledAt = now;
        unauthorizedHandler();
      }
    }

    return Promise.reject(error);
  },
);

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

export async function register(payload: { username: string; email: string; password: string }) {
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
    template?: "GAMING" | "CREATOR" | "ESPORTS" | "STUDY";
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
  const response = await api.get<{ forge: PublicForgeInvite }>(`/api/forges/public/${encodeURIComponent(inviteCode)}`, {
    params: source ? { src: source } : {},
  });
  return response.data;
}

export async function getForge(accessToken: string, forgeId: string) {
  const response = await api.get<{
    forge: Forge & {
      channels: Channel[];
      botInstallations: Array<{
        id: string;
        enabled: boolean;
        createdAt: string;
        commands: BotCommand[];
        bot: BotApp;
      }>;
      inviteSources: InviteSourceStat[];
      members: Array<{
        user: {
          id: string;
          username: string;
          avatar?: string | null;
          status: "ONLINE" | "IDLE" | "DND" | "OFFLINE";
          premium: boolean;
        };
      }>;
    };
  }>(`/api/forges/${forgeId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getForgeInviteAnalytics(accessToken: string, forgeId: string) {
  const response = await api.get<{ analytics: ForgeInviteAnalytics }>(`/api/forges/${forgeId}/invite-analytics`, {
    headers: authHeaders(accessToken),
  });
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

export async function getMessages(accessToken: string, channelId: string) {
  const response = await api.get<{ messages: Message[]; nextCursor: string | null }>(`/api/messages/${channelId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function postMessage(
  accessToken: string,
  csrfToken: string,
  payload: { channelId: string; content: string; optimisticId?: string; attachments?: string[] },
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
