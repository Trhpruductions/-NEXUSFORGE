"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { ownerGet } from "@/lib/owner-api";

type Params = Record<string, string | number | undefined>;

/**
 * Reads one owner endpoint. Only runs for an OWNER session. Keeps the last good data on error, so
 * callers can show it with a stale warning instead of silently presenting old numbers as live.
 */
export function useOwnerQuery<T>(path: string, options: { params?: Params; refetchMs?: number | false; enabled?: boolean } = {}) {
  const { accessToken, user } = useAuthStore();
  const isOwner = user?.appRole === "OWNER";
  const paramsKey = JSON.stringify(options.params ?? {});

  return useQuery<T>({
    queryKey: ["owner", path, paramsKey, accessToken],
    queryFn: () => ownerGet<T>(accessToken!, path, options.params),
    enabled: Boolean(accessToken && isOwner) && (options.enabled ?? true),
    refetchInterval: options.refetchMs ?? 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
