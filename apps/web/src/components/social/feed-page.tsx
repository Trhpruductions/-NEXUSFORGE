"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Clapperboard, Loader2, Newspaper, Send, Users } from "lucide-react";
import { createPost, deletePost, getApiErrorMessage, listPosts, togglePostLike, type Post } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { PostCard } from "./post-card";

const panel = "vx-panel rounded-2xl p-4";
type Scope = "following" | "all";
type Kind = "POST" | "CLIP" | undefined;
type Page = { posts: Post[]; nextCursor: string | null };

export function FeedPage() {
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>("following");
  const [kind, setKind] = useState<Kind>(undefined);
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<"POST" | "CLIP">("POST");
  const [mediaUrl, setMediaUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const queryKey = ["feed", scope, kind ?? "ALL", accessToken] as const;
  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listPosts(accessToken!, { scope, kind, cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(accessToken),
  });
  const posts = feed.data?.pages.flatMap((page) => page.posts) ?? [];

  const publish = useMutation({
    mutationFn: () =>
      createPost(accessToken!, csrfToken!, {
        kind: draftKind,
        content: draft.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
        tags: (draft.match(/#[a-z0-9_]+/gi) ?? []).map((tag) => tag.slice(1)),
      }),
    onSuccess: async () => {
      setDraft("");
      setMediaUrl("");
      setNotice(null);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  // Likes update in place so the list doesn't jump.
  const like = useMutation({
    mutationFn: (postId: string) => togglePostLike(accessToken!, csrfToken!, postId),
    onSuccess: (result, postId) => {
      queryClient.setQueryData<InfiniteData<Page>>(queryKey, (current) =>
        current
          ? { ...current, pages: current.pages.map((page) => ({ ...page, posts: page.posts.map((post) => (post.id === postId ? { ...post, liked: result.liked, _count: { likes: result.likes } } : post)) })) }
          : current,
      );
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (postId: string) => deletePost(accessToken!, csrfToken!, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const chip = (active: boolean) => `rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${active ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="nf-heading inline-flex items-center gap-2 text-xl font-bold text-white"><Newspaper className="h-5 w-5 text-amber-300" /> Feed</h1>
        <p className="text-xs text-slate-400">Posts and clips from the people you follow and the wider community.</p>
      </div>

      <form
        className={`${panel} space-y-3`}
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) publish.mutate();
        }}
      >
        <div className="flex gap-1 rounded-lg border border-white/5 bg-[#0a0d14] p-0.5" role="tablist" aria-label="Post type">
          {(["POST", "CLIP"] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={draftKind === value} onClick={() => setDraftKind(value)} className={chip(draftKind === value)}>
              {value === "POST" ? "Post" : "Clip"}
            </button>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={draftKind === "CLIP" ? "Say something about your clip. Use #tags." : "Share an update with the community. Use #tags."}
          className="w-full resize-y rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/60"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.target.value)}
            placeholder={draftKind === "CLIP" ? "Clip link (YouTube, Twitch, Kick...)" : "Image link (optional)"}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-400/60"
          />
          <button type="submit" disabled={!draft.trim() || publish.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50">
            {publish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post
          </button>
        </div>
        {notice ? <p className="text-xs text-rose-300" role="alert">{notice}</p> : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-white/5 bg-[#0d1119] p-0.5" role="tablist" aria-label="Whose posts">
          <button type="button" role="tab" aria-selected={scope === "following"} onClick={() => setScope("following")} className={chip(scope === "following")}>Following</button>
          <button type="button" role="tab" aria-selected={scope === "all"} onClick={() => setScope("all")} className={chip(scope === "all")}>Everyone</button>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/5 bg-[#0d1119] p-0.5" role="tablist" aria-label="Post type filter">
          <button type="button" role="tab" aria-selected={!kind} onClick={() => setKind(undefined)} className={chip(!kind)}>All</button>
          <button type="button" role="tab" aria-selected={kind === "POST"} onClick={() => setKind("POST")} className={chip(kind === "POST")}>Posts</button>
          <button type="button" role="tab" aria-selected={kind === "CLIP"} onClick={() => setKind("CLIP")} className={chip(kind === "CLIP")}><Clapperboard className="mr-1 inline h-3 w-3" />Clips</button>
        </div>
      </div>

      {feed.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading the feed...</p>
      ) : posts.length ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} selfId={user?.id} onLike={(id) => like.mutate(id)} onDelete={(id) => remove.mutate(id)} linkAuthor className={panel} />
          ))}
          {feed.hasNextPage ? (
            <button
              type="button"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:border-amber-400/50 disabled:opacity-50"
            >
              {feed.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load older posts
            </button>
          ) : (
            <p className="py-2 text-center text-[11px] text-slate-600">You&apos;re all caught up.</p>
          )}
        </div>
      ) : (
        <div className={`${panel} flex flex-col items-center gap-2 py-10 text-center`}>
          <Users className="h-8 w-8 text-slate-600" />
          {scope === "following" ? (
            <>
              <p className="text-sm text-slate-300">Nothing from the people you follow yet.</p>
              <p className="text-xs text-slate-500">
                Follow players from their profile, or{" "}
                <button type="button" onClick={() => setScope("all")} className="text-amber-300 hover:text-amber-200">see what everyone&apos;s posting</button>.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">No posts yet.</p>
              <p className="text-xs text-slate-500">Be the first. Or find people in <Link href="/app/discover" className="text-amber-300 hover:text-amber-200">Discover</Link>.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
