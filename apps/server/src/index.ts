import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { setIo } from "./lib/realtime.js";
import { verifyAccessToken } from "./lib/jwt.js";
import { globalRateLimit, authRateLimit } from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.routes.js";
import { dmsRouter } from "./routes/dms.routes.js";
import { friendsRouter } from "./routes/friends.routes.js";
import { forgesRouter } from "./routes/forges.routes.js";
import { forgeManagementRouter } from "./routes/forge-management.routes.js";
import { readsRouter } from "./routes/reads.routes.js";
import { eventsRouter } from "./routes/events.routes.js";
import { socialRouter } from "./routes/social.routes.js";
import { cosmeticsRouter } from "./routes/cosmetics.routes.js";
import { avatarRouter } from "./routes/avatar.routes.js";
import { discoverRouter } from "./routes/discover.routes.js";
import { homeRouter } from "./routes/home.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { verificationRouter } from "./routes/verification.routes.js";
import { ensureCosmeticCatalog } from "./lib/cosmetic-catalog.js";
import { healthRouter } from "./routes/health.routes.js";
import { messagesRouter } from "./routes/messages.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { botsRouter } from "./routes/bots.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { uploadsRouter } from "./routes/uploads.routes.js";
import { voiceRouter } from "./routes/voice.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { profilesRouter } from "./routes/profiles.routes.js";
import { runtimeRouter } from "./routes/runtime.routes.js";
import { developerRouter } from "./routes/developer.routes.js";
import { oauthRouter } from "./routes/oauth.routes.js";
import { billingRouter, billingWebhookHandler } from "./routes/billing.routes.js";
import economyRouter from "./routes/economy-routes.js";
import miningRouter from "./routes/mining-routes.js";
import jackpotRouter from "./routes/jackpot.routes.js";
import cryptoRouter from "./routes/crypto.routes.js";
import { ageRouter } from "./routes/age.routes.js";
import { JackpotEngine } from "./lib/jackpot-engine.js";
import { reportDiscordAlert, startDiscordBot, stopDiscordBot } from "./lib/discord-bot.js";
import { discordInteractionHandler } from "./routes/discord.routes.js";
import { globalErrorHandler } from "./middleware/error-handler.js";
import { anonymizeIP } from "./lib/ip-security.js";
import { initializeAuditLogger } from "./utils/audit-logger.js";

// Custom morgan token for anonymized IP
morgan.token('remote-addr-masked', (req: any) => {
  return anonymizeIP(req.ip || req.connection.remoteAddress || 'unknown').substring(0, 12) + "...";
});

const app = express();
const httpServer = createServer(app);

initializeAuditLogger(prisma);

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const configuredOrigins = env.CLIENT_ORIGIN.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

let appWebOrigin = "";
try {
  appWebOrigin = new URL(env.APP_WEB_URL).origin;
} catch {
  appWebOrigin = "";
}

const allowedOrigins = Array.from(
  new Set(
    env.NODE_ENV === "production"
      ? [...configuredOrigins, appWebOrigin].filter(Boolean)
      : [...configuredOrigins, "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
  ),
);

const hasOnlyLocalConfiguredOrigins =
  allowedOrigins.length > 0 && allowedOrigins.every((origin) => localOriginPattern.test(origin));

function isOriginAllowed(origin?: string) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (env.NODE_ENV !== "production" && localOriginPattern.test(origin)) {
    return true;
  }

  if (env.NODE_ENV === "production" && hasOnlyLocalConfiguredOrigins) {
    return /^https:\/\//i.test(origin);
  }

  return false;
}

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  },
});

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan(':method :url :status :res[content-length] - :response-time ms [GHOST-IP: :remote-addr-masked]'));
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);
app.post("/api/discord/interactions", express.raw({ type: "application/json" }), discordInteractionHandler);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(globalRateLimit);

