"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { addForgeEmoji, createUploadPresign, deleteForgeEmoji, getApiErrorMessage, listForgeEmojis, type ForgeDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const MAX_BYTES = 256 * 1024;

/** Forge settings > Emoji: upload this forge's own emoji, used as :name:. */
export function EmojiTab({ forge, setNotice }: { forge: ForgeDetail; setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const key = ["forge-emojis", forge.id, accessToken];
  const emojisQuery = useQuery({ queryKey: key, queryFn: () => listForgeEmojis(accessToken!, forge.id), enabled: Boolean(accessToken) });
  const emojis = emojisQuery.data?.emojis ?? [];
  const max = emojisQuery.data?.max ?? 50;

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    if (!/^image\/(png|gif|webp|jpeg)$/.test(picked.type)) {
      setNotice({ tone: "error", text: "Use a PNG, GIF, WebP or JPEG image." });
      return;
    }
    if (picked.size > MAX_BYTES) {
      setNotice({ tone: "error", text: "Emoji images must be 256 KB or smaller." });
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setName(picked.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30));
    setNotice(null);
  };

  const add = useMutation({
    mutationFn: async () => {
      const presign = await createUploadPresign(accessToken!, csrfToken!, { filename: file!.name, contentType: file!.type, size: file!.size });
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file!.type }, body: file });
      if (!put.ok) throw new Error("Upload failed");
      return addForgeEmoji(accessToken!, csrfToken!, forge.id, { name, imageUrl: presign.fileUrl });
    },
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `:${result.emoji.name}: added.` });
      setFile(null);
      setPreview(null);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["forge-emojis", forge.id] });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const remove = useMutation({
    mutationFn: (emojiId: string) => deleteForgeEmoji(accessToken!, csrfToken!, forge.id, emojiId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forge-emojis", forge.id] }),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const nameValid = /^[a-z0-9_]{2,30}$/.test(name);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <p className="text-xs text-slate-300">
          Upload images members can use in messages and reactions by typing <code className="rounded bg-black/40 px-1 text-amber-100">:name:</code>. PNG, GIF, WebP or JPEG, up to 256 KB. {emojis.length}/{max} used.
        </p>
        <input ref={fileInput} type="file" accept="image/png,image/gif,image/webp,image/jpeg" className="hidden" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-12 w-12 rounded-lg bg-black/30 object-contain p-1" />
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={emojis.length >= max} className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-violet-400/40 text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-40" title="Choose an image">
              <ImagePlus className="h-5 w-5" />
            </button>
          )}
          {file ? (
            <>
              <label className="flex items-center gap-1 text-sm text-slate-300">
                :<input value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))} className="h-9 w-40 rounded-lg border border-white/10 bg-[#11151e] px-2 text-sm text-slate-100 outline-none focus:border-violet-400/60" aria-label="Emoji name" />:
              </label>
              <button type="button" disabled={!nameValid || add.isPending} onClick={() => add.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add emoji
              </button>
              <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="text-xs text-slate-400 hover:text-white">Cancel</button>
            </>
          ) : (
            <span className="text-xs text-slate-500">Choose an image to start.</span>
          )}
        </div>
        {file && !nameValid ? <p className="mt-1 text-[11px] text-amber-200">Names are 2-30 lowercase letters, numbers or underscores.</p> : null}
      </div>

      {emojisQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : emojis.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {emojis.map((emoji) => (
            <li key={emoji.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#11151e] px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emoji.imageUrl} alt="" className="h-7 w-7 object-contain" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">:{emoji.name}:</span>
              <button type="button" title={`Delete :${emoji.name}:`} onClick={() => remove.mutate(emoji.id)} disabled={remove.isPending} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No custom emoji yet.</p>
      )}
    </div>
  );
}
