import type { User } from "@/lib/api";

export type PremiumTierLogoKey = "CORE" | "PLUS" | "ELITE" | "INFINITE";
export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export type BrandBadge = {
  key: string;
  label: string;
  src: string;
  rarity: BadgeRarity;
  description: string;
};

export const premiumTierLogos: Record<PremiumTierLogoKey, BrandBadge> = {
  CORE: {
    key: "core",
    label: "Starter Core",
    src: "/brand/tier-starter-core.png",
    rarity: "common",
    description: "Entry Core+ tier with foundational perks.",
  },
  PLUS: {
    key: "plus",
    label: "Plus Command",
    src: "/brand/tier-plus-command.png",
    rarity: "rare",
    description: "Enhanced operations tier for active users.",
  },
  ELITE: {
    key: "elite",
    label: "Elite Creator",
    src: "/brand/tier-elite-creator.png",
    rarity: "epic",
    description: "Creator-focused premium tier with advanced benefits.",
  },
  INFINITE: {
    key: "infinite",
    label: "Infinite League",
    src: "/brand/tier-infinite-league.png",
    rarity: "legendary",
    description: "Highest Core+ tier with full platform priority.",
  },
};

export const profileRoleBadges = {
  FOUNDER: {
    key: "founder",
    label: "Founder",
    src: "/brand/profile-badge-founder.png",
    rarity: "legendary",
    description: "Early architect and foundational supporter.",
  },
  OWNER: {
    key: "owner",
    label: "Owner",
    src: "/brand/profile-badge-owner.png",
    rarity: "legendary",
    description: "Owns and governs top-level platform operations.",
  },
  ADMIN: {
    key: "admin",
    label: "Admin",
    src: "/brand/profile-badge-admin.png",
    rarity: "epic",
    description: "Authorized administrator with elevated control.",
  },
  MODERATOR: {
    key: "moderator",
    label: "Moderator",
    src: "/brand/profile-badge-moderator.png",
    rarity: "rare",
    description: "Community safety and moderation authority.",
  },
  DEVELOPER: {
    key: "developer",
    label: "Developer",
    src: "/brand/profile-badge-developer.png",
    rarity: "epic",
    description: "Core builder of NexusForge systems.",
  },
  VIP: {
    key: "vip",
    label: "VIP",
    src: "/brand/profile-badge-vip.png",
    rarity: "rare",
    description: "Premium recognized member tier.",
  },
  STAFF: {
    key: "staff",
    label: "Staff",
    src: "/brand/profile-badge-staff.png",
    rarity: "rare",
    description: "Trusted staff member supporting operations.",
  },
  LEGEND: {
    key: "legend",
    label: "Legend",
    src: "/brand/profile-badge-legend.png",
    rarity: "legendary",
    description: "Elite status from top-tier progression.",
  },
} as const;

export const badgeKeyMap = {
  core: premiumTierLogos.CORE,
  plus: premiumTierLogos.PLUS,
  elite: premiumTierLogos.ELITE,
  infinite: premiumTierLogos.INFINITE,
  founder: profileRoleBadges.FOUNDER,
  owner: profileRoleBadges.OWNER,
  admin: profileRoleBadges.ADMIN,
  moderator: profileRoleBadges.MODERATOR,
  developer: profileRoleBadges.DEVELOPER,
  vip: profileRoleBadges.VIP,
  staff: profileRoleBadges.STAFF,
  legend: profileRoleBadges.LEGEND,
} as const;

export type BadgeKey = keyof typeof badgeKeyMap;

export function resolveBadgeByKey(key: string): BrandBadge | null {
  return badgeKeyMap[key as BadgeKey] ?? null;
}

export function getTierLogoBadge(tier?: User["premiumTier"]): BrandBadge | null {
  if (!tier || tier === "NONE") {
    return null;
  }

  return premiumTierLogos[tier as PremiumTierLogoKey] ?? null;
}

export function getRoleBadge(user: Pick<User, "appRole" | "isAdmin">): BrandBadge | null {
  if (user.appRole === "OWNER") {
    return profileRoleBadges.OWNER;
  }

  if (user.appRole === "ADMIN" || user.isAdmin) {
    return profileRoleBadges.ADMIN;
  }

  if (user.appRole === "MODERATOR") {
    return profileRoleBadges.MODERATOR;
  }

  if (user.appRole === "EXEC") {
    return profileRoleBadges.DEVELOPER;
  }

  return null;
}

export function getProfileBadgesForUser(user: Pick<User, "premiumTier" | "appRole" | "isAdmin" | "corePlusBoostLevel">): BrandBadge[] {
  const badges: BrandBadge[] = [];
  const seen = new Set<string>();

  const addBadge = (badge: BrandBadge | null) => {
    if (!badge) {
      return;
    }

    if (seen.has(badge.key)) {
      return;
    }

    seen.add(badge.key);
    badges.push(badge);
  };

  // Priority order: role authority -> staff status -> VIP -> tier -> founder -> legend.
  const roleBadge = getRoleBadge(user);
  addBadge(roleBadge);

  if (user.appRole && user.appRole !== "USER") {
    addBadge(profileRoleBadges.STAFF);
  }

  if (user.premiumTier && user.premiumTier !== "NONE") {
    addBadge(profileRoleBadges.VIP);
  }

  const tierBadge = getTierLogoBadge(user.premiumTier);
  addBadge(tierBadge);

  // Infinite tier doubles as a founder-class visual in profile surfaces.
  if (user.premiumTier === "INFINITE") {
    addBadge(profileRoleBadges.FOUNDER);
  }

  if (user.premiumTier === "INFINITE" || (user.corePlusBoostLevel ?? 0) >= 25) {
    addBadge(profileRoleBadges.LEGEND);
  }

  return badges;
}
