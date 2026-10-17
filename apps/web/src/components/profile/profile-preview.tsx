"use client";

import { CoverArt } from "@/components/ui/cover-art";
import { safeHref } from "@/lib/safe-href";

/** How the profile will look to other people, updated as the form changes. */
export function ProfilePreview({
  seed,
  displayName,
  username,
  bio,
  avatarUrl,
  bannerUrl,
  links,
}: {
  seed: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  links: Array<{ key: string; label: string; value: string }>;
}) {
  const name = displayName.trim() || username;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
  const visibleLinks = links.filter((link) => link.value.trim());

  return (
    <section aria-label="Profile preview" className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119]">
      <div className="relative h-32 sm:h-40">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <CoverArt seed={seed} variant="rings" className="absolute inset-0 h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1119] via-transparent to-transparent" />
      </div>

      <div className="px-4 pb-4 sm:px-5">
        <div className="-mt-10 flex items-end gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#0d1119] bg-slate-800 text-lg font-bold text-slate-200">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="truncate text-lg font-bold text-white">{name}</p>
            <p className="truncate text-sm text-slate-400">@{username || "username"}</p>
          </div>
        </div>

        {bio.trim() ? <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-300">{bio}</p> : null}

        {visibleLinks.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {visibleLinks.map((link) => {
              const href = safeHref(link.value);
              const text = <><span className="uppercase text-slate-500">{link.label}</span> <span className="break-all">{link.value}</span></>;
              return (
                <li key={link.key} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-200">
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-amber-200">{text}</a> : text}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
