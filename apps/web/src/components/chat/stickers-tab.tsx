"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { addForgeSticker, createUploadPresign, deleteForgeSticker, getApiErrorMessage, listForgeStickers, type ForgeDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const MAX_BYTES = 512 * 1024;

/** Forge settings > Stickers: larger images members send on their own from the sticker picker. */
export function StickersTab({ forge, setNotice }: { forge: ForgeDetail; setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const query = useQuery({ queryKey: ["forge-stickers", forge.id, accessToken], queryFn: () => listForgeStickers(accessToken!, forge.id), enabled: Boolean(accessToken) });
  const stickers = query.data?.stickers ?? [];
  const max = query.data?.max ?? 30;

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    if (!/^image\/(png|gif|webp|jpeg)$/.test(picked.type)) return setNotice({ tone: "error", text: "Use a PNG, GIF, WebP or JPEG image." });
    if (picked.size > MAX_BYTES) return setNotice({ tone: "error", text: "Sticker images must be 512 KB or smaller." });
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setName(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 30));
    setNotice(null);
  };

  const add = useMutation({
    mutationFn: async () => {
      const presign = await createUploadPresign(accessToken!, csrfToken!, { filename: file!.name, contentType: file!.type, size: file!.size });
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file!.type }, body: file });
      if (!put.ok) throw new Error("Upload failed");
      return addForgeSticker(accessToken!, csrfToken!, forge.id, { name: name.trim(), description: description.trim() || undefined, imageUrl: presign.fileUrl });
    },
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `Sticker "${result.sticker.name}" added.` });
      setFile(null);
      setPreview(null);
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["forge-stickers", forge.id] });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteForgeSticker(accessToken!, csrfToken!, forge.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forge-stickers", forge.id] }),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const nameValid = name.trim().length >= 2 && name.trim().length <= 30;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <p className="text-xs text-slate-300">Stickers are bigger images members send on their own from the sticker button in the message box. PNG, GIF, WebP or JPEG, up to 512 KB. {stickers.length}/{max} used.</p>
        <input ref={fileInput} type="file" accept="image/png,image/gif,image/webp,image/jpeg" className="hidden" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-20 w-20 rounded-lg bg-black/30 object-contain p-1" />
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={stickers.length >= max} className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-violet-400/40 text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-40" title="Choose an image" aria-label="Choose a sticker image">
              <ImagePlus className="h-6 w-6" />
            </button>
          )}
          {file ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input value={name} onChange={(event) => setName(event.target.value.slice(0, 30))} placeholder="Name" aria-label="Sticker name" className="h-9 w-40 rounded-lg border border-white/10 bg-[#11151e] px-2 text-sm text-slate-100 outline-none focus:border-violet-400/60" />
              <input value={description} onChange={(event) => setDescription(event.target.value.slice(0, 100))} placeholder="Description (optional)" aria-label="Sticker description" className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11151e] px-2 text-sm text-slate-100 outline-none focus:border-violet-400/60" />
              <button type="button" disabled={!nameValid || add.isPending} onClick={() => add.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add sticker
              </button>
              <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="text-xs text-slate-400 hover:text-white">Cancel</button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Choose an image to start.</span>
          )}
        </div>
      </div>
      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : stickers.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stickers.map((sticker) => (
            <li key={sticker.id} className="group relative rounded-lg border border-white/[0.07] bg-[#11151e] p-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sticker.imageUrl} alt={sticker.name} className="mx-auto h-20 w-20 object-contain" style={{ display: "block" }} />
              <p className="mt-1 truncate text-xs text-slate-200">{sticker.name}</p>
              <button type="button" title={`Delete ${sticker.name}`} aria-label={`Delete sticker ${sticker.name}`} onClick={() => remove.mutate(sticker.id)} disabled={remove.isPending} className="absolute right-1 top-1 rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No stickers yet.</p>
      )}
    </div>
  );
}
