"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2 } from "lucide-react";
import type { PictureKind, ProfileEditorData } from "@/lib/profile-api";

/**
 * Crop-and-position dialog for profile pictures. The crop is drawn to a canvas at the output size
 * and re-encoded here, which also drops any metadata the original file carried. The server checks
 * the bytes again, so this is for a fast, friendly first check only.
 */

const INPUT_MAX_BYTES = 25 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const OUTPUT: Record<PictureKind, { width: number; height: number; mime: "image/png" | "image/jpeg"; quality?: number }> = {
  avatar: { width: 512, height: 512, mime: "image/png" },
  banner: { width: 1500, height: 500, mime: "image/jpeg", quality: 0.92 },
};

const LABEL: Record<PictureKind, string> = { avatar: "avatar", banner: "banner" };

/** Checks a chosen file before it is opened: allowed type, a sane size, and the file's own leading bytes. */
export async function validatePictureFile(file: File, limits: ProfileEditorData["limits"]["pictures"]): Promise<string | null> {
  if (!limits.types.includes(file.type)) return "Pick a PNG, JPEG or WebP picture.";
  if (file.size > INPUT_MAX_BYTES) return "That file is larger than 25 MB. Pick a smaller picture.";
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...head.slice(start, end));
  const isPng = head[0] === 0x89 && ascii(1, 4) === "PNG";
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const matches = (file.type === "image/png" && isPng) || (file.type === "image/jpeg" && isJpeg) || (file.type === "image/webp" && isWebp);
  return matches ? null : "That file isn't a valid PNG, JPEG or WebP picture.";
}

/** Smallest picture the server accepts, as a message the user can act on. */
function tooSmallMessage(kind: PictureKind, image: HTMLImageElement, limits: ProfileEditorData["limits"]["pictures"]) {
  if (kind === "avatar") {
    const min = limits.avatar.minSide;
    if (Math.min(image.naturalWidth, image.naturalHeight) < min) return `This picture is too small. Use one at least ${min} px on each side.`;
    return null;
  }
  const { minWidth, minHeight } = limits.banner;
  if (image.naturalWidth < minWidth || image.naturalHeight < minHeight) {
    return `This picture is too small. Use one at least ${minWidth} px wide and ${minHeight} px tall.`;
  }
  return null;
}

type Frame = { width: number; height: number };
type View = { cx: number; cy: number; zoom: number };

function frameFor(kind: PictureKind): Frame {
  const available = typeof window === "undefined" ? 420 : Math.max(200, window.innerWidth - 96);
  if (kind === "avatar") {
    const side = Math.min(280, available);
    return { width: side, height: side };
  }
  const width = Math.min(420, available);
  return { width, height: Math.round(width / 3) };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Scale and crop centre for the current view, kept so the frame is always covered by the picture. */
function geometry(image: HTMLImageElement, frame: Frame, view: View) {
  const cover = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  const scale = cover * view.zoom;
  const halfW = frame.width / scale / 2;
  const halfH = frame.height / scale / 2;
  return {
    scale,
    cx: clamp(view.cx, halfW, image.naturalWidth - halfW),
    cy: clamp(view.cy, halfH, image.naturalHeight - halfH),
  };
}

function renderCrop(image: HTMLImageElement, kind: PictureKind, frame: Frame, view: View): Promise<Blob> {
  const g = geometry(image, frame, view);
  const out = OUTPUT[kind];
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Your browser can't prepare the picture."));
  if (out.mime === "image/jpeg") {
    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.imageSmoothingQuality = "high";
  const sourceWidth = frame.width / g.scale;
  const sourceHeight = frame.height / g.scale;
  ctx.drawImage(image, g.cx - sourceWidth / 2, g.cy - sourceHeight / 2, sourceWidth, sourceHeight, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the picture. Try again."))),
      out.mime,
      out.quality,
    );
  });
}

export function PictureCropDialog({
  kind,
  file,
  limits,
  onCancel,
  onReady,
}: {
  kind: PictureKind;
  file: File;
  limits: ProfileEditorData["limits"]["pictures"];
  onCancel: () => void;
  onReady: (blob: Blob) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ cx: 0, cy: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; scale: number } | null>(null);
  const frame = useMemo(() => frameFor(kind), [kind]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setView({ cx: img.naturalWidth / 2, cy: img.naturalHeight / 2, zoom: 1 });
    };
    img.onerror = () => {
      if (!cancelled) setLoadError("That picture couldn't be opened. Try another file.");
    };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const sizeProblem = image ? tooSmallMessage(kind, image, limits) : null;
  const geo = image ? geometry(image, frame, view) : null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image || !geo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, cx: geo.cx, cy: geo.cy, scale: geo.scale };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setView((current) => ({
      ...current,
      cx: start.cx - (event.clientX - start.x) / start.scale,
      cy: start.cy - (event.clientY - start.y) / start.scale,
    }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const useThis = async () => {
    if (!image || sizeProblem) return;
    setBusy(true);
    setError(null);
    try {
      onReady(await renderCrop(image, kind, frame, view));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't prepare the picture. Try again.");
      setBusy(false);
    }
  };

  const title = kind === "avatar" ? "Crop your avatar" : "Crop your banner";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="profile-crop-title" className="w-full max-w-lg rounded-2xl border border-amber-500/20 bg-[#0d1119] p-5 shadow-2xl">
        <h2 id="profile-crop-title" className="text-sm font-bold uppercase tracking-[0.16em] text-white">{title}</h2>
        <p className="mt-1 text-xs text-slate-400">Drag the picture to position it. Use the slider to zoom. The highlighted area is what gets saved.</p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative cursor-grab overflow-hidden rounded-xl bg-slate-950 ring-1 ring-amber-400/40 active:cursor-grabbing"
            style={{ width: frame.width, height: frame.height, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {image && geo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: image.naturalWidth * geo.scale,
                  height: image.naturalHeight * geo.scale,
                  left: frame.width / 2 - geo.cx * geo.scale,
                  top: frame.height / 2 - geo.cy * geo.scale,
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                {loadError ?? <Loader2 className="h-5 w-5 animate-spin" aria-label="Opening picture" />}
              </div>
            )}
          </div>
        </div>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            disabled={!image || busy}
            onChange={(event) => setView((current) => ({ ...current, zoom: Number(event.target.value) }))}
            className="mt-2 w-full accent-amber-400"
          />
        </label>

        {sizeProblem || error ? <p role="alert" className="mt-3 text-xs text-rose-300">{sizeProblem ?? error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={useThis}
            disabled={!image || Boolean(sizeProblem) || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Use this {LABEL[kind]}
          </button>
        </div>
      </div>
    </div>
  );
}
