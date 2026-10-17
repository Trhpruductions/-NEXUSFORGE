"use strict";

// Activity panel: counts from the app database. Every query is a SELECT inside a read-only transaction.
// Table and column names come from apps/server/prisma/schema.prisma (no @@map is used there).

const { withReadOnly } = require("../appdb");
const { scrubText } = require("../secrets");

const NOW = "(now() AT TIME ZONE 'UTC')";

// The last database time seen. "New since" counts compare against it, so a restart does not replay old rows.
let watermark = null;

async function collectDb() {
  const started = Date.now();
  return withReadOnly(async (select) => {
    const clock = await select(`SELECT to_char(${NOW}, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS db_now`);
    const dbNow = clock.rows[0].db_now;
    const wm = watermark || dbNow;

    const users = await select(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE "lastSeenAt" >= ${NOW} - interval '5 minutes')::int AS seen_5m,
              count(*) FILTER (WHERE "createdAt" >= ${NOW} - interval '1 hour')::int AS signups_1h,
              count(*) FILTER (WHERE "createdAt" > $1::timestamp)::int AS new_since
         FROM "User"`,
      [wm],
    );

    const messages = await select(
      `SELECT count(*) FILTER (WHERE "createdAt" >= ${NOW} - interval '1 hour')::int AS last_1h,
              count(*) FILTER (WHERE "createdAt" > $1::timestamp)::int AS new_since
         FROM "Message"
        WHERE "createdAt" >= LEAST(${NOW} - interval '1 hour', $1::timestamp)`,
      [wm],
    );

    const forges = await select(`SELECT count(*)::int AS total FROM "Forge"`);

    const tickets = await select(
      `SELECT status::text AS status, count(*)::int AS n FROM "SupportTicket" GROUP BY status`,
    );

    const reports = await select(
      `SELECT (SELECT count(*) FROM "MessageReport" WHERE status = 'OPEN')::int AS message_open,
              (SELECT count(*) FROM "ProblemReport" WHERE status = 'OPEN')::int AS problem_open`,
    );

    const errorGroups = await select(
      `SELECT count(*) FILTER (WHERE "lastSeenAt" >= ${NOW} - interval '1 hour')::int AS groups_1h,
              count(*) FILTER (WHERE "firstSeenAt" > $1::timestamp)::int AS new_groups
         FROM "ErrorEvent"
        WHERE "lastSeenAt" >= LEAST(${NOW} - interval '1 hour', $1::timestamp)`,
      [wm],
    );

    const recentErrors = await select(
      `SELECT source, left(message, 200) AS message, left(path, 120) AS path, count,
              "lastSeenAt"::text AS last_seen
         FROM "ErrorEvent"
        WHERE "lastSeenAt" >= ${NOW} - interval '1 hour'
        ORDER BY "lastSeenAt" DESC
        LIMIT 8`,
    );

    const newErrorGroups = await select(
      `SELECT source, left(message, 200) AS message, left(path, 120) AS path, count
         FROM "ErrorEvent"
        WHERE "firstSeenAt" > $1::timestamp
        ORDER BY "firstSeenAt" DESC
        LIMIT 5`,
      [wm],
    );

    const email = await select(
      `SELECT status::text AS status, count(*)::int AS n
         FROM "EmailMessage"
        WHERE "createdAt" >= ${NOW} - interval '24 hours'
        GROUP BY status
        ORDER BY n DESC`,
    );

    const jackpot = await select(
      `SELECT slug, number, status::text AS status, pot::text AS pot, "totalTickets" AS tickets,
              "opensAt"::text AS opens_at, "closesAt"::text AS closes_at
         FROM "JackpotRound"
        ORDER BY (status = 'OPEN') DESC, number DESC
        LIMIT 1`,
    );

    watermark = dbNow;

    const ticketCounts = Object.fromEntries(tickets.rows.map((row) => [row.status, row.n]));
    const openTickets = tickets.rows.filter((row) => row.status !== "CLOSED").reduce((sum, row) => sum + row.n, 0);
    const u = users.rows[0];
    const m = messages.rows[0];

    return {
      checkedAt: new Date().toISOString(),
      dbNow,
      queryMs: Date.now() - started,
      users: { total: u.total, seen5m: u.seen_5m, signups1h: u.signups_1h, newSince: u.new_since },
      messages: { last1h: m.last_1h, newSince: m.new_since },
      forges: { total: forges.rows[0].total },
      tickets: { open: openTickets, byStatus: ticketCounts },
      reports: { messageOpen: reports.rows[0].message_open, problemOpen: reports.rows[0].problem_open },
      errors: {
        groups1h: errorGroups.rows[0].groups_1h,
        newGroups: errorGroups.rows[0].new_groups,
        recent: recentErrors.rows.map((row) => ({
          source: row.source,
          message: scrubText(row.message || ""),
          path: scrubText(row.path || ""),
          count: row.count,
          lastSeen: row.last_seen,
        })),
        newList: newErrorGroups.rows.map((row) => ({
          source: row.source,
          message: scrubText(row.message || ""),
          path: scrubText(row.path || ""),
          count: row.count,
        })),
      },
      email24h: email.rows.map((row) => ({ status: row.status, n: row.n })),
      jackpot: jackpot.rows[0]
        ? {
            slug: jackpot.rows[0].slug,
            number: jackpot.rows[0].number,
            status: jackpot.rows[0].status,
            pot: jackpot.rows[0].pot,
            tickets: jackpot.rows[0].tickets,
            opensAt: jackpot.rows[0].opens_at,
            closesAt: jackpot.rows[0].closes_at,
          }
        : null,
    };
  });
}

module.exports = { collectDb };
