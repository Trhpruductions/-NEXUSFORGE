import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Daily growth and activity series for the admin dashboard. Every series covers the
// same UTC days, with zeros for days that had nothing, so charts can share an x-axis.

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

// Transfers between players move coins without changing the total supply, so the
// economy series leave them out. Everything else that credits mints; debits burn.
const SUPPLY_NEUTRAL_TYPES = ["TRANSFER_IN", "TRANSFER_OUT"];

type DayCount = { day: Date; value: bigint | number | null };

function toSeries(days: string[], rows: DayCount[]) {
  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.value ?? 0)]));
  return days.map((day) => byDay.get(day) ?? 0);
}

export async function adminAnalytics(rangeDays: AnalyticsRange) {
  const end = new Date();
  const startDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (rangeDays - 1)));
  const days = Array.from({ length: rangeDays }, (_, i) => new Date(startDay.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const since = startDay;

  const [signups, messages, posts, forges, active, minted, burned, topForges] = await Promise.all([
    prisma.$queryRaw<DayCount[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, count(*) AS value FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, count(*) AS value FROM "Message" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, count(*) AS value FROM "Post" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, count(*) AS value FROM "Forge" WHERE "createdAt" >= ${since} GROUP BY 1`,
    // Active = did something that day: sent a message, posted, or had a session in use
    // (refresh tokens rotate every ~15 minutes while a client is open).
    prisma.$queryRaw<DayCount[]>`
      SELECT day, count(DISTINCT uid) AS value FROM (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, "authorId" AS uid FROM "Message" WHERE "createdAt" >= ${since}
        UNION ALL
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), "authorId" FROM "Post" WHERE "createdAt" >= ${since}
        UNION ALL
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), "userId" FROM "RefreshToken" WHERE "createdAt" >= ${since}
      ) activity GROUP BY day`,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', t."timestamp" AT TIME ZONE 'UTC') AS day, sum(t.amount) AS value
      FROM "EconomyTransaction" t LEFT JOIN "EconomyAccount" a ON a.id = t."accountId"
      WHERE t."timestamp" >= ${since} AND t.amount > 0 AND t.type NOT IN (${Prisma.join(SUPPLY_NEUTRAL_TYPES)}) AND coalesce(a."currencyType", 'NC') = 'NC'
      GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', t."timestamp" AT TIME ZONE 'UTC') AS day, -sum(t.amount) AS value
      FROM "EconomyTransaction" t LEFT JOIN "EconomyAccount" a ON a.id = t."accountId"
      WHERE t."timestamp" >= ${since} AND t.amount < 0 AND t.type NOT IN (${Prisma.join(SUPPLY_NEUTRAL_TYPES)}) AND coalesce(a."currencyType", 'NC') = 'NC'
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ id: string; name: string; messages: bigint; members: bigint }>>`
      SELECT f.id, f.name, count(m.id) AS messages,
             (SELECT count(*) FROM "ForgeMember" fm WHERE fm."forgeId" = f.id) AS members
      FROM "Forge" f JOIN "Channel" c ON c."forgeId" = f.id JOIN "Message" m ON m."channelId" = c.id
      WHERE m."createdAt" >= ${since}
      GROUP BY f.id, f.name ORDER BY messages DESC LIMIT 5`,
  ]);

  const series = {
    signups: toSeries(days, signups),
    activeUsers: toSeries(days, active),
    messages: toSeries(days, messages),
    posts: toSeries(days, posts),
    forges: toSeries(days, forges),
    coinsMinted: toSeries(days, minted),
    coinsBurned: toSeries(days, burned),
  };
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  return {
    rangeDays,
    days,
    series,
    totals: {
      signups: sum(series.signups),
      messages: sum(series.messages),
      posts: sum(series.posts),
      forges: sum(series.forges),
      coinsMinted: sum(series.coinsMinted),
      coinsBurned: sum(series.coinsBurned),
      // Peak and latest give a feel for engagement without a misleading "sum of DAU".
      activeUsersPeak: Math.max(0, ...series.activeUsers),
      activeUsersToday: series.activeUsers[series.activeUsers.length - 1] ?? 0,
    },
    topForges: topForges.map((forge) => ({ id: forge.id, name: forge.name, messages: Number(forge.messages), members: Number(forge.members) })),
  };
}
