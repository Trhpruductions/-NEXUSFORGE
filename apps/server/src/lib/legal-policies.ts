import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { defaultConsentText, pendingConsents, type CurrentRequired } from "./legal-rules.js";
import { legalPolicyCatalog, privacySeedContent, privacySeedSummary, termsSeedContent, termsSeedSummary } from "./legal-content.js";

/** First drafts, loaded for review the first time a policy has no versions at all. */
const seeds: Record<string, { content: string; summary: string }> = {
  terms: { content: termsSeedContent, summary: termsSeedSummary },
  privacy: { content: privacySeedContent, summary: privacySeedSummary },
};

const SYSTEM_ACTOR = "system";

/** Makes sure every catalog policy exists; seeds the first drafts (Terms, Privacy) once. */
export async function ensureLegalPolicies() {
  for (const entry of legalPolicyCatalog) {
    const policy = await prisma.legalPolicy.upsert({
      where: { slug: entry.slug },
      update: {},
      create: { slug: entry.slug, title: entry.title, summary: entry.summary, sortOrder: entry.sortOrder, requiredAtSignup: entry.requiredAtSignup },
    });
    const seed = seeds[entry.slug];
    if (seed) {
      const count = await prisma.legalPolicyVersion.count({ where: { policyId: policy.id } });
      if (count === 0) {
        const version = await prisma.legalPolicyVersion.create({
          data: { policyId: policy.id, version: 1, status: "IN_REVIEW", content: seed.content, changeSummary: seed.summary, createdById: SYSTEM_ACTOR, consentText: defaultConsentText(policy.title, 1) },
        });
        await logLegal(SYSTEM_ACTOR, "version.create", entry.slug, version.id, 1, { note: "Initial draft loaded for review" });
      }
    }
  }
}

export async function logLegal(actorId: string, action: string, policySlug: string, versionId: string | null, version: number | null, details?: Record<string, unknown>) {
  await prisma.legalAuditEntry
    .create({ data: { actorId, action, policySlug, versionId, version, details: details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined } })
    .catch((error) => console.warn("[legal] audit write failed", error instanceof Error ? error.message : error));
}

/** The published version of each policy that must be accepted at sign-up. */
export async function currentRequiredPolicies(): Promise<CurrentRequired[]> {
  const policies = await prisma.legalPolicy.findMany({
    where: { requiredAtSignup: true },
    orderBy: { sortOrder: "asc" },
    include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 } },
  });
  return policies
    .filter((policy) => policy.versions.length)
    .map((policy) => {
      const current = policy.versions[0];
      return {
        policyId: policy.id,
        slug: policy.slug,
        title: policy.title,
        versionId: current.id,
        version: current.version,
        requiresConsent: current.requiresConsent,
        consentText: current.consentText ?? defaultConsentText(policy.title, current.version),
      };
    });
}

export async function pendingConsentsFor(userId: string) {
  const [current, accepted] = await Promise.all([
    currentRequiredPolicies(),
    prisma.policyAcceptance.findMany({ where: { userId }, select: { policyVersionId: true, policySlug: true } }),
  ]);
  return pendingConsents(current, accepted);
}

/**
 * Records acceptance of exact versions. The wording and version are copied onto the row so
 * the record stands on its own even if the policy is later changed. Idempotent per version.
 */
export async function recordAcceptances(userId: string, versionIds: string[], source: "SIGNUP" | "RENEWAL", client: Prisma.TransactionClient = prisma) {
  const versions = await client.legalPolicyVersion.findMany({
    where: { id: { in: versionIds }, status: "PUBLISHED" },
    include: { policy: { select: { slug: true, title: true } } },
  });
  for (const version of versions) {
    await client.policyAcceptance.upsert({
      where: { userId_policyVersionId: { userId, policyVersionId: version.id } },
      update: {},
      create: {
        userId,
        policyVersionId: version.id,
        policySlug: version.policy.slug,
        version: version.version,
        consentText: version.consentText ?? defaultConsentText(version.policy.title, version.version),
        source,
      },
    });
  }
  return versions.map((version) => version.id);
}
