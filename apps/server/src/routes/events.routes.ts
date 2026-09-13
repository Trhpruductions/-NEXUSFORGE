import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements, grantMedal } from "../lib/achievements.js";
import { getIo } from "../lib/realtime.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { resolveForgeAccess, hasForgePermission } from "../lib/forge-permissions.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth);
eventsRouter.use(requireCsrf);

const createEventSchema = z.object({
  forgeId: z.string().uuid().optional(),
  type: z.enum(["EVENT", "TOURNAMENT"]).default("EVENT"),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  game: z.string().trim().max(80).optional(),
  bannerUrl: z.string().url().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  maxParticipants: z.number().int().min(2).max(1024).optional(),
  prizePool: z.string().trim().max(120).optional(),
});

const updateEventSchema = createEventSchema.partial().omit({ forgeId: true }).extend({
  status: z.enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"]).optional(),
});

const rsvpSchema = z.object({
  status: z.enum(["GOING", "INTERESTED"]).default("GOING"),
});

const reportMatchSchema = z.object({
  round: z.number().int().min(0),
  match: z.number().int().min(0),
  winnerUserId: z.string().uuid(),
});

type BracketMatch = { a: string | null; b: string | null; winner: string | null };
type Bracket = { rounds: BracketMatch[][]; generatedAt: string };

const eventInclude = {
  forge: { select: { id: true, name: true, icon: true } },
  createdBy: { select: { id: true, username: true, avatar: true } },
  participants: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, username: true, avatar: true, status: true } } },
  },
} as const;

async function canManageEvent(userId: string, event: { createdById: string; forgeId: string | null }): Promise<boolean> {
  if (event.createdById === userId) return true;
  if (!event.forgeId) return false;
  const forge = await prisma.forge.findUnique({ where: { id: event.forgeId }, select: { ownerId: true } });
  if (!forge) return false;
  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId, forgeId: event.forgeId } },
    include: { roleLinks: { include: { role: { select: { id: true, position: true, permissions: true } } } } },
  });
  if (!membership) return false;
  const access = resolveForgeAccess(forge.ownerId === userId, membership.roleLinks.map((link) => link.role));
  return hasForgePermission(access, "manageChannels");
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Single-elimination bracket. Byes are represented by a null opponent and auto-advance. */
function generateBracket(userIds: string[]): Bracket {
  const seeded = shuffle(userIds);
  let size = 1;
  while (size < seeded.length) size *= 2;
  const firstRound: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = seeded[i] ?? null;
    const b = seeded[i + 1] ?? null;
    firstRound.push({ a, b, winner: a && !b ? a : !a && b ? b : null });
  }
  const rounds: BracketMatch[][] = [firstRound];
  let current = firstRound;
  while (current.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push({ a: current[i]?.winner ?? null, b: current[i + 1]?.winner ?? null, winner: null });
    }
    rounds.push(next);
    current = next;
  }
  return { rounds, generatedAt: new Date().toISOString() };
}

function emitEvent(event: { id: string; forgeId: string | null }, action: string) {
  try {
    const io = getIo();
    io.emit("event:changed", { eventId: event.id, forgeId: event.forgeId, action });
  } catch {
    // realtime not ready
  }
}

eventsRouter.get("/", async (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : "upcoming";
  const forgeId = typeof req.query.forgeId === "string" ? req.query.forgeId : undefined;
  const type = req.query.type === "TOURNAMENT" || req.query.type === "EVENT" ? req.query.type : undefined;
  const now = new Date();

  const memberships = await prisma.forgeMember.findMany({ where: { userId: req.user!.id }, select: { forgeId: true } });
  const forgeIds = memberships.map((entry) => entry.forgeId);

  const where = {
    ...(forgeId ? { forgeId } : { OR: [{ forgeId: null }, { forgeId: { in: forgeIds } }] }),
    ...(type ? { type } : {}),
    ...(scope === "live"
      ? { status: "LIVE" as const }
      : scope === "past"
        ? { OR: [{ status: "COMPLETED" as const }, { status: "CANCELLED" as const }, { startsAt: { lt: now }, status: "SCHEDULED" as const }] }
        : { status: "SCHEDULED" as const, startsAt: { gte: now } }),
  };

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: scope === "past" ? "desc" : "asc" },
    take: 60,
    include: eventInclude,
  });

  res.json({ events, selfId: req.user!.id });
});

eventsRouter.post("/", async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.prizePool) {
    const organizer = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { ageVerificationLevel: true } });
    if (organizer?.ageVerificationLevel !== "VERIFIED") {
      res.status(403).json({ error: "Events with a prize pool need an ID-verified organizer. Verify your age in Settings first.", code: "AGE_VERIFIED_REQUIRED" });
      return;
    }
  }

  if (parsed.data.forgeId) {
    const allowed = await canManageEvent(req.user!.id, { createdById: "", forgeId: parsed.data.forgeId });
    if (!allowed) {
      res.status(403).json({ error: "You need the Manage channels permission to schedule forge events" });
      return;
    }
  }

  const event = await prisma.event.create({
    data: {
      forgeId: parsed.data.forgeId,
      createdById: req.user!.id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      game: parsed.data.game,
      bannerUrl: parsed.data.bannerUrl,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      maxParticipants: parsed.data.maxParticipants,
      prizePool: parsed.data.prizePool,
      participants: { create: { userId: req.user!.id, status: "GOING" } },
    },
    include: eventInclude,
  });

  emitEvent(event, "created");
  res.status(201).json({ event });
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: eventInclude });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json({ event, selfId: req.user!.id, canManage: await canManageEvent(req.user!.id, event) });
});

