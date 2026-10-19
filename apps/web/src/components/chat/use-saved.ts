"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSavedIds, setSaved, type SavedKind } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

/** Which messages you've saved, and a toggle. Shared by every message list. */
export function useSavedMessages() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryScope = useQueryScope();
  const queryClient = useQueryClient();
  const key = ["saved-ids", queryScope];
  const ids = useQuery({ queryKey: key, queryFn: () => listSavedIds(accessToken!), enabled: Boolean(accessToken), staleTime: 60_000 });

  const toggle = useMutation({
    mutationFn: (input: { kind: SavedKind; messageId: string; saved: boolean }) => setSaved(accessToken!, csrfToken!, input.kind, input.messageId, input.saved),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ channel: string[]; dm: string[] }>(key);
      const field = input.kind === "CHANNEL" ? "channel" : "dm";
      queryClient.setQueryData<{ channel: string[]; dm: string[] }>(key, (current) => {
        const base = current ?? { channel: [], dm: [] };
        const list = base[field].filter((id) => id !== input.messageId);
        return { ...base, [field]: input.saved ? [...list, input.messageId] : list };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-list"] });
    },
  });

  const channel = new Set(ids.data?.channel ?? []);
  const dm = new Set(ids.data?.dm ?? []);
  return {
    isSaved: (kind: SavedKind, messageId: string) => (kind === "CHANNEL" ? channel : dm).has(messageId),
    setSaved: (kind: SavedKind, messageId: string, saved: boolean) => toggle.mutate({ kind, messageId, saved }),
  };
}
