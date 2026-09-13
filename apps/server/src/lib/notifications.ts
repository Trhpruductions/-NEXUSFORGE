import { prisma } from "./prisma.js";
import { dispatchPushNotification } from "./push.js";

type NotificationInput = {
  userId: string;
  type: "MENTION" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "DM" | "SYSTEM";
  title: string;
  body: string;
  data?: unknown;
};

const prefKeyForType: Record<NotificationInput["type"], "mentions" | "directMessages" | "friendRequests" | "system"> = {
  MENTION: "mentions",
  DM: "directMessages",
  FRIEND_REQUEST: "friendRequests",
  FRIEND_ACCEPTED: "friendRequests",
  SYSTEM: "system",
};

type NotificationPrefs = { notifications?: Record<string, boolean> };

export async function createNotification(input: NotificationInput): Promise<void> {
  // Respect the user's notification preferences (Settings → Notifications).
  const owner = await prisma.user.findUnique({ where: { id: input.userId }, select: { preferences: true } });
  const prefs = ((owner?.preferences as NotificationPrefs | null)?.notifications ?? {}) as Record<string, boolean>;
  const category = prefKeyForType[input.type];
  const wantsCategory = prefs[category] !== false;
  const isVerification = typeof input.data === "object" && input.data !== null && "ageVerification" in (input.data as Record<string, unknown>);
  if (!wantsCategory && !isVerification) return;
  const wantsPush = prefs.push !== false;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as never,
    },
  });

  if (!wantsPush) return;
  void dispatchPushNotification({
    userId: input.userId,
    title: input.title,
    body: input.body,
    data: input.data,
    notificationId: notification.id,
  }).catch(() => undefined);
}
