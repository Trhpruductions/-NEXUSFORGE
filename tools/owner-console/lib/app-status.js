"use strict";

// Read-only app database status for email and legal policy versions. Every query is a SELECT in a read-only
// transaction (see appdb.js). Table and column names come from apps/server/prisma/schema.prisma.

const { withReadOnly } = require("./appdb");
const { scrubText } = require("./secrets");

const NOW = "(now() AT TIME ZONE 'UTC')";

async function collectEmailStatus(readiness) {
  return withReadOnly(async (select) => {
    const byStatus = await select(
      `SELECT status::text AS status, count(*)::int AS n
         FROM "EmailMessage"
        WHERE "createdAt" >= ${NOW} - interval '24 hours'
        GROUP BY status
        ORDER BY n DESC`,
    );
    const failed = await select(
      `SELECT count(*)::int AS n
         FROM "EmailMessage"
        WHERE status = 'FAILED' AND "createdAt" >= ${NOW} - interval '1 hour'`,
    );
    const latest = await select(
      `SELECT "updatedAt"::text AS latest FROM "EmailMessage" ORDER BY "updatedAt" DESC LIMIT 1`,
    );
    return {
      checkedAt: new Date().toISOString(),
      last24h: byStatus.rows.map((row) => ({ status: row.status, n: row.n })),
      failedLastHour: failed.rows[0].n,
      latestUpdate: latest.rows[0] ? latest.rows[0].latest : null,
      webhookEnabled: Boolean(readiness && readiness.emailWebhookEnabled),
      testMode: readiness ? readiness.emailTestMode : "unknown",
    };
  });
}

async function collectLegalVersions() {
  return withReadOnly(async (select) => {
    const { rows } = await select(
      `SELECT p.slug, p.title, p."sortOrder" AS sort_order, p."requiredAtSignup" AS required,
              v.status, count(v.id)::int AS n, max(v.version)::int AS latest_version,
              max(v.version) FILTER (WHERE v.status = 'PUBLISHED')::int AS published_version
         FROM "LegalPolicy" p
         LEFT JOIN "LegalPolicyVersion" v ON v."policyId" = p.id
        GROUP BY p.slug, p.title, p."sortOrder", p."requiredAtSignup", v.status
        ORDER BY p."sortOrder" ASC, p.slug ASC`,
    );
    const policies = new Map();
    for (const row of rows) {
      if (!policies.has(row.slug)) {
        policies.set(row.slug, {
          slug: row.slug,
          title: scrubText(row.title || ""),
          required: Boolean(row.required),
          publishedVersion: null,
          statuses: { DRAFT: 0, IN_REVIEW: 0, PUBLISHED: 0, ARCHIVED: 0 },
        });
      }
      const policy = policies.get(row.slug);
      if (row.status) policy.statuses[row.status] = (policy.statuses[row.status] || 0) + row.n;
      if (row.published_version) policy.publishedVersion = row.published_version;
    }
    return { checkedAt: new Date().toISOString(), policies: [...policies.values()] };
  });
}

module.exports = { collectEmailStatus, collectLegalVersions };
