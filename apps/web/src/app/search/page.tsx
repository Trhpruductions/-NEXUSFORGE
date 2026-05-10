"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { searchProfiles, User } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
    if (!currentUser || !accessToken) {
      router.push("/login");
      return;
    }
  }, [currentUser, accessToken, router]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || !accessToken) return;

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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Search Users</h1>

        {/* Search Input */}
        <div className="mb-8">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by username or clan tag..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center text-slate-400">Searching...</div>
        )}

        {!loading && searchQuery && results.length === 0 && (
          <div className="text-center text-slate-400">No users found</div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="mb-4 text-sm text-slate-400">
              Found {total} user{total !== 1 ? "s" : ""}
            </div>

            <div className="space-y-3">
              {results.map((user) => (
                <Link
                  key={user.id}
                  href={`/profiles/${user.id}`}
                  className="block bg-slate-900 p-4 rounded hover:bg-slate-800 transition border border-slate-800 hover:border-cyan-600"
                >
                  <div className="flex items-center gap-4">
                    {user.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={user.username}
                        width={48}
                        height={48}
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="font-bold text-cyan-400">{user.username[0]}</span>
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{user.username}</span>
                        {user.clanTag && <span className="text-cyan-400">[{user.clanTag}]</span>}
                        {user.premium && (
                          <span className="text-xs bg-amber-900 text-amber-300 px-2 py-1 rounded">
                            {user.premiumTier}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Reputation: <span className="text-cyan-400">{user.reputation}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-500">View Profile →</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && !searchQuery && (
          <div className="text-center text-slate-400">
            Start typing to search for users
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-slate-400">Loading...</div></div>}>
      <SearchContent />
    </Suspense>
  );
}
