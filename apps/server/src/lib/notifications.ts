import { prisma } from "./prisma.js";
import { dispatchPushNotification } from "./push.js";
import { getIo } from "./realtime.js";
import { isQuietNow, type QuietHours } from "./quiet-hours.js";

type NotificationInput = {
  userId: string;
  type: "MENTION" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "DM" | "SYSTEM" | "LIVE" | "EVENT";
  title: string;
  body: string;
  data?: unknown;
};

const prefKeyForType: Record<NotificationInput["type"], "mentions" | "directMessages" | "friendRequests" | "system" | "liveAlerts" | "eventReminders"> = {
  MENTION: "mentions",
  DM: "directMessages",
  FRIEND_REQUEST: "friendRequests",
  FRIEND_ACCEPTED: "friendRequests",
  SYSTEM: "system",
  LIVE: "liveAlerts",
  EVENT: "eventReminders",
};

type NotificationPrefs = { notifications?: Record<string, unknown> & { quietHours?: Partial<QuietHours> } };

/** Security alerts reach the user even during quiet hours. */
const BYPASS_QUIET_KINDS = new Set(["new-sign-in"]);

export async function createNotification(input: NotificationInput): Promise<void> {
  // Respect the user's notification preferences (Settings → Notifications).
  const owner = await prisma.user.findUnique({ where: { id: input.userId }, select: { preferences: true } });
  const notificationPrefs = (owner?.preferences as NotificationPrefs | null)?.notifications ?? {};
  const prefs = notificationPrefs as Record<string, boolean>;
  const category = prefKeyForType[input.type];
  const wantsCategory = prefs[category] !== false;
  const isVerification = typeof input.data === "object" && input.data !== null && "ageVerification" in (input.data as Record<string, unknown>);
  if (!wantsCategory && !isVerification) return;
  const kind = typeof input.data === "object" && input.data !== null ? (input.data as Record<string, unknown>).kind : undefined;
  // During quiet hours the notification is still stored and shown in the inbox, but
  // nothing buzzes: no push, and open clients are told not to play a sound.
  const quiet = !BYPASS_QUIET_KINDS.has(String(kind)) && isQuietNow(notificationPrefs.quietHours);
  const wantsPush = prefs.push !== false && !quiet;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as never,
    },
  });

  // Realtime delivery to open sessions (badge, inbox, sound).
  try {
    getIo().to(`user:${input.userId}`).emit("notification:new", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      createdAt: notification.createdAt,
      quiet,
    });
  } catch {
    // gateway not ready yet (boot-time notifications)
  }

  if (!wantsPush) return;
  void dispatchPushNotification({
    userId: input.userId,
    title: input.title,
    body: input.body,
    data: input.data,
    notificationId: notification.id,
  }).catch(() => undefined);
}
