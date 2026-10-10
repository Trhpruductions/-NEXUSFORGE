import { Router, type Request } from "express";
import { z } from "zod";
import type { SupportStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { hasAdminAccess } from "../lib/app-roles.js";
import { sendEmail } from "../lib/delivery.js";
import { createNotification } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

// Support tickets. Players see their own; staff (admin roles) see and answer all of them.

export const supportRouter = Router();
supportRouter.use(requireAuth);
supportRouter.use(requireCsrf);

/** Cap on unresolved tickets per player, to keep the queue usable. */
const MAX_OPEN_PER_USER = 5;
const UNRESOLVED: SupportStatus[] = ["OPEN", "WAITING_ON_USER"];

const authorSelect = { id: true, username: true, displayName: true, avatar: true } as const;

async function isStaff(req: Request) {
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isAdmin: true, appRole: true } });
  return Boolean(me && hasAdminAccess(me.appRole, me.isAdmin));
}

function ticketUrl(id: string) {
  return `${env.APP_WEB_URL.replace(/\/$/, "")}/app/support?ticket=${id}`;
}

const createSchema = z.object({
  subject: z.string().trim().min(4).max(120),
  category: z.enum(["ACCOUNT", "BILLING", "BUG", "REPORT_USER", "FORGE", "OTHER"]),
  body: z.string().trim().min(10).max(5000),
});

const replySchema = z.object({ body: z.string().trim().min(1).max(5000) });

const listSchema = z.object({
  scope: z.enum(["mine", "all"]).default("mine"),
  status: z.enum(["OPEN", "WAITING_ON_USER", "RESOLVED", "CLOSED", "unresolved", "any"]).default("any"),
});

const statusSchema = z.object({ status: z.enum(["OPEN", "WAITING_ON_USER", "RESOLVED", "CLOSED"]) });

/** Who am I to the support desk (drives the staff view in the UI). */
supportRouter.get("/me", async (req, res) => {
  res.json({ staff: await isStaff(req), maxOpen: MAX_OPEN_PER_USER });
});

supportRouter.get("/tickets", async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { scope, status } = parsed.data;
  if (scope === "all" && !(await isStaff(req))) {
    res.status(403).json({ error: "Staff only" });
    return;
  }
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(scope === "mine" ? { userId: req.user!.id } : {}),
      ...(status === "unresolved" ? { status: { in: UNRESOLVED } } : status === "any" ? {} : { status }),
    },
    orderBy: { lastActivityAt: "desc" },
    take: 100,
    include: {
      user: { select: authorSelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, fromStaff: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });
  res.json({
    tickets: tickets.map(({ messages, _count, ...ticket }) => ({ ...ticket, lastMessage: messages[0] ?? null, messageCount: _count.messages })),
  });
});

supportRouter.post("/tickets", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add a subject (4+ characters) and describe the problem (10+ characters)." });
    return;
  }
  const open = await prisma.supportTicket.count({ where: { userId: req.user!.id, status: { in: UNRESOLVED } } });
  if (open >= MAX_OPEN_PER_USER) {
    res.status(429).json({ error: `You have ${open} open tickets. Close or wait on one before opening another.` });
    return;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user!.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      messages: { create: { authorId: req.user!.id, body: parsed.data.body } },
    },
    include: { user: { select: authorSelect } },
  });

  // Let the staff know. Small team: notify every admin-role account.
  const staff = await prisma.user.findMany({
    where: { OR: [{ isAdmin: true }, { appRole: { in: ["ADMIN", "EXEC", "OWNER"] } }], NOT: { id: req.user!.id } },
    select: { id: true },
    take: 50,
  });
  void Promise.allSettled(staff.map((member) => createNotification({
    userId: member.id,
    type: "SYSTEM",
    title: `New support ticket #${ticket.number}`,
    body: `@${ticket.user.username}: ${ticket.subject}`,
    data: { kind: "support", ticketId: ticket.id },
  })));

  res.status(201).json({ ticket });
});

async function loadTicketFor(req: Request, id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { ...authorSelect, email: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
    },
  });
  if (!ticket) return { ticket: null, staff: false, allowed: false };
  const staff = await isStaff(req);
  return { ticket, staff, allowed: staff || ticket.userId === req.user!.id };
}

supportRouter.get("/tickets/:id", async (req, res) => {
  const { ticket, staff, allowed } = await loadTicketFor(req, req.params.id);
  if (!ticket || !allowed) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  // The player's email is for staff eyes only.
  const { email: _email, ...user } = ticket.user;
  res.json({ ticket: { ...ticket, user: staff ? ticket.user : user }, staff });
});

supportRouter.post("/tickets/:id/messages", async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Write a message first." });
    return;
  }
  const { ticket, staff, allowed } = await loadTicketFor(req, req.params.id);
  if (!ticket || !allowed) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.userId === req.user!.id;
  if (ticket.status === "CLOSED" && !staff) {
    res.status(400).json({ error: "This ticket is closed. Open a new one if you still need help." });
    return;
  }
  // Staff answering someone else's ticket hands it back to the player; the player
  // replying (or reopening a resolved ticket) puts it back in the staff queue.
  const fromStaff = staff && !isOwner;
  const nextStatus: SupportStatus = fromStaff ? "WAITING_ON_USER" : "OPEN";
  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, body: parsed.data.body, fromStaff },
      include: { author: { select: authorSelect } },
    }),
    prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: nextStatus, lastActivityAt: now } }),
  ]);

  if (fromStaff) {
    void createNotification({
      userId: ticket.userId,
      type: "SYSTEM",
      title: `Support replied to #${ticket.number}`,
      body: parsed.data.body.slice(0, 140),
      data: { kind: "support", ticketId: ticket.id },
    }).catch(() => undefined);
    void sendEmail(
      ticket.user.email,
      `Re: [#${ticket.number}] ${ticket.subject}`,
      `Hi ${ticket.user.username},\n\nThe Vexora Gaming team replied to your support ticket:\n\n${parsed.data.body}\n\nReply or view the ticket here: ${ticketUrl(ticket.id)}\n`,
    ).catch(() => undefined);
  }

  res.status(201).json({ message, status: nextStatus });
});

supportRouter.patch("/tickets/:id", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const { ticket, staff, allowed } = await loadTicketFor(req, req.params.id);
  if (!ticket || !allowed) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  // Players can close their own ticket or reopen a resolved one; staff can set anything.
  const next = parsed.data.status;
  const playerAllowed = next === "CLOSED" || (next === "OPEN" && ticket.status === "RESOLVED");
  if (!staff && !playerAllowed) {
    res.status(403).json({ error: "Only staff can set that status." });
    return;
  }
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: next, lastActivityAt: new Date() } });
  if (staff && ticket.userId !== req.user!.id && next === "RESOLVED") {
    void createNotification({
      userId: ticket.userId,
      type: "SYSTEM",
      title: `Ticket #${ticket.number} resolved`,
      body: "Reply on the ticket if you still need help and it will reopen.",
      data: { kind: "support", ticketId: ticket.id },
    }).catch(() => undefined);
  }
  res.json({ ticket: updated });
});
