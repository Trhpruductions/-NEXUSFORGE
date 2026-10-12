"use client";

import { useQuery } from "@tanstack/react-query";
import { api, authHeaders } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useAuthStore } from "@/store/auth-store";

type Preview = { url: string; siteName: string | null; title: string | null; description: string | null; image: string | null; color: string | null };

/** The first http(s) link in a message, ignoring ones wrapped in <...> (Discord's "no embed"). */
export function firstLink(content: string): string | null {
  const text = plainText(content);
  for (const match of text.matchAll(/(<)?(https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"])(>)?/gi)) {
    if (match[1] && match[3]) continue;
    return match[2];
  }
  return null;
}

/** A Discord-style embed for a link. The page and its image are fetched by our server, never by the reader. */
export function LinkPreviewCard({ url }: { url: string }) {
  const { accessToken } = useAuthStore();
  const query = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async () => (await api.get<{ preview: Preview | null }>("/api/link-preview", { headers: authHeaders(accessToken!), params: { url } })).data.preview,
    enabled: Boolean(accessToken),
    staleTime: 60 * 60_000,
    retry: false,
  });
  const preview = query.data;
  if (!preview) return null;
  const image = preview.image ? `${api.defaults.baseURL ?? ""}${preview.image}` : null;
  const accent = preview.color ?? "#a78bfa";

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-2 flex max-w-lg gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#11151e]/90 p-3 transition hover:border-white/15"
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      <span className="min-w-0 flex-1">
        {preview.siteName ? <span className="block truncate text-[11px] text-slate-400">{preview.siteName}</span> : null}
        {preview.title ? <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-sky-300">{preview.title}</span> : null}
        {preview.description ? <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-slate-300">{preview.description}</span> : null}
      </span>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      ) : null}
    </a>
  );
}
