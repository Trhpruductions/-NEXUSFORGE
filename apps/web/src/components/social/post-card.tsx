"use client";

import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import type { Post } from "@/lib/api";
import { ClipEmbed } from "@/components/media/clip-embed";

function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

type PostCardProps = {
  post: Post;
  /** The signed-in user, to offer Delete on their own posts. */
  selfId?: string | null;
  onLike: (postId: string) => void;
  onDelete?: (postId: string) => void;
  /** Link the author to their profile (the feed); off on the author's own profile. */
  linkAuthor?: boolean;
  className?: string;
};

/** One post or clip, as shown on profiles and in the community feed. */
export function PostCard({ post, selfId, onLike, onDelete, linkAuthor = false, className = "" }: PostCardProps) {
  const name = post.author.displayName || post.author.username;
  const avatar = post.author.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.author.avatar} alt="" className="h-10 w-10 rounded-full border border-amber-500/30 object-cover" />
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-slate-800 text-xs font-bold text-amber-100">{initials(post.author.username)}</span>
  );
  const profileHref = `/app/profile?user=${post.author.id}`;

  return (
    <article className={className}>
      <div className="flex items-start gap-3">
        {linkAuthor ? <Link href={profileHref} className="shrink-0">{avatar}</Link> : <span className="shrink-0">{avatar}</span>}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
            {linkAuthor ? (
              <Link href={profileHref} className="text-sm font-semibold text-white hover:text-amber-200">{name}</Link>
            ) : (
              <span className="text-sm font-semibold text-white">{name}</span>
            )}
            <span>@{post.author.username}</span>
            <span>· {timeAgo(post.createdAt)}</span>
            {post.author.isStaff ? <span className="rounded border border-sky-400/40 px-1.5 text-[9px] uppercase tracking-[0.12em] text-sky-300">Staff</span> : null}
            {post.author.isCreator ? <span className="rounded border border-amber-400/40 px-1.5 text-[9px] uppercase tracking-[0.12em] text-amber-200">Creator</span> : null}
            {post.kind === "CLIP" ? <span className="rounded border border-white/10 px-1.5 text-[9px] uppercase tracking-[0.12em] text-amber-200">Clip</span> : null}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{post.content}</p>
          {post.mediaUrl ? (
            post.kind === "CLIP" ? (
              <ClipEmbed url={post.mediaUrl} className="mt-2 max-w-2xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrl} alt="" className="mt-2 max-h-80 rounded-xl border border-white/10 object-cover" />
            )
          ) : null}
          {post.tags.length ? <p className="mt-2 text-xs text-amber-300">{post.tags.map((tag) => `#${tag}`).join(" ")}</p> : null}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onLike(post.id)}
              aria-pressed={post.liked}
              aria-label={post.liked ? "Unlike" : "Like"}
              className={`inline-flex items-center gap-1 transition hover:text-rose-300 ${post.liked ? "text-rose-400" : ""}`}
            >
              <Heart className={`h-3.5 w-3.5 ${post.liked ? "fill-current" : ""}`} /> {post._count.likes}
            </button>
            {onDelete && post.authorId === selfId ? (
              <button type="button" onClick={() => onDelete(post.id)} className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
