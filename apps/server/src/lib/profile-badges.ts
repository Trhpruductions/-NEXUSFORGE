import { prisma } from "./prisma.js";

/** Badges an admin can give from the dashboard. Each is stored as a medal keyed "badge-<key>". */
const GRANTABLE_BADGES = new Set([
  "vip",
  "investor",
  "staff",
  "legend",
  "founder",
  "developer",
  "moderator",
  "admin",
  "owner",
  "beta-user",
  "member",
  "verified-member",
  "rep",
]);

const BADGE_MEDAL_PREFIX = "badge-";

/**
 * The app's own badges, which every account shows: Beta User while the app is in open beta, and a member rank
 * (Member, or Verified Member once the account's email is verified). Badges an admin has given come first.
 */
export function profileBadgeKeys(user: { emailVerified: boolean; medalKeys: string[] }): string[] {
  const keys: string[] = [];
  const add = (key: string) => {
    if (!keys.includes(key)) keys.push(key);
  };
  for (const medalKey of user.medalKeys) {
    if (!medalKey.startsWith(BADGE_MEDAL_PREFIX)) continue;
    const key = medalKey.slice(BADGE_MEDAL_PREFIX.length);
    if (GRANTABLE_BADGES.has(key)) add(key);
  }
  add("beta-user");
  if (user.emailVerified || keys.includes("verified-member")) {
    add("verified-member");
  } else {
    add("member");
  }
  // A verified account doesn't also show the plain Member rank, even if it was given by hand.
  return keys.includes("verified-member") ? keys.filter((key) => key !== "member") : keys;
}

/** Select for the fields profileBadgeKeys needs. */
export const profileBadgeSelect = {
  emailVerified: true,
  medals: { where: { medal: { key: { startsWith: BADGE_MEDAL_PREFIX } } }, select: { medal: { select: { key: true } } } },
} as const;

export function badgeKeysFromRow(row: { emailVerified: boolean; medals: Array<{ medal: { key: string } }> }) {
  return profileBadgeKeys({ emailVerified: row.emailVerified, medalKeys: row.medals.map((entry) => entry.medal.key) });
}

/** Adds a `badges` list to each user in a list (leaderboards), with one extra query. */
export async function attachProfileBadges<T extends { id: string }>(users: T[]): Promise<Array<T & { badges: string[] }>> {
  if (!users.length) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: users.map((user) => user.id) } },
    select: { id: true, ...profileBadgeSelect },
  });
  const byId = new Map<string, string[]>(rows.map((row) => [row.id, badgeKeysFromRow(row)]));
  return users.map((user) => ({ ...user, badges: byId.get(user.id) ?? profileBadgeKeys({ emailVerified: false, medalKeys: [] }) }));
}
