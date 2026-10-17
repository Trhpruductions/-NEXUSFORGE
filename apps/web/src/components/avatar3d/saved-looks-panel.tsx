"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { getApiErrorMessage, type AvatarPreset } from "@/lib/api";
import { createLook, designOfLook, duplicateLook, equipLook, removeLook, renameLook, retiredPartsOf } from "@/lib/avatar-api";
import type { AvatarDesign } from "@/components/avatar3d/design";
import { chip } from "@/components/avatar3d/avatar-builder-parts";
import { useAuthStore } from "@/store/auth-store";

export type Notice = { tone: "ok" | "error"; text: string };

/** Saved looks for the builder: create from the current design, rename, duplicate, equip as main, delete. */
export function SavedLooksPanel({
  looks,
  maxLooks,
  mainId,
  draftName,
  draftDesign,
  onNotice,
}: {
  looks: AvatarPreset[];
  maxLooks: number;
  mainId: string | null;
  draftName: string;
  draftDesign: AvatarDesign;
  onNotice: (notice: Notice) => void;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["avatar"] });
  const fail = (error: unknown) => onNotice({ tone: "error", text: getApiErrorMessage(error) });

  const create = useMutation({
    mutationFn: () => createLook(accessToken!, csrfToken!, `${draftName.trim().slice(0, 32) || "My avatar"}`, draftDesign),
    onSuccess: async (preset) => {
      onNotice({ tone: "ok", text: `Saved look "${preset.name}" created.` });
      await refresh();
    },
    onError: fail,
  });

  const full = looks.length >= maxLooks;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {looks.length} of {maxLooks} saved looks. Private to you.
        </p>
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={!accessToken || !csrfToken || full || create.isPending}
          className={`${chip(false)} inline-flex items-center gap-1.5 disabled:opacity-40`}
        >
          <Plus className="h-3.5 w-3.5" /> Save current design as a new look
        </button>
      </div>
      {full ? <p className="text-[11px] text-amber-200">You have {maxLooks} looks. Delete one to save another.</p> : null}
      {looks.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#0d1119] p-4 text-xs text-slate-400">No saved looks yet. Build a design and save it here, or press Save as new.</p>
      ) : (
        <ul className="space-y-3">
          {looks.map((look) => (
            <LookRow key={look.id} look={look} isMain={mainId === look.id} onNotice={onNotice} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LookRow({ look, isMain, onNotice }: { look: AvatarPreset; isMain: boolean; onNotice: (notice: Notice) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(look.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const retired = retiredPartsOf(look);
  const design = designOfLook(look);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["avatar"] });
  const fail = (error: unknown) => onNotice({ tone: "error", text: getApiErrorMessage(error) });

  const rename = useMutation({
    mutationFn: () => renameLook(accessToken!, csrfToken!, look.id, name.trim() || look.name),
    onSuccess: async () => {
      setRenaming(false);
      await refresh();
    },
    onError: fail,
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateLook(accessToken!, csrfToken!, look.id),
    onSuccess: async (result) => {
      onNotice({ tone: "ok", text: `Copied as "${result.preset.name}".` });
      await refresh();
    },
    onError: fail,
  });
  const equip = useMutation({
    mutationFn: () => equipLook(accessToken!, csrfToken!, look.id),
    onSuccess: async (result) => {
      onNotice({
        tone: "ok",
        text: result.fallbacks.length ? `"${look.name}" is now your profile avatar. Some parts were replaced by their defaults: ${result.fallbacks.map((f) => f.field).join(", ")}.` : `"${look.name}" is now your profile avatar.`,
      });
      await refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => removeLook(accessToken!, csrfToken!, look.id),
    onSuccess: async () => {
      onNotice({ tone: "ok", text: `"${look.name}" was deleted.` });
      await refresh();
    },
    onError: fail,
  });

  const busy = rename.isPending || duplicate.isPending || equip.isPending || remove.isPending;
  const button = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-40";

  return (
    <li className="vx-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
      <span aria-hidden="true" className="flex h-12 w-8 items-end justify-center gap-0.5 rounded-md bg-[#0b1220] p-1">
        <span className="h-full w-1.5 rounded-sm" style={{ backgroundColor: design.hairColor }} />
        <span className="h-3/4 w-1.5 rounded-sm" style={{ backgroundColor: design.topColor }} />
        <span className="h-1/2 w-1.5 rounded-sm" style={{ backgroundColor: design.shoeColor }} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {renaming ? (
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); rename.mutate(); }}>
            <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} aria-label="Look name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11151e] px-2 py-1.5 text-sm text-white outline-none focus:border-amber-400/60" />
            <button type="submit" disabled={rename.isPending} className={button} aria-label="Save name"><Check className="h-3.5 w-3.5" /></button>
          </form>
        ) : (
          <p className="truncate text-sm font-semibold text-white">
            {look.name} {isMain ? <span className="ml-1 rounded-md border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200">Main</span> : null}
          </p>
        )}
        {retired.length ? (
          <p role="note" className="text-[11px] text-amber-200">Some parts no longer exist and show their defaults: {retired.join(", ")}. Save the look to keep the defaults.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/app/avatars/${look.id}`} className={button}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
        <button type="button" className={button} onClick={() => setRenaming((value) => !value)} disabled={busy}>Rename</button>
        <button type="button" className={button} onClick={() => duplicate.mutate()} disabled={busy}><Copy className="h-3.5 w-3.5" /> Duplicate</button>
        <button type="button" className={button} onClick={() => equip.mutate()} disabled={busy || isMain}><Star className="h-3.5 w-3.5" /> {isMain ? "Equipped" : "Equip"}</button>
        {confirmDelete ? (
          <button type="button" className={`${button} border-rose-400/50 text-rose-200`} onClick={() => remove.mutate()} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Confirm delete</button>
        ) : (
          <button type="button" className={button} onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        )}
      </div>
    </li>
  );
}
