"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api";
import { designOfLook, loadLooks, retiredPartsOf } from "@/lib/avatar-api";
import { AvatarBuilder } from "@/components/avatar3d/avatar-builder";
import { useAuthStore } from "@/store/auth-store";

/** Opens a saved avatar for editing: loads its design from the account, then shows the builder. */
export function AvatarEditor({ presetId }: { presetId: string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const query = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => loadLooks(accessToken!),
    enabled: Boolean(accessToken),
  });

  if (!accessToken || query.isLoading) {
    return <p className="py-16 text-center text-xs uppercase tracking-[0.2em] text-slate-400">Loading avatar…</p>;
  }
  if (query.isError) {
    return <p role="alert" className="py-16 text-center text-sm text-rose-200">The avatar could not be loaded. {getApiErrorMessage(query.error)}</p>;
  }
  const preset = query.data?.presets.find((entry) => entry.id === presetId);
  if (!preset) {
    return (
      <div className="vx-panel mx-auto max-w-md rounded-2xl p-8 text-center">
        <p className="text-sm text-white">That avatar is not in your account.</p>
        <Link href="/app/avatars" className="mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200 hover:text-white">Back to your avatars</Link>
      </div>
    );
  }
  return <AvatarBuilder key={preset.id} presetId={preset.id} initialName={preset.name} initial={designOfLook(preset)} retiredParts={retiredPartsOf(preset)} />;
}
