"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessagesSquare, PenSquare, Tag, X } from "lucide-react";
import { getApiErrorMessage, listThreads, postMessage, type Channel } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { alpha, hueFor, tileGradient } from "@/lib/colors";
import { RichText } from "@/components/chat/rich-text";
import { useAuthStore } from "@/store/auth-store";

function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** A forum channel: every post is a titled thread with its own replies. */
export function ForumView({ channel, emojis, onOpenPost }: { channel: Channel; emojis?: Record<string, string>; onOpenPost: (threadId: string) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<"active" | "new">("active");
  const [error, setError] = useState<string | null>(null);
  const forumTags = channel.forumTags ?? [];

  const postsQuery = useQuery({ queryKey: ["threads", channel.id, accessToken], queryFn: () => listThreads(accessToken!, channel.id), enabled: Boolean(accessToken) });
  const posts = useMemo(() => {
    const list = (postsQuery.data?.threads ?? []).filter((post) => !filter || post.tags?.includes(filter));
    return [...list].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      const key = (post: typeof a) => new Date(sort === "new" ? post.createdAt ?? 0 : post.lastMessageAt ?? post.createdAt ?? 0).getTime();
      return key(b) - key(a);
    });
  }, [postsQuery.data, filter, sort]);

  const create = useMutation({
    mutationFn: () => postMessage(accessToken!, csrfToken!, { channelId: channel.id, forumTitle: title.trim(), forumTags: tags, content: body.trim() }),
    onSuccess: async (result) => {
      setComposing(false);
      setTitle("");
      setBody("");
      setTags([]);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["threads", channel.id] });
      if (result.message.startedThread) onOpenPost(result.message.startedThread.id);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="nf-heading flex items-center gap-2 text-lg font-bold text-white"><MessagesSquare className="h-5 w-5 text-violet-300" /> {channel.name}</h2>
          {channel.topic ? <p className="text-xs text-slate-400">{channel.topic}</p> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select aria-label="Sort posts" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-lg border border-white/10 bg-[#11151e] px-2 text-xs text-slate-200">
            <option value="active">Recently active</option>
            <option value="new">Newest posts</option>
          </select>
          <button type="button" onClick={() => setComposing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110">
            <PenSquare className="h-3.5 w-3.5" /> New post
          </button>
        </div>
      </div>

      {forumTags.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-slate-500" />
          <button type="button" onClick={() => setFilter(null)} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${!filter ? "border-violet-400/60 bg-violet-500/15 text-violet-100" : "border-white/10 text-slate-400 hover:text-white"}`}>All</button>
          {forumTags.map((tag) => (
            <button key={tag} type="button" onClick={() => setFilter(filter === tag ? null : tag)} className="rounded-full border px-2.5 py-0.5 text-[11px] transition" style={filter === tag ? { borderColor: hueFor(tag).base, background: alpha(hueFor(tag).base, 0.15), color: hueFor(tag).light } : { borderColor: "rgba(255,255,255,0.1)", color: "#94a3b8" }}>
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {composing ? (
        <form
          className="space-y-2 rounded-2xl border border-violet-400/30 bg-violet-950/15 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim() && body.trim()) create.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">New post in #{channel.name}</p>
            <button type="button" onClick={() => setComposing(false)} className="rounded p-1 text-slate-400 hover:text-white" title="Cancel"><X className="h-4 w-4" /></button>
          </div>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Title" aria-label="Post title" className="h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm font-semibold text-white outline-none focus:border-violet-400/60" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={5} placeholder="What do you want to share or ask?" aria-label="Post" className="w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60" />
          {forumTags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {forumTags.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button key={tag} type="button" disabled={!on && tags.length >= 5} onClick={() => setTags(on ? tags.filter((entry) => entry !== tag) : [...tags, tag])} className="rounded-full border px-2.5 py-0.5 text-[11px] disabled:opacity-40" style={on ? { borderColor: hueFor(tag).base, background: alpha(hueFor(tag).base, 0.15), color: hueFor(tag).light } : { borderColor: "rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                    {on ? "✓ " : ""}{tag}
                  </button>
                );
              })}
            </div>
          ) : null}
          {error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : null}
          <button type="submit" disabled={!title.trim() || !body.trim() || create.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-4 text-xs font-bold text-slate-950 disabled:opacity-40">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Post
          </button>
        </form>
      ) : null}

      {postsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading posts...</p>
      ) : posts.length ? (
        <ul className="space-y-2">
          {posts.map((post) => {
            const author = post.starterMessage?.author;
            return (
              <li key={post.id}>
                <button type="button" onClick={() => onOpenPost(post.id)} className={`w-full rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-3 text-left transition hover:border-violet-400/40 ${post.archived ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    {author?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={author.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-950" style={{ background: tileGradient(hueFor(author?.id ?? post.id)) }}>{(author?.username ?? "?").slice(0, 2).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{post.title}</p>
                      {post.tags?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {post.tags.map((tag) => <span key={tag} className="rounded-full px-1.5 text-[10px]" style={{ background: alpha(hueFor(tag).base, 0.15), color: hueFor(tag).light }}>{tag}</span>)}
                        </div>
                      ) : null}
                      {post.starterMessage ? (
                        <div className="mt-1 line-clamp-2 text-sm text-slate-300">
                          <RichText content={plainText(post.starterMessage.content).slice(0, 240)} context={{ emojis }} />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs italic text-slate-500">The original post was deleted.</p>
                      )}
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        <span style={{ color: author ? hueFor(author.id).light : undefined }}>{author?.username ?? "deleted user"}</span>
                        <span className="inline-flex items-center gap-1"><MessagesSquare className="h-3 w-3" /> {post.messageCount}</span>
                        <span>{post.archived ? "archived" : `active ${ago(post.lastMessageAt ?? post.createdAt)}`}</span>
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <MessagesSquare className="mx-auto mb-2 h-8 w-8 text-violet-300/60" />
          <p className="text-sm text-slate-300">{filter ? `No posts tagged "${filter}" yet.` : "No posts yet. Start the first one."}</p>
        </div>
      )}
    </div>
  );
}