eventsRouter.patch("/:id", async (req, res) => {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canManageEvent(req.user!.id, existing))) {
    res.status(403).json({ error: "You cannot edit this event" });
    return;
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    },
    include: eventInclude,
  });

  emitEvent(event, "updated");
  res.json({ event });
});

eventsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canManageEvent(req.user!.id, existing))) {
    res.status(403).json({ error: "You cannot delete this event" });
    return;
  }
  await prisma.event.delete({ where: { id: existing.id } });
  emitEvent(existing, "deleted");
  res.json({ ok: true, eventId: existing.id });
});

eventsRouter.post("/:id/rsvp", async (req, res) => {
  const parsed = rsvpSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { participants: true } } },
  });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (event.status === "COMPLETED" || event.status === "CANCELLED") {
    res.status(400).json({ error: "This event is closed" });
    return;
  }
  if (event.type === "TOURNAMENT" && event.status === "LIVE") {
    res.status(400).json({ error: "Registration closed: the tournament is live" });
    return;
  }

  const existing = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
  });
  if (!existing && parsed.data.status === "GOING" && event.maxParticipants && event._count.participants >= event.maxParticipants) {
    res.status(400).json({ error: "This event is full" });
    return;
  }

  const participant = await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
    update: { status: parsed.data.status },
    create: { eventId: event.id, userId: req.user!.id, status: parsed.data.status },
    include: { user: { select: { id: true, username: true, avatar: true, status: true } } },
  });

  emitEvent(event, "rsvp");
  res.json({ participant });
  void evaluateAchievements(req.user!.id);
});

eventsRouter.delete("/:id/rsvp", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { id: true, forgeId: true, status: true, type: true } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (event.type === "TOURNAMENT" && event.status === "LIVE") {
    res.status(400).json({ error: "You cannot leave a live tournament" });
    return;
  }
  await prisma.eventParticipant.deleteMany({ where: { eventId: event.id, userId: req.user!.id } });
  emitEvent(event, "rsvp");
  res.json({ ok: true });
});

/** Start a tournament: lock registration and generate the bracket from GOING participants. */
eventsRouter.post("/:id/start", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { participants: true } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canManageEvent(req.user!.id, event))) {
    res.status(403).json({ error: "You cannot start this event" });
    return;
  }
  if (event.status !== "SCHEDULED") {
    res.status(400).json({ error: "Only scheduled events can be started" });
    return;
  }

  let bracket: Bracket | undefined;
  if (event.type === "TOURNAMENT") {
    const entrants = event.participants.filter((entry) => entry.status === "GOING" || entry.status === "CHECKED_IN").map((entry) => entry.userId);
    if (entrants.length < 2) {
      res.status(400).json({ error: "A tournament needs at least two entrants" });
      return;
    }
    bracket = generateBracket(entrants);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "LIVE", bracket: bracket ?? undefined },
    include: eventInclude,
  });

  emitEvent(updated, "started");
  res.json({ event: updated });
});

/** Report a match winner and advance the bracket. Completes the event when the final is decided. */
eventsRouter.post("/:id/matches", async (req, res) => {
  const parsed = reportMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canManageEvent(req.user!.id, event))) {
    res.status(403).json({ error: "You cannot report matches for this event" });
    return;
  }
  const bracket = event.bracket as Bracket | null;
  if (event.status !== "LIVE" || !bracket) {
    res.status(400).json({ error: "This tournament is not live" });
    return;
  }

  const match = bracket.rounds[parsed.data.round]?.[parsed.data.match];
  if (!match) {
    res.status(400).json({ error: "Unknown match" });
    return;
  }
  if (match.winner) {
    res.status(400).json({ error: "This match already has a winner" });
    return;
  }
  if (parsed.data.winnerUserId !== match.a && parsed.data.winnerUserId !== match.b) {
    res.status(400).json({ error: "Winner must be one of the two players in the match" });
    return;
  }

  match.winner = parsed.data.winnerUserId;
  const nextRound = bracket.rounds[parsed.data.round + 1];
  if (nextRound) {
    const target = nextRound[Math.floor(parsed.data.match / 2)];
    if (parsed.data.match % 2 === 0) target.a = match.winner;
    else target.b = match.winner;
    // Auto-advance byes that now resolve.
    if (target.a && !target.b && bracket.rounds[parsed.data.round].length === 1) target.winner = target.a;
  }

  const finalRound = bracket.rounds[bracket.rounds.length - 1];
  const champion = finalRound.length === 1 ? finalRound[0].winner : null;
  const loserId = parsed.data.winnerUserId === match.a ? match.b : match.a;

  const updated = await prisma.$transaction(async (tx) => {
    if (loserId) {
      await tx.eventParticipant.updateMany({ where: { eventId: event.id, userId: loserId }, data: { status: "ELIMINATED" } });
    }
    return tx.event.update({
      where: { id: event.id },
      data: { bracket, ...(champion ? { status: "COMPLETED", endsAt: new Date() } : {}) },
      include: eventInclude,
    });
  });

  emitEvent(updated, champion ? "completed" : "match");
  res.json({ event: updated, champion });
  if (champion) void grantMedal(champion, "champion");
});
