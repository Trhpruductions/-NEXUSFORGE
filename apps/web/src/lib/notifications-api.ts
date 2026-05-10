import { api, authHeaders } from "./api";

export type NotificationItem = {
  id: string;
  userId: string;
  type: "MENTION" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "DM" | "SYSTEM";
  title: string;
  body: string;
  data?: unknown;
  read: boolean;
  createdAt: string;
};

export async function listNotifications(accessToken: string, csrfToken: string) {
  const response = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
    "/api/notifications",
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}

export async function markNotificationsRead(
  accessToken: string,
  csrfToken: string,
  ids?: string[],
) {
  const response = await api.post<{ ok: true }>(
    "/api/notifications/read",
    { ids },
    {
      headers: authHeaders(accessToken, csrfToken),
    },
  );
  return response.data;
}
