"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { searchProfiles, User } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ExperienceShell } from "@/components/layout/experience-shell";

function SearchContent() {
  type SearchProfileUser = Pick<User, "id" | "username" | "avatar" | "premium" | "createdAt"> & {
    clanTag?: string | null;
    premiumTier: string;
    reputation: number;
  };

  const { user: currentUser, accessToken } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchProfileUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    if (!currentUser || !accessToken) {
      router.push("/login");
      return;
    }
  }, [currentUser, accessToken, router]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || !accessToken) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await searchProfiles(accessToken, searchQuery, 50, 0);
        setResults(data.users);
        setTotal(data.total);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, accessToken]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <ExperienceShell
      eyebrow="Discovery"
      title="Search Users"
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.197 5.197a7.5 7.5 0 0 0 10.606 10.606Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by username or clan tag..."
            className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/70 py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] transition focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-5 text-center text-sm text-slate-400">Searching...</div>
        ) : null}

        {/* Empty state */}
        {!loading && searchQuery && results.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-300">No results for &ldquo;{searchQuery}&rdquo;</p>
            <p className="mt-1 text-xs text-slate-500">Try a different username or clan tag</p>
          </div>
        ) : null}

        {/* Prompt */}
        {!loading && !searchQuery ? (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-8 text-center">
            <p className="text-sm text-slate-400">Start typing to discover players</p>
          </div>
        ) : null}

        {/* Results */}
        {!loading && results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{total} result{total !== 1 ? "s" : ""}</p>
            {results.map((user) => (
              <Link
                key={user.id}
                href={`/profiles/${user.id}`}
                className="nexus-list-row nexus-interactive-card"
              >
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.username}
                    width={44}
                    height={44}
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-base font-bold text-slate-300">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="nexus-list-main">
                  <p className="truncate text-sm font-semibold text-slate-100">{user.username}</p>
                  {user.clanTag ? <p className="truncate text-xs text-cyan-400">[{user.clanTag}]</p> : null}
                </div>
                <div className="nexus-list-end">
                  {user.premium ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{user.premiumTier}</span>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">{user.reputation} rep</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </ExperienceShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="nexus-shell flex items-center justify-center text-slate-400">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
