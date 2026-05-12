import type { BrandBadge } from "@/lib/brand-badges";
import Image from "next/image";

type ProfileBadgeStripProps = {
  badges: BrandBadge[];
  maxItems?: number;
  containerClassName?: string;
  itemClassName?: string;
  imageClassName?: string;
  showLabel?: boolean;
  labelClassName?: string;
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function rarityClass(rarity: BrandBadge["rarity"]) {
  if (rarity === "legendary") {
    return "border-amber-400/70 shadow-[0_0_14px_rgba(251,191,36,0.25)]";
  }

  if (rarity === "epic") {
    return "border-fuchsia-400/65 shadow-[0_0_12px_rgba(232,121,249,0.22)]";
  }

  if (rarity === "rare") {
    return "border-cyan-400/65 shadow-[0_0_10px_rgba(34,211,238,0.2)]";
  }

  return "border-slate-700/80";
}

export function ProfileBadgeStrip({
  badges,
  maxItems = 3,
  containerClassName,
  itemClassName,
  imageClassName,
  showLabel = false,
  labelClassName,
}: ProfileBadgeStripProps) {
  if (!badges.length) {
    return null;
  }

  return (
    <div className={cx("flex flex-wrap gap-1", containerClassName)}>
      {badges.slice(0, maxItems).map((badge) => (
        <div
          key={badge.key}
          title={`${badge.label} (${badge.rarity.toUpperCase()}) - ${badge.description}`}
          className={cx(
            "overflow-hidden rounded-md border bg-slate-900/75",
            rarityClass(badge.rarity),
            itemClassName,
          )}
        >
          <Image
            src={badge.src}
            alt={`${badge.label} badge`}
            width={24}
            height={24}
            className={cx("h-6 w-6 object-cover", imageClassName)}
            onError={(event) => {
              event.currentTarget.src = "/brand/profile-badge-vip.png";
            }}
          />
          {showLabel ? <div className={cx("px-3 py-2 text-xs font-semibold text-slate-200", labelClassName)}>{badge.label}</div> : null}
        </div>
      ))}
    </div>
  );
}
