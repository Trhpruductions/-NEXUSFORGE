import { prisma } from "./prisma.js";
import { dispatchPushNotification } from "./push.js";

type NotificationInput = {
  userId: string;
  type: "MENTION" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "DM" | "SYSTEM";
  title: string;
  body: string;
  data?: unknown;
};

export async function createNotification(input: NotificationInput): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as never,
    },
  });

  void dispatchPushNotification({
    userId: input.userId,
    title: input.title,
    body: input.body,
    data: input.data,
    notificationId: notification.id,
  }).catch(() => undefined);
}
