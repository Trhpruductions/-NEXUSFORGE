"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Trash2 } from "lucide-react";
import { addPostComment, deletePostComment, getApiErrorMessage, listPostComments, type PostComment } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { plainText } from "@/lib/plain-text";

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** The comment thread under a post. Reports count changes so the card's counter stays right. */
export function PostComments({ postId, postAuthorId, onCountChange }: { postId: string; postAuthorId: string; onCountChange: (delta: number) => void }) {
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = ["post-comments", postId, accessToken] as const;

  const query = useQuery({ queryKey: key, queryFn: () => listPostComments(accessToken!, postId), enabled: Boolean(accessToken) });
  const add = useMutation({
    mutationFn: () => addPostComment(accessToken!, csrfToken!, postId, draft.trim()),
    onSuccess: (comment) => {
      setDraft("");
      setError(null);
      queryClient.setQueryData<PostComment[]>(key, (current) => [...(current ?? []), comment]);
      onCountChange(1);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => deletePostComment(accessToken!, csrfToken!, commentId),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<PostComment[]>(key, (current) => (current ?? []).filter((comment) => comment.id !== commentId));
      onCountChange(-1);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const canDelete = (comment: PostComment) => comment.authorId === user?.id || postAuthorId === user?.id;

  return (
    <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
      {query.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments...</p>
      ) : (
        <ul className="space-y-2">
          {(query.data ?? []).map((comment) => (
            <li key={comment.id} className="group flex items-start gap-2">
              <Link href={`/app/profile?user=${comment.author.id}`} className="shrink-0">
                {comment.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={comment.author.avatar} alt="" className="h-7 w-7 rounded-full border border-white/10 object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-[10px] font-bold text-amber-100">{comment.author.username.slice(0, 2).toUpperCase()}</span>
                )}
              </Link>
              <div className="min-w-0 flex-1 rounded-lg bg-[#11151e] px-2.5 py-1.5">
                <p className="text-[11px] text-slate-500">
                  <Link href={`/app/profile?user=${comment.author.id}`} className="font-semibold text-slate-200 hover:text-amber-200">{comment.author.displayName || comment.author.username}</Link>
                  {comment.author.isStaff ? <span className="ml-1.5 text-sky-300">Staff</span> : null}
                  <span> · {ago(comment.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{plainText(comment.content)}</p>
              </div>
              {canDelete(comment) ? (
                <button type="button" onClick={() => remove.mutate(comment.id)} className="mt-1 rounded p-1 text-slate-600 opacity-0 transition hover:text-rose-300 focus:opacity-100 group-hover:opacity-100" aria-label="Delete comment">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
          {query.data && query.data.length === 0 ? <li className="text-xs text-slate-500">No comments yet. Start the conversation.</li> : null}
        </ul>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) add.mutate();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Write a comment..."
          aria-label="Write a comment"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-1.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/60"
        />
        <button type="submit" disabled={!draft.trim() || add.isPending} className="rounded-lg bg-amber-400 p-2 text-slate-950 hover:bg-amber-300 disabled:opacity-40" aria-label="Post comment">
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
      {error ? <p className="text-xs text-rose-300" role="alert">{error}</p> : null}
    </div>
  );
}
