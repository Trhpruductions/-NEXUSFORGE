/**
 * Rules for legal documents, kept free of I/O so they can be unit tested.
 *
 * Version lifecycle: DRAFT -> IN_REVIEW -> PUBLISHED -> ARCHIVED.
 * - Only drafts can be edited. Published and archived text is never changed.
 * - Publishing needs a review step first, and no "[placeholder]" may be left in the text.
 * - Publishing a version archives the one it replaces (one published version per policy).
 * - "Restore" never revives an old row: it copies its text into a brand-new draft.
 */

export type VersionStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type VersionAction = "edit" | "submit" | "return" | "publish" | "archive" | "restore";

const allowed: Record<VersionAction, VersionStatus[]> = {
  edit: ["DRAFT"],
  submit: ["DRAFT"],
  return: ["IN_REVIEW"],
  publish: ["IN_REVIEW"],
  // Discard a draft, or withdraw the published version.
  archive: ["DRAFT", "IN_REVIEW", "PUBLISHED"],
  restore: ["PUBLISHED", "ARCHIVED"],
};

export function canApply(action: VersionAction, status: string): boolean {
  return (allowed[action] as string[]).includes(status);
}

export function nextStatus(action: VersionAction): VersionStatus | null {
  switch (action) {
    case "submit":
      return "IN_REVIEW";
    case "return":
      return "DRAFT";
    case "publish":
      return "PUBLISHED";
    case "archive":
      return "ARCHIVED";
    default:
      return null;
  }
}

/** Bracketed fill-ins such as "[Legal Operator Name]" or "[Official Support Email]". */
export function findPlaceholders(content: string): string[] {
  const found = new Set<string>();
  // Text placeholders ("[Launch Date]") and number placeholders ("[30]") alike.
  for (const match of content.matchAll(/\[([A-Z0-9][^\]\n]{0,160})\]/g)) {
    // Markdown links look like [text](url); those aren't placeholders.
    const after = content.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 1);
    if (after === "(") continue;
    found.add(match[0]);
  }
  return [...found];
}

export function defaultConsentText(title: string, version: number) {
  return `I have read and agree to the Vexora Gaming ${title} (version ${version}).`;
}

export type CurrentRequired = { policyId: string; slug: string; title: string; versionId: string; version: number; requiresConsent: boolean; consentText: string };
export type PastAcceptance = { policyVersionId: string; policySlug: string };

/**
 * Which required policies this user still has to accept.
 * - Never accepted any version of a required policy: they must accept the current one.
 * - Accepted an older version: only if the current version was marked as needing renewed
 *   consent (a material change). Minor updates don't interrupt anyone.
 */
export function pendingConsents(current: CurrentRequired[], accepted: PastAcceptance[]): CurrentRequired[] {
  const acceptedIds = new Set(accepted.map((entry) => entry.policyVersionId));
  const acceptedSlugs = new Set(accepted.map((entry) => entry.policySlug));
  return current.filter((policy) => {
    if (acceptedIds.has(policy.versionId)) return false;
    if (!acceptedSlugs.has(policy.slug)) return true;
    return policy.requiresConsent;
  });
}

/** At sign-up every required, published policy must be explicitly accepted, by exact version. */
export function missingSignupAcceptances(required: Array<{ versionId: string; slug: string }>, acceptedVersionIds: string[]) {
  const given = new Set(acceptedVersionIds);
  return required.filter((policy) => !given.has(policy.versionId)).map((policy) => policy.slug);
}

export function canManageLegal(user: { isAdmin: boolean; appRole: string | null | undefined }) {
  return user.isAdmin || ["ADMIN", "EXEC", "OWNER"].includes(user.appRole ?? "");
}

/** Publishing is the step with legal effect, so only the top roles can do it. */
export function canPublishLegal(user: { isAdmin: boolean; appRole: string | null | undefined }) {
  return ["EXEC", "OWNER"].includes(user.appRole ?? "") || (user.isAdmin && user.appRole !== "MODERATOR");
}
