"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Music, Play, Trash2 } from "lucide-react";
import { addForgeSound, createUploadPresign, deleteForgeSound, getApiErrorMessage, listForgeSounds, type ForgeDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const MAX_BYTES = 512 * 1024;
const MAX_SECONDS = 5.2;

/** How long an audio file plays, read in the browser before uploading. */
function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file can't be played."));
    };
    audio.src = url;
  });
}

/** Forge settings > Soundboard: short clips anyone in a voice channel can play for the room. */
export function SoundsTab({ forge, setNotice }: { forge: ForgeDetail; setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [volume, setVolume] = useState(80);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const query = useQuery({ queryKey: ["forge-sounds", forge.id, accessToken], queryFn: () => listForgeSounds(accessToken!, forge.id), enabled: Boolean(accessToken) });
  const sounds = query.data?.sounds ?? [];
  const max = query.data?.max ?? 40;

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    if (!/^audio\/(mpeg|ogg|wav|x-wav)$/.test(picked.type)) return setNotice({ tone: "error", text: "Use an MP3, OGG or WAV file." });
    if (picked.size > MAX_BYTES) return setNotice({ tone: "error", text: "Sounds must be 512 KB or smaller." });
    try {
      const seconds = await audioDuration(picked);
      if (!Number.isFinite(seconds) || seconds > MAX_SECONDS) return setNotice({ tone: "error", text: "Sounds can be up to 5 seconds long." });
    } catch (error) {
      return setNotice({ tone: "error", text: error instanceof Error ? error.message : "That file can't be played." });
    }
    setFile(picked);
    setName(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 30));
    setNotice(null);
  };

  const add = useMutation({
    mutationFn: async () => {
      // Some systems label WAV files audio/x-wav; storage accepts audio/wav.
      const contentType = file!.type === "audio/x-wav" ? "audio/wav" : file!.type;
      const presign = await createUploadPresign(accessToken!, csrfToken!, { filename: file!.name, contentType, size: file!.size });
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) throw new Error("Upload failed");
      return addForgeSound(accessToken!, csrfToken!, forge.id, { name: name.trim(), emoji: emoji.trim() || undefined, soundUrl: presign.fileUrl, volume: volume / 100 });
    },
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `Sound "${result.sound.name}" added.` });
      setFile(null);
      setName("");
      setEmoji("");
      await queryClient.invalidateQueries({ queryKey: ["forge-sounds", forge.id] });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteForgeSound(accessToken!, csrfToken!, forge.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forge-sounds", forge.id] }),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const preview = (url: string, level: number) => {
    const audio = new Audio(url);
    audio.volume = level;
    void audio.play().catch(() => undefined);
  };
  const nameValid = name.trim().length >= 2 && name.trim().length <= 30;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <p className="text-xs text-slate-300">Sounds anyone in a voice channel can play for the whole room. MP3, OGG or WAV, up to 5 seconds and 512 KB. {sounds.length}/{max} used.</p>
        <input ref={fileInput} type="file" accept="audio/mpeg,audio/ogg,audio/wav" className="hidden" onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!file ? (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={sounds.length >= max} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-violet-400/40 px-3 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-40">
              <Music className="h-4 w-4" /> Choose a sound
            </button>
          ) : (
            <>
              <input value={emoji} onChange={(event) => setEmoji(event.target.value.slice(0, 8))} placeholder="🔊" aria-label="Emoji (optional)" className="h-9 w-12 rounded-lg border border-white/10 bg-[#11151e] text-center text-sm outline-none focus:border-violet-400/60" />
              <input value={name} onChange={(event) => setName(event.target.value.slice(0, 30))} placeholder="Name" aria-label="Sound name" className="h-9 w-40 rounded-lg border border-white/10 bg-[#11151e] px-2 text-sm text-slate-100 outline-none focus:border-violet-400/60" />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Volume
                <input type="range" min={10} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" className="accent-violet-400" />
              </label>
              <button type="button" onClick={() => preview(URL.createObjectURL(file), volume / 100)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:text-white" title="Preview" aria-label="Preview sound"><Play className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={!nameValid || add.isPending} onClick={() => add.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add sound
              </button>
              <button type="button" onClick={() => setFile(null)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
            </>
          )}
        </div>
      </div>
      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : sounds.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sounds.map((sound) => (
            <li key={sound.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#11151e] px-2 py-1.5">
              <button type="button" onClick={() => preview(sound.soundUrl, sound.volume)} className="rounded p-1 text-violet-200 hover:bg-violet-500/10" title="Preview" aria-label={`Preview ${sound.name}`}><Play className="h-3.5 w-3.5" /></button>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{sound.emoji ? `${sound.emoji} ` : ""}{sound.name}</span>
              <button type="button" title={`Delete ${sound.name}`} aria-label={`Delete sound ${sound.name}`} onClick={() => remove.mutate(sound.id)} disabled={remove.isPending} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No sounds yet.</p>
      )}
    </div>
  );
}
