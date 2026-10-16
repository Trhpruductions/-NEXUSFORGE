"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { getApiErrorMessage, updateAvatarPreset, type AvatarPreset } from "@/lib/api";
import { designOfLook, duplicateLook, equipLook, loadLooks, removeLook, retiredPartsOf } from "@/lib/avatar-api";
import type { AvatarDesign } from "@/components/avatar3d/design";
import { useAuthStore } from "@/store/auth-store";

const button = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-40";

/** A simple colour preview of a saved look until its rendered portrait exists. */
function Swatches({ design }: { design: AvatarDesign }) {
  const items = [
    { label: "Skin", colour: design.skin },
    { label: "Hair", colour: design.hairColor },
    { label: "Top", colour: design.topColor },
    { label: "Bottoms", colour: design.bottomColor },
    { label: "Shoes", colour: design.shoeColor },
  ];
  return (
    <div className="flex h-36 items-end justify-center gap-2 bg-[radial-gradient(circle_at_50%_30%,rgba(46,164,255,0.18),transparent_65%)] p-4" aria-hidden="true">
      {items.map((item) => (
        <span key={item.label} title={item.label} className="h-16 w-6 rounded-md border border-white/10" style={{ backgroundColor: item.colour }} />
      ))}
    </div>
  );
}

function AvatarCard({ preset, isMain, onChanged, onError, onNotice }: { preset: AvatarPreset; isMain: boolean; onChanged: () => void; onError: (text: string) => void; onNotice: (text: string) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(preset.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const design = designOfLook(preset);
  const retired = retiredPartsOf(preset);

  const rename = useMutation({
    mutationFn: () => updateAvatarPreset(accessToken!, csrfToken!, preset.id, { name: name.trim() || preset.name }),
    onSuccess: () => {
      setRenaming(false);
      onChanged();
    },
    onError: (error) => onError(getApiErrorMessage(error)),
  });
  const togglePublic = useMutation({
    mutationFn: () => updateAvatarPreset(accessToken!, csrfToken!, preset.id, { isPublic: !preset.isPublic }),
    onSuccess: onChanged,
    onError: (error) => onError(getApiErrorMessage(error)),
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateLook(accessToken!, csrfToken!, preset.id),
    onSuccess: onChanged,
    onError: (error) => onError(getApiErrorMessage(error)),
  });
  const makeMain = useMutation({
    mutationFn: () => equipLook(accessToken!, csrfToken!, preset.id),
    onSuccess: (result) => {
      onNotice(result.fallbacks.length ? `${preset.name} is now your profile avatar. Some parts show their defaults: ${result.fallbacks.map((f) => f.field).join(", ")}.` : `${preset.name} is now your profile avatar.`);
      onChanged();
    },
    onError: (error) => onError(getApiErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => removeLook(accessToken!, csrfToken!, preset.id),
    onSuccess: onChanged,
    onError: (error) => onError(getApiErrorMessage(error)),
  });

  return (
    <article className="vx-panel flex flex-col overflow-hidden rounded-2xl" aria-label={`Saved avatar ${preset.name}`}>
      {preset.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preset.previewUrl} alt={`Portrait of ${preset.name}`} loading="lazy" className="h-36 w-full bg-[radial-gradient(circle_at_50%_30%,rgba(46,164,255,0.18),transparent_65%)] object-contain" />
      ) : (
        <Swatches design={design} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {renaming ? (
            <form className="flex flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); rename.mutate(); }}>
              <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} aria-label="Avatar name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11151e] px-2 py-1.5 text-sm text-white outline-none focus:border-amber-400/60" />
              <button type="submit" disabled={rename.isPending} className={button} aria-label="Save name"><Check className="h-3.5 w-3.5" /></button>
            </form>
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{preset.name}</h2>
          )}
          {isMain ? <span className="rounded-md border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200">Main</span> : null}
          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${preset.isPublic ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-slate-400"}`}>
            {preset.isPublic ? "Public" : "Private"}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Saved {new Date(preset.createdAt).toLocaleDateString()}</p>
        {retired.length ? <p role="note" className="text-[11px] text-amber-200">Some parts no longer exist and show their defaults: {retired.join(", ")}.</p> : null}

        <div className="mt-auto flex flex-wrap gap-2">
          <Link href={`/app/avatars/${preset.id}`} className={button}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
          <button type="button" className={button} onClick={() => setRenaming((value) => !value)}>Rename</button>
          <button type="button" className={button} onClick={() => duplicate.mutate()} disabled={duplicate.isPending}><Copy className="h-3.5 w-3.5" /> Duplicate</button>
          <button type="button" className={button} onClick={() => makeMain.mutate()} disabled={isMain || makeMain.isPending}><Star className="h-3.5 w-3.5" /> {isMain ? "Main" : "Set as main"}</button>
          <button type="button" className={button} onClick={() => togglePublic.mutate()} disabled={togglePublic.isPending} aria-pressed={preset.isPublic}>
            {preset.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {preset.isPublic ? "Make private" : "Make public"}
          </button>
          {confirmDelete ? (
            <button type="button" className={`${button} border-rose-400/50 text-rose-200`} onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Confirm delete
            </button>
          ) : (
            <button type="button" className={button} onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AvatarGallery() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const query = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => loadLooks(accessToken!),
    enabled: Boolean(accessToken),
  });

  // Refreshing keeps the notice, so a message shown by an action survives the list reload.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["avatar"] });
  };

  if (!accessToken || query.isLoading) {
    return <p className="py-16 text-center text-xs uppercase tracking-[0.2em] text-slate-400">Loading your avatars…</p>;
  }
  if (query.isError) {
    return <p role="alert" className="py-16 text-center text-sm text-rose-200">Your avatars could not be loaded. {getApiErrorMessage(query.error)}</p>;
  }

  const presets = query.data?.presets ?? [];
  const max = query.data?.maxPresets ?? 10;
  const mainId = query.data?.mainPresetId ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{presets.length} of {max} saved. Private avatars are only visible to you.</p>
        <Link href="/app/avatars/new" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">
          <Plus className="h-3.5 w-3.5" /> New avatar
        </Link>
      </div>
      {notice ? (
        <p role="status" className={`rounded-xl border px-3 py-2 text-xs ${notice.tone === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}>{notice.text}</p>
      ) : null}
      {presets.length === 0 ? (
        <div className="vx-panel rounded-2xl p-8 text-center">
          <p className="text-sm text-white">No saved avatars yet.</p>
          <p className="mt-1 text-xs text-slate-400">Build a character, then press Save avatar. It will appear here.</p>
          <Link href="/app/avatars/new" className="mt-4 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950">Build an avatar</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => (
            <AvatarCard
              key={preset.id}
              preset={preset}
              isMain={mainId === preset.id}
              onChanged={refresh}
              onError={(text) => setNotice({ tone: "error", text })}
              onNotice={(text) => setNotice({ tone: "ok", text })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
