"use client";

import { FileText, Paperclip } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;
const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;

/**
 * Only files from our own upload storage are shown inline. Anything else stays a plain
 * link: an inline <img> from an arbitrary URL would let a sender log everyone who opens
 * the channel (a tracking pixel).
 */
function isOwnUpload(url: string) {
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "http://127.0.0.1" : window.location.origin);
    // Our uploads are served by the API, which answers on this page's own address (through
    // the public gateway) or on the API's address when running locally.
    const ownOrigins = new Set([API_BASE_URL, "http://127.0.0.1:4001", typeof window === "undefined" ? "" : window.location.origin].filter(Boolean).map((value) => new URL(value).origin));
    if (ownOrigins.has(parsed.origin) && parsed.pathname.startsWith("/uploads/")) return true;
    const s3 = process.env.NEXT_PUBLIC_UPLOADS_BASE_URL;
    return Boolean(s3 && url.startsWith(s3));
  } catch {
    return false;
  }
}

function fileName(url: string) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "file");
    // Uploads are stored as <timestamp>-<uuid>-<original name>.
    return last.replace(/^\d+-[0-9a-f-]{36}-/i, "");
  } catch {
    return "file";
  }
}

export function MessageAttachments({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {urls.map((url) => {
        const own = isOwnUpload(url);
        if (own && IMAGE_RE.test(url)) {
          return (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-fit max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={fileName(url)} loading="lazy" className="max-h-80 max-w-full rounded-lg border border-white/10 object-contain sm:max-w-md" />
            </a>
          );
        }
        if (own && VIDEO_RE.test(url)) {
          return <video key={url} src={url} controls preload="metadata" className="max-h-80 max-w-full rounded-lg border border-white/10 bg-black sm:max-w-md" />;
        }
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-xs text-slate-200 hover:border-amber-400/50"
          >
            {own ? <FileText className="h-4 w-4 shrink-0 text-amber-300" /> : <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="truncate">{own ? fileName(url) : url}</span>
          </a>
        );
      })}
    </div>
  );
}
