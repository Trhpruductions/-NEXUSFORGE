"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { PictureCropDialog, validatePictureFile } from "@/components/profile/profile-picture-crop";
import { getApiErrorMessage } from "@/lib/api";
import { removeForgeImage, uploadForgeImage, type ForgeImageKind } from "@/lib/forge-images-api";
import type { ProfileEditorData } from "@/lib/profile-api";

// The same limits the server enforces for profile pictures (lib/image-validation.ts). Server icons use the
// square avatar rules and server banners use the banner rules.
const pictureLimits: ProfileEditorData["limits"]["pictures"] = {
  avatar: { maxBytes: 2 * 1024 * 1024, minSide: 32, maxSide: 1024 },
  banner: { maxBytes: 6 * 1024 * 1024, minWidth: 320, maxWidth: 2560, minHeight: 96, maxHeight: 1440 },
  maxPixels: 16_000_000,
  types: ["image/png", "image/jpeg", "image/webp"],
};

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Upload, replace and remove for a server's icon or banner. A picked file is checked, cropped in the
 * same dialog profile pictures use, and only then sent. The old picture stays until the new one is saved.
 */
export function ForgeImageField({
  forgeId,
  kind,
  value,
  editable,
  accessToken,
  csrfToken,
  onChanged,
}: {
  forgeId: string;
  kind: ForgeImageKind;
  value: string | null;
  editable: boolean;
  accessToken: string;
  csrfToken: string;
  onChanged: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isIcon = kind === "icon";

  async function handlePicked(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    setError(null);
    const problem = await validatePictureFile(picked, pictureLimits);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(picked);
  }

  async function handleCropped(blob: Blob) {
    setPending(null);
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      await uploadForgeImage(accessToken, csrfToken, forgeId, kind, blob, setProgress);
      await onChanged();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeForgeImage(accessToken, csrfToken, forgeId, kind);
      await onChanged();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{isIcon ? "Server icon" : "Server banner"}</p>
      {isIcon ? (
        <div className="flex items-center gap-3">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-16 w-16 rounded-full border border-slate-700 object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-600 text-[10px] text-slate-500">No icon</div>
          )}
        </div>
      ) : value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="aspect-[3/1] w-full rounded-[14px] border border-slate-700 object-cover" />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center rounded-[14px] border border-dashed border-slate-600 text-xs text-slate-500">No banner</div>
      )}
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? `Uploading ${Math.round(progress * 100)}%` : value ? "Replace" : "Upload"}
          </button>
          {value ? (
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void handleRemove()}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : null}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handlePicked(event)} />
        </div>
      ) : null}
      <p className="text-[11px] text-slate-500">
        {isIcon ? "A square PNG, JPEG or WebP. You can crop it before it's saved." : "A PNG, JPEG or WebP at least 320 × 96 pixels. You can crop it before it's saved."}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      {pending ? (
        <PictureCropDialog kind={isIcon ? "avatar" : "banner"} file={pending} limits={pictureLimits} onCancel={() => setPending(null)} onReady={(blob) => void handleCropped(blob)} />
      ) : null}
    </div>
  );
}