app.use("/api", healthRouter);
app.use("/api/auth", authRateLimit, authRouter);
app.use("/api/forges", forgesRouter);
app.use("/api/forges", forgeManagementRouter);
app.use("/api/reads", readsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/social", socialRouter);
app.use("/api/cosmetics", cosmeticsRouter);
app.use("/api/avatar", avatarRouter);
app.use("/api/discover", discoverRouter);
app.use("/api/home", homeRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/dms", dmsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/search", searchRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/bots", botsRouter);
app.use("/api/developer", developerRouter);
app.use("/api/oauth", express.urlencoded({ extended: true }), oauthRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/runtime", runtimeRouter);
app.use("/api/admin", adminRouter);
app.use("/api/billing", billingRouter);
app.use("/api/economy", economyRouter);
app.use("/api/mining", miningRouter);
app.use("/api/jackpot", jackpotRouter);
app.use("/api/crypto", cryptoRouter);
app.use("/api/age", ageRouter);

app.use(globalErrorHandler);

io.use((socket, next) => {
  const raw = socket.handshake.auth?.token;
  if (typeof raw !== "string") {
    return next(new Error("Unauthorized"));
  }

  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  try {
    const payload = verifyAccessToken(token);
    socket.data.user = {
      id: payload.sub,
      // Username and Email removed from realtime context for security.
      // Load from DB/Cache if needed for presence logic.
    };
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

const onlineSockets = new Map<string, number>();

async function setPresence(userId: string, status: "ONLINE" | "OFFLINE") {
  try {
    await prisma.user.update({ where: { id: userId }, data: { status, lastSeenAt: new Date() } });
    const memberships = await prisma.forgeMember.findMany({ where: { userId }, select: { forgeId: true } });
    for (const { forgeId } of memberships) {
      io.to(`forge:${forgeId}`).emit("presence:changed", { forgeId, userId, status });
    }
  } catch {
    // presence is best-effort
  }
}

io.on("connection", (socket) => {
  socket.emit("welcome", { message: "Connected to Vexora Gaming realtime gateway" });
  socket.join(`user:${socket.data.user.id}`);

  const presenceUserId: string = socket.data.user.id;
  const activeSockets = (onlineSockets.get(presenceUserId) ?? 0) + 1;
  onlineSockets.set(presenceUserId, activeSockets);
  if (activeSockets === 1) void setPresence(presenceUserId, "ONLINE");

  socket.on("disconnect", () => {
    const remaining = (onlineSockets.get(presenceUserId) ?? 1) - 1;
    if (remaining <= 0) {
      onlineSockets.delete(presenceUserId);
      // Grace period so a page refresh does not flicker offline.
      setTimeout(() => {
        if (!onlineSockets.has(presenceUserId)) void setPresence(presenceUserId, "OFFLINE");
      }, 8000);
    } else {
      onlineSockets.set(presenceUserId, remaining);
    }
  });

  socket.on("forge:join", async (forgeId: string) => {
    if (typeof forgeId !== "string" || !forgeId) return;
    const membership = await prisma.forgeMember
      .findUnique({
        where: { userId_forgeId: { userId: socket.data.user.id, forgeId } },
        select: { id: true },
      })
      .catch(() => null);
    if (membership) {
      socket.join(`forge:${forgeId}`);
    }
  });

  socket.on("forge:leave", (forgeId: string) => {
    if (typeof forgeId !== "string" || !forgeId) return;
    socket.leave(`forge:${forgeId}`);
  });

  socket.on("channel:join", (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on("voice:join", (channelId: string) => {
    socket.join(`voice:${channelId}`);
    socket.to(`voice:${channelId}`).emit("voice:presence", {
      channelId,
      userId: socket.data.user.id,
      action: "joined",
    });
  });

  socket.on("voice:leave", (channelId: string) => {
    socket.leave(`voice:${channelId}`);
    socket.to(`voice:${channelId}`).emit("voice:presence", {
      channelId,
      userId: socket.data.user.id,
      action: "left",
    });
  });

  socket.on("dm:join", (threadId: string) => {
    socket.join(`dm:${threadId}`);
  });

  socket.on("dm:leave", (threadId: string) => {
    socket.leave(`dm:${threadId}`);
  });

  socket.on("typing:start", (channelId: string) => {
    socket.to(`channel:${channelId}`).emit("typing:start", {
      channelId,
      userId: socket.data.user.id,
    });
  });

  socket.on("typing:stop", (channelId: string) => {
    socket.to(`channel:${channelId}`).emit("typing:stop", {
      channelId,
      userId: socket.data.user.id,
    });
  });

  socket.on("dm:typing:start", (threadId: string) => {
    socket.to(`dm:${threadId}`).emit("dm:typing:start", {
      threadId,
      userId: socket.data.user.id,
      username: socket.data.user.username,
    });
  });

  socket.on("dm:typing:stop", (threadId: string) => {
    socket.to(`dm:${threadId}`).emit("dm:typing:stop", {
      threadId,
      userId: socket.data.user.id,
    });
  });
});

setIo(io);
void ensureCosmeticCatalog().catch((error) => console.warn("[cosmetics] catalog seed failed", error));

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Vexora Gaming API failed to start: port ${env.PORT} is already in use. Stop the existing process or run cleanup before restarting.`,
    );
    process.exit(1);
    return;
  }

  if (error.code === "EACCES") {
    console.error(`Vexora Gaming API failed to start: insufficient permissions to bind port ${env.PORT}.`);
    process.exit(1);
    return;
  }

  console.error("Vexora Gaming API failed to start due to an unexpected server error.", error);
  process.exit(1);
});

httpServer.listen(env.PORT, () => {
  console.log(`Vexora Gaming API running on http://localhost:${env.PORT}`);
  
  // Engage Industrial Engines
  JackpotEngine.start();
  
  void startDiscordBot().catch((error) => {
    console.error("[discord] Failed to start bot:", error);
    const message = error instanceof Error ? error.message : String(error);
    void reportDiscordAlert(`Bot startup failure: ${message}`);
  });
});

async function gracefulShutdown(): Promise<void> {
  await stopDiscordBot();
  await prisma.$disconnect();
  httpServer.close();
}

process.on("SIGINT", () => {
  void gracefulShutdown();
});

process.on("SIGTERM", () => {
  void gracefulShutdown();
});
