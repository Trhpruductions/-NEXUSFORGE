import { prisma } from "./prisma.js";
import { createNotification } from "./notifications.js";

const LEAD_MINUTES = 15;
const TICK_MS = 60_000;

/**
 * Every minute: events starting within the next 15 minutes that have not been
 * reminded yet notify everyone who RSVP'd "going" (Settings → Notifications → Event reminders).
 */
export function startEventReminders() {
  const tick = async () => {
    const now = new Date();
    const horizon = new Date(now.getTime() + LEAD_MINUTES * 60_000);
    const due = await prisma.event.findMany({
      where: { reminderSentAt: null, status: "SCHEDULED", startsAt: { gt: now, lte: horizon } },
      select: { id: true, title: true, startsAt: true, forgeId: true, participants: { where: { status: "GOING" }, select: { userId: true } } },
      take: 50,
    });
    for (const event of due) {
      // Claim it first so two ticks cannot double-send.
      const claimed = await prisma.event.updateMany({ where: { id: event.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (!claimed.count) continue;
      const minutes = Math.max(1, Math.round((event.startsAt.getTime() - now.getTime()) / 60_000));
      await Promise.all(
        event.participants.map((entry) =>
          createNotification({
            userId: entry.userId,
            type: "EVENT",
            title: `${event.title} starts in ${minutes} min`,
            body: "You said you were going. Head to Events to jump in.",
            data: { eventId: event.id, forgeId: event.forgeId },
          }).catch(() => undefined),
        ),
      );
    }
  };
  void tick().catch(() => undefined);
  const handle = setInterval(() => void tick().catch(() => undefined), TICK_MS);
  return () => clearInterval(handle);
}
