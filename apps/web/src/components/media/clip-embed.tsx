"use client";

import { useState } from "react";
import { Clapperboard, ExternalLink, Play } from "lucide-react";

/**
 * Inline player for clip links: YouTube, Twitch clips and VODs, Kick clips, and
 * direct video files. Anything else falls back to an external link.
 */
type Embed = { kind: "iframe"; src: string; label: string } | { kind: "video"; src: string } | { kind: "link" };

function parentHost() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname;
}

export function resolveClipEmbed(raw: string): Embed {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "link" };
  }
  const host = url.hostname.replace(/^www\./, "");

  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname)) return { kind: "video", src: raw };

  if (host === "youtu.be") return { kind: "iframe", src: `https://www.youtube.com/embed/${url.pathname.slice(1)}`, label: "YouTube" };
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}`, label: "YouTube" };
  }

  if (host === "clips.twitch.tv") {
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (slug) return { kind: "iframe", src: `https://clips.twitch.tv/embed?clip=${slug}&parent=${parentHost()}&autoplay=false`, label: "Twitch clip" };
  }
  if (host === "twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);
    const clipIndex = parts.indexOf("clip");
    if (clipIndex >= 0 && parts[clipIndex + 1]) return { kind: "iframe", src: `https://clips.twitch.tv/embed?clip=${parts[clipIndex + 1]}&parent=${parentHost()}&autoplay=false`, label: "Twitch clip" };
    if (parts[0] === "videos" && parts[1]) return { kind: "iframe", src: `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost()}&autoplay=false`, label: "Twitch VOD" };
    if (parts.length === 1) return { kind: "iframe", src: `https://player.twitch.tv/?channel=${parts[0]}&parent=${parentHost()}&autoplay=false`, label: "Twitch" };
  }

  if (host === "kick.com") {
    const clip = url.searchParams.get("clip") ?? url.pathname.match(/\/clips\/([^/?]+)/)?.[1];
    if (clip) return { kind: "iframe", src: `https://kick.com/embed/clip/${clip}`, label: "Kick clip" };
    const channel = url.pathname.split("/").filter(Boolean)[0];
    if (channel) return { kind: "iframe", src: `https://player.kick.com/${channel}?autoplay=false`, label: "Kick" };
  }

  if (host === "streamable.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    if (id) return { kind: "iframe", src: `https://streamable.com/e/${id}`, label: "Streamable" };
  }

  return { kind: "link" };
}

export function ClipEmbed({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const embed = resolveClipEmbed(url);

  if (embed.kind === "link") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 ${className ?? ""}`}>
        <Clapperboard className="h-4 w-4" /> Watch clip <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  if (embed.kind === "video") {
    return <video src={embed.src} controls preload="metadata" className={`aspect-video w-full rounded-xl border border-white/10 bg-black ${className ?? ""}`} />;
  }

  // Click-to-load keeps feeds light and avoids autoplaying third-party players.
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-black ${className ?? ""}`}>
      {open ? (
        <iframe src={embed.src} title={embed.label} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full" />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="group flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_40%,rgba(230,179,37,0.18),transparent_60%),#0b0e15] text-slate-300 transition hover:text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/10 text-amber-300 transition group-hover:bg-amber-400 group-hover:text-slate-950"><Play className="h-6 w-6" /></span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Play {embed.label}</span>
        </button>
      )}
      <div className="flex items-center justify-between border-t border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span>{embed.label}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-amber-200">Open <ExternalLink className="h-3 w-3" /></a>
      </div>
    </div>
  );
}
