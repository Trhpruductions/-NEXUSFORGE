"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, BarChart3, Bookmark, BookmarkCheck, Sticker, Check, Clock, Flag, Hash, MessagesSquare, Smile, Loader2, Megaphone, MessageSquare, Mic, Paperclip, Pencil, Pin, Plus, Radio, Search, Send, Settings2, Timer, Trash2, Users, Volume2, X } from "lucide-react";
import { LoadingNote } from "@/components/ui/loading-note";
import axios from "axios";
import {
  createDmThread,
  createUploadPresign,
  deleteMessage,
  editMessage,
  getApiErrorMessage,
  getDmMessages,
  getForge,
  getForgePermissions,
  getMessages,
  listDmThreads,
  getForgeUnreads,
  markChannelRead,
  postDmMessage,
  editDmMessage,
  deleteDmMessage,
  postMessage,
  requestVoiceToken,
  toggleReaction,
  updateVoiceState,
  listPinnedMessages,
  pinMessage,
  markDmThreadRead,
  createDmGroup,
  listFriends,
  type Channel,
  type DmMessage,
  type DmThread,
  type Message,
  type PollDraft,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useVoiceStore } from "@/store/voice-store";
import { useServerViewStore } from "@/store/server-view-store";
import { MessageList } from "@/components/chat/message-list";
import { PollComposer } from "@/components/chat/poll-composer";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { useSavedMessages } from "@/components/chat/use-saved";
import { MemberList } from "@/components/chat/member-list";
import dynamic from "next/dynamic";
// The server settings panel is large and only opened on demand.
const ForgeSettingsPanel = dynamic(() => import("@/components/chat/forge-settings-panel").then((mod) => mod.ForgeSettingsPanel), { ssr: false });
import { VoiceRoomPanel } from "@/components/chat/voice-room-panel";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import { isManageTab } from "@/components/chat/forge-manage-tabs";
import { firstLink, LinkPreviewCard } from "@/components/chat/link-preview-card";
import { ThreadPanel } from "@/components/chat/thread-panel";
import { ForumView } from "@/components/chat/forum-view";
import { createThread, listForgeEmojis, listForgeStickers, listThreads } from "@/lib/api";
import { CustomEmoji } from "@/components/chat/rich-text";
import { plainText } from "@/lib/plain-text";
import { RichText } from "@/components/chat/rich-text";


const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-amber-200";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPage() {
  return (
    <Suspense fallback={<LoadingNote label="Loading chat..." />}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const setActiveChannelId = useWorkspaceStore((state) => state.setActiveChannelId);
  const clearChannel = useWorkspaceStore((state) => state.clearChannel);

  const requestedForge = searchParams?.get("forge");
  const requestedChannel = searchParams?.get("channel");
  const requestedVoice = searchParams?.get("voice");
  const requestedManage = searchParams?.get("manage");
  const requestedDm = searchParams?.get("dm");

  const [channelId, setChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // ?manage=channels from the sidebar opens the forge manage panel on that tab.
  useEffect(() => {
    if (requestedManage) setSettingsOpen(true);
  }, [requestedManage]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<string | null>(null);
  const voiceSession = useVoiceStore((state) => state.session);
  const joinVoiceStore = useVoiceStore((state) => state.join);
  const [dmDraft, setDmDraft] = useState("");
  // DM composer: files waiting to be sent and the emoji picker.
  const [dmFiles, setDmFiles] = useState<File[]>([]);
  const [dmEmojiOpen, setDmEmojiOpen] = useState(false);
  const dmFileInput = useRef<HTMLInputElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const isTyping = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (requestedForge && requestedForge !== selectedForgeId) setSelectedForgeId(requestedForge);
  }, [requestedForge, selectedForgeId, setSelectedForgeId]);

  const forgeQuery = useQuery({
    queryKey: ["forge", selectedForgeId, accessToken],
    queryFn: () => getForge(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });
  const forge = forgeQuery.data?.forge;
  const textChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT" || channel.type === "FORUM"), [forge]);
  const voiceChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "VOICE" || channel.type === "STAGE"), [forge]);

  const accessQuery = useQuery({
    queryKey: ["forge-permissions", selectedForgeId, accessToken],
    queryFn: () => getForgePermissions(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });
  const canModerate = Boolean(accessQuery.data?.isOwner || accessQuery.data?.permissions.moderateChat);
  // Same rule as the server: the owner, chat moderators and channel managers skip slowmode.
  const skipsSlowmode = canModerate || Boolean(accessQuery.data?.permissions.manageChannels);

  // Slowmode and timeouts. slowUntil is per channel (ms timestamps); the clock only ticks
  // while one of them is counting down.
  const [slowUntil, setSlowUntil] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(() => Date.now());
  const myMembership = forge?.members.find((member) => member.userId === user?.id);
  const timedOutUntil = myMembership?.timeoutUntil && new Date(myMembership.timeoutUntil).getTime() > clock ? new Date(myMembership.timeoutUntil) : null;
  const counting = Boolean(timedOutUntil) || Object.values(slowUntil).some((until) => until > clock);
  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  // Resolve the active text channel from the URL or fall back to the first one.
  useEffect(() => {
    if (!textChannels.length) return;
    const wanted = requestedChannel && textChannels.some((channel) => channel.id === requestedChannel) ? requestedChannel : null;
    const next = wanted ?? (channelId && textChannels.some((channel) => channel.id === channelId) ? channelId : textChannels[0].id);
    if (next !== channelId) setChannelId(next);
  }, [textChannels, requestedChannel, channelId]);

  // Where the reader left off in the open channel, for the "New messages" line.
  const [unreadSince, setUnreadSince] = useState<{ channelId: string; at: string } | null>(null);
  const mode: "voice" | "dm" | "channel" = requestedVoice ? "voice" : requestedDm ? "dm" : "channel";
  // Inside a server (its channels or voice), the shell steps back so the server fills the window. DMs keep the normal shell.
  const inServer = mode !== "dm" && Boolean(selectedForgeId);
  const setServerView = useServerViewStore((state) => state.setActive);
  useEffect(() => {
    setServerView(inServer);
  }, [inServer, setServerView]);
  useEffect(() => () => setServerView(false), [setServerView]);
  // Remember the channel per server, so opening that server again returns to it.
  const rememberChannel = useWorkspaceStore((state) => state.rememberChannel);
  useEffect(() => {
    if (mode === "channel" && selectedForgeId && channelId) rememberChannel(selectedForgeId, channelId);
  }, [mode, selectedForgeId, channelId, rememberChannel]);
  const channel = textChannels.find((entry) => entry.id === channelId) ?? null;
  const voiceChannel = requestedVoice && requestedVoice !== "1" ? voiceChannels.find((entry) => entry.id === requestedVoice) ?? null : voiceChannels[0] ?? null;

  // Mark read + tell the shell which channel is open.
  useEffect(() => {
    if (mode !== "channel" || !channelId || !selectedForgeId) return;
    setActiveChannelId(channelId);
    clearChannel(selectedForgeId, channelId);
    setUnreadSince(null);
    if (accessToken && csrfToken) {
      const forgeId = selectedForgeId;
      const openedChannel = channelId;
      // Remember where the reader left off (for the "New" line) before marking it read.
      void getForgeUnreads(accessToken, forgeId)
        .then((reads) => {
          const entry = reads.channels.find((c) => c.channelId === openedChannel);
          if (entry && entry.unread > 0 && entry.lastReadAt) setUnreadSince({ channelId: openedChannel, at: entry.lastReadAt });
        })
        .catch(() => undefined)
        .finally(() => {
          void markChannelRead(accessToken, csrfToken, openedChannel)
            .then(() => {
              void queryClient.invalidateQueries({ queryKey: ["forge-unreads"] });
              void queryClient.invalidateQueries({ queryKey: ["unread-summary"] });
            })
            .catch(() => undefined);
        });
    }
    setReplyTarget(null);
    setSearch("");
  }, [mode, channelId, selectedForgeId, accessToken, csrfToken, setActiveChannelId, clearChannel, queryClient]);

  const messagesQuery = useQuery({
    queryKey: ["messages", channelId, accessToken],
    queryFn: () => getMessages(accessToken!, channelId!),
    enabled: Boolean(accessToken && channelId && mode === "channel"),
  });

  // Realtime for the open channel.
  useEffect(() => {
    if (!accessToken || !channelId || mode !== "channel") return;
    const socket = getSocket(accessToken);
    if (!socket.connected) socket.connect();
    socket.emit("channel:join", channelId);
    // Rooms are lost when the socket reconnects (server restart, network blip): rejoin and catch up.
    const rejoin = () => {
      socket.emit("channel:join", channelId);
      void queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    };
    socket.on("connect", rejoin);
    const key = ["messages", channelId, accessToken];
    const patch = (fn: (current: { messages: Message[]; nextCursor: string | null }) => { messages: Message[]; nextCursor: string | null }) =>
      queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(key, (current) => (current ? fn(current) : current));

    const onCreated = (payload: { message: Message; optimisticId?: string }) => {
      if (payload.message.channelId !== channelId) return;
      // Thread replies show in the thread panel, not the channel.
      if (payload.message.threadId) return;
      patch((current) => {
        if (payload.optimisticId && current.messages.some((msg) => msg.id === payload.optimisticId)) {
          return { ...current, messages: current.messages.map((msg) => (msg.id === payload.optimisticId ? payload.message : msg)) };
        }
        if (current.messages.some((msg) => msg.id === payload.message.id)) return current;
        return { ...current, messages: [...current.messages, payload.message] };
      });
      if (accessToken && csrfToken && payload.message.authorId !== user?.id) void markChannelRead(accessToken, csrfToken, channelId).catch(() => undefined);
    };
    const onUpdated = (payload: { message: Message }) => patch((current) => ({ ...current, messages: current.messages.map((msg) => (msg.id === payload.message.id ? payload.message : msg)) }));
    const onDeleted = (payload: { messageId: string }) => patch((current) => ({ ...current, messages: current.messages.filter((msg) => msg.id !== payload.messageId) }));
    const onPinned = (payload: { message: Message }) => {
      patch((current) => ({ ...current, messages: current.messages.map((msg) => (msg.id === payload.message.id ? payload.message : msg)) }));
      void queryClient.invalidateQueries({ queryKey: ["pins", channelId] });
    };
    const onReactions = (payload: { messageId: string; reactions: Message["reactions"] }) => patch((current) => ({ ...current, messages: current.messages.map((msg) => (msg.id === payload.messageId ? { ...msg, reactions: payload.reactions ?? [] } : msg)) }));
    const nameOf = (userId: string) => forge?.members.find((member) => member.userId === userId)?.user.username ?? "Someone";
    const onTypingStart = (payload: { channelId: string; userId: string }) => {
      if (payload.userId === user?.id) return;
      setTyping((current) => ({ ...current, [payload.channelId]: [...new Set([...(current[payload.channelId] ?? []), nameOf(payload.userId)])] }));
    };
    const onTypingStop = (payload: { channelId: string; userId: string }) => {
      setTyping((current) => ({ ...current, [payload.channelId]: (current[payload.channelId] ?? []).filter((name) => name !== nameOf(payload.userId)) }));
    };

    const onThreadUpdated = (payload: { channelId: string; messageId: string | null; thread: Message["startedThread"] }) => {
      if (payload.channelId !== channelId) return;
      if (payload.messageId) patch((current) => ({ ...current, messages: current.messages.map((msg) => (msg.id === payload.messageId ? { ...msg, startedThread: payload.thread } : msg)) }));
      void queryClient.invalidateQueries({ queryKey: ["threads", channelId] });
    };
    socket.on("thread:updated", onThreadUpdated);
    socket.on("message:created", onCreated);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reactions", onReactions);
    socket.on("message:pinned", onPinned);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    return () => {
      socket.emit("channel:leave", channelId);
      socket.off("connect", rejoin);
      socket.off("thread:updated", onThreadUpdated);
      socket.off("message:created", onCreated);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.off("message:reactions", onReactions);
      socket.off("message:pinned", onPinned);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
    };
  }, [accessToken, csrfToken, channelId, mode, queryClient, user?.id, forge?.members]);

  const slashCommands = useMemo(
    () => (forge?.botInstallations ?? []).filter((install) => install.enabled).flatMap((install) => install.commands.filter((command) => command.enabled).map((command) => ({ ...command, botName: install.bot.name }))),
    [forge],
  );
  // @mention autocomplete: the token being typed at the caret's end of the draft.
  const mentionQuery = useMemo(() => {
    const match = draft.match(/(?:^|\s)@([a-zA-Z0-9_]{0,32})$/);
    return match ? match[1].toLowerCase() : null;
  }, [draft]);
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || !forge) return [];
    return forge.members
      .filter((member) => member.user.id !== user?.id && (!mentionQuery || member.user.username.toLowerCase().startsWith(mentionQuery)))
      .slice(0, 6);
  }, [mentionQuery, forge, user?.id]);
  const applyMention = (username: string) => {
    setDraft((current) => current.replace(/@([a-zA-Z0-9_]{0,32})$/, `@${username} `));
  };

  const slashSuggestions = useMemo(() => {
    const trimmed = draft.trimStart();
    if (!trimmed.startsWith("/") || trimmed.includes(" ")) return [];
    const query = trimmed.slice(1).toLowerCase();
    return slashCommands.filter((command) => !query || command.name.toLowerCase().startsWith(query)).slice(0, 6);
  }, [draft, slashCommands]);

  const uploadFiles = async (files: File[]) => {
    const urls: string[] = [];
    for (const file of files) {
      const presign = await createUploadPresign(accessToken!, csrfToken!, { filename: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) {
        // Our own upload endpoint answers with JSON; a proxy in between (413 from the host) does not.
        const detail = (await put.json().catch(() => null)) as { error?: string } | null;
        if (detail?.error) throw new Error(`${file.name}: ${detail.error}`);
        if (put.status === 413) throw new Error(`${file.name} is too big to upload right now (single uploads are capped at 95 MB during the beta).`);
        throw new Error(`Upload failed for ${file.name} (${put.status}). Please try again.`);
      }
      urls.push(presign.fileUrl);
    }
    return urls;
  };

  const sendMutation = useMutation({
    mutationFn: (payload: { channelId: string; content: string; optimisticId: string; attachments?: string[]; replyToId?: string; poll?: PollDraft; stickerId?: string; sticker?: Message["sticker"] }) =>
      postMessage(accessToken!, csrfToken!, { channelId: payload.channelId, content: payload.content, optimisticId: payload.optimisticId, attachments: payload.attachments, replyToId: payload.replyToId, poll: payload.poll, stickerId: payload.stickerId }),
    onMutate: async (payload) => {
      const key = ["messages", payload.channelId, accessToken];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ messages: Message[]; nextCursor: string | null }>(key);
      const optimistic: Message = {
        id: payload.optimisticId,
        channelId: payload.channelId,
        authorId: user?.id ?? null,
        content: payload.content,
        attachments: payload.attachments,
        edited: false,
        createdAt: new Date().toISOString(),
        optimistic: true,
        optimisticId: payload.optimisticId,
        replyToId: payload.replyToId,
        replyTo: replyTarget && replyTarget.id === payload.replyToId ? { id: replyTarget.id, content: replyTarget.content, authorId: replyTarget.authorId, botName: replyTarget.botName, author: replyTarget.author ? { id: replyTarget.author.id, username: replyTarget.author.username } : null } : null,
        reactions: [],
        author: user ? { id: user.id, username: user.username, avatar: user.avatar, premium: user.premium } : undefined,
        sticker: payload.sticker ?? null,
        // Shown (disabled) until the server confirms it.
        poll: payload.poll
          ? { id: payload.optimisticId, options: payload.poll.options.map((text, index) => ({ id: `tmp-${index}`, text })), allowMultiple: payload.poll.allowMultiple, endsAt: new Date(Date.now() + payload.poll.durationHours * 3600_000).toISOString(), closedAt: null, votes: [] }
          : null,
      };
      queryClient.setQueryData(key, { messages: [...(previous?.messages ?? []), optimistic], nextCursor: previous?.nextCursor ?? null });
      return { previous, key };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      setStatus(getApiErrorMessage(error));
    },
    onSuccess: (data, payload) => {
      queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(["messages", payload.channelId, accessToken], (current) =>
        current ? { ...current, messages: current.messages.map((msg) => (msg.id === payload.optimisticId ? { ...data.message, optimistic: false } : msg)) } : current,
      );
    },
  });
  const editMutation = useMutation({
    mutationFn: (input: { messageId: string; content: string }) => editMessage(accessToken!, csrfToken!, input.messageId, input.content),
    onSuccess: (data) => queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(["messages", data.message.channelId, accessToken], (current) => (current ? { ...current, messages: current.messages.map((msg) => (msg.id === data.message.id ? data.message : msg)) } : current)),
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessage(accessToken!, csrfToken!, messageId),
    onSuccess: (_data, messageId) => queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(["messages", channelId, accessToken], (current) => (current ? { ...current, messages: current.messages.filter((msg) => msg.id !== messageId) } : current)),
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  const pinsQuery = useQuery({
    queryKey: ["pins", channelId, accessToken],
    queryFn: () => listPinnedMessages(accessToken!, channelId!),
    enabled: Boolean(accessToken && channelId && mode === "channel" && pinsOpen),
  });
  const pinMutation = useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) => pinMessage(accessToken!, csrfToken!, messageId, pinned),
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });

  const reactMutation = useMutation({
    mutationFn: (input: { messageId: string; emoji: string }) => toggleReaction(accessToken!, csrfToken!, input.messageId, input.emoji),
    onSuccess: (data, input) => queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(["messages", channelId, accessToken], (current) => (current ? { ...current, messages: current.messages.map((msg) => (msg.id === input.messageId ? { ...msg, reactions: data.reactions } : msg)) } : current)),
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });

  const loadOlder = async () => {
    if (!accessToken || !channelId) return;
    const key = ["messages", channelId, accessToken];
    const current = queryClient.getQueryData<{ messages: Message[]; nextCursor: string | null }>(key);
    if (!current?.nextCursor) return;
    setLoadingOlder(true);
    try {
      const older = await getMessages(accessToken, channelId, current.nextCursor);
      queryClient.setQueryData<{ messages: Message[]; nextCursor: string | null }>(key, (latest) => {
        const existing = latest?.messages ?? [];
        const seen = new Set(existing.map((msg) => msg.id));
        return { messages: [...older.messages.filter((msg) => !seen.has(msg.id)), ...existing], nextCursor: older.nextCursor };
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!accessToken || !channelId) return;
    const socket = getSocket(accessToken);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (!value.trim()) {
      if (isTyping.current) {
        socket.emit("typing:stop", channelId);
        isTyping.current = false;
      }
      return;
    }
    if (!isTyping.current) {
      socket.emit("typing:start", channelId);
      isTyping.current = true;
    }
    typingTimer.current = window.setTimeout(() => {
      socket.emit("typing:stop", channelId);
      isTyping.current = false;
    }, 2500);
  };

  const send = async () => {
    if (!channelId || (!draft.trim() && !pendingFiles.length) || uploading) return;
    if (timedOutUntil) {
      setStatus(`You're timed out until ${timedOutUntil.toLocaleTimeString()}.`);
      return;
    }
    const waitMs = (slowUntil[channelId] ?? 0) - Date.now();
    if (waitMs > 0) {
      setStatus(`Slowmode: wait ${Math.ceil(waitMs / 1000)}s before sending again.`);
      return;
    }
    const content = draft.trim() || "Shared a file";
    const slowmode = textChannels.find((entry) => entry.id === channelId)?.slowmodeSeconds ?? 0;
    const files = [...pendingFiles];
    const replyToId = replyTarget?.id;
    if (accessToken && isTyping.current) {
      getSocket(accessToken).emit("typing:stop", channelId);
      isTyping.current = false;
    }
    setDraft("");
    setPendingFiles([]);
    setReplyTarget(null);
    try {
      setUploading(Boolean(files.length));
      const attachments = files.length ? await uploadFiles(files) : undefined;
      await sendMutation.mutateAsync({ channelId, content, optimisticId: `tmp-${crypto.randomUUID()}`, attachments, replyToId });
      if (slowmode > 0 && !skipsSlowmode) setSlowUntil((current) => ({ ...current, [channelId]: Date.now() + slowmode * 1000 }));
    } catch (error) {
      setStatus(getApiErrorMessage(error));
      const data = axios.isAxiosError(error) ? (error.response?.data as { code?: string; retryAfter?: number } | undefined) : undefined;
      if (data?.code === "SLOWMODE" || data?.code === "TIMED_OUT" || data?.code === "AUTOMOD") {
        // Not sent: give the text back so nothing is lost.
        if (!files.length) setDraft(content);
        if (data.code === "SLOWMODE" && data.retryAfter) setSlowUntil((current) => ({ ...current, [channelId]: Date.now() + data.retryAfter! * 1000 }));
        if (data.code === "TIMED_OUT") void queryClient.invalidateQueries({ queryKey: ["forge", selectedForgeId, accessToken] });
      }
    } finally {
      setUploading(false);
    }
  };

  const saved = useSavedMessages();
  // Polls: the question is sent as the message text.
  const [pollOpen, setPollOpen] = useState(false);
  const sendPoll = async (question: string, poll: PollDraft) => {
    if (!channelId) return;
    if (timedOutUntil) {
      setStatus(`You're timed out until ${timedOutUntil.toLocaleTimeString()}.`);
      throw new Error("timed out");
    }
    try {
      await sendMutation.mutateAsync({ channelId, content: question, optimisticId: `tmp-${crypto.randomUUID()}`, poll });
    } catch (error) {
      setStatus(getApiErrorMessage(error));
      throw error;
    }
  };

  // ---------------------------------------------------------------- voice
  const joinVoice = async (target: Channel) => {
    if (!accessToken || !csrfToken) return;
    try {
      const token = await requestVoiceToken(accessToken, csrfToken, target.id);
      // The engine in the app shell runs the call, so it keeps going when you leave this page.
      joinVoiceStore({ ...token, channelId: target.id, channelName: target.name, forgeId: forge?.id ?? null, stage: target.type === "STAGE" });
      await updateVoiceState(accessToken, csrfToken, { channelId: target.id, ...useVoiceStore.getState().flags }).catch(() => undefined);
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    }
  };

  // ---------------------------------------------------------------- DMs
  const dmThreadsQuery = useQuery({
    queryKey: ["dm-threads", accessToken],
    queryFn: () => listDmThreads(accessToken!),
    enabled: Boolean(accessToken && mode === "dm"),
  });
  const [dmThreadId, setDmThreadId] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const friendsQuery = useQuery({
    queryKey: ["friends", accessToken],
    queryFn: () => listFriends(accessToken!),
    enabled: Boolean(accessToken && mode === "dm" && groupOpen),
  });
  const friendOptions = useMemo(
    () => (friendsQuery.data?.friends ?? []).filter((entry) => entry.status === "ACCEPTED").map((entry) => (entry.senderId === user?.id ? entry.receiver : entry.sender)),
    [friendsQuery.data, user?.id],
  );
  const groupMutation = useMutation({
    mutationFn: () => createDmGroup(accessToken!, csrfToken!, { name: groupName.trim(), participantIds: Array.from(groupMembers) }),
    onSuccess: async (result) => {
      setGroupOpen(false);
      setGroupName("");
      setGroupMembers(new Set());
      await queryClient.invalidateQueries({ queryKey: ["dm-threads"] });
      router.replace(`/app/chat?dm=${result.thread.id}`);
    },
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  const dmCreateFor = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "dm" || !requestedDm || !accessToken || !csrfToken) return;
    if (requestedDm.startsWith("user:")) {
      // Effects run twice in development; only one thread request per target.
      if (dmCreateFor.current === requestedDm) return;
      dmCreateFor.current = requestedDm;
      const userId = requestedDm.slice(5);
      void createDmThread(accessToken, csrfToken, userId)
        .then((result) => {
          setDmThreadId(result.thread.id);
          void queryClient.invalidateQueries({ queryKey: ["dm-threads"] });
          router.replace(`/app/chat?dm=${result.thread.id}`);
        })
        .catch((error) => setStatus(getApiErrorMessage(error)));
    } else {
      setDmThreadId(requestedDm);
    }
  }, [mode, requestedDm, accessToken, csrfToken, queryClient, router]);
  const dmMessagesQuery = useQuery({
    queryKey: ["dm-messages", dmThreadId, accessToken],
    queryFn: () => getDmMessages(accessToken!, dmThreadId!),
    enabled: Boolean(accessToken && dmThreadId && mode === "dm"),
  });
  useEffect(() => {
    if (!accessToken || !dmThreadId || mode !== "dm") return;
    const socket = getSocket(accessToken);
    if (!socket.connected) socket.connect();
    socket.emit("dm:join", dmThreadId);
    const rejoin = () => {
      socket.emit("dm:join", dmThreadId);
      void queryClient.invalidateQueries({ queryKey: ["dm-messages", dmThreadId] });
    };
    const markRead = () => {
      if (!csrfToken) return;
      void markDmThreadRead(accessToken, csrfToken, dmThreadId)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
          void queryClient.invalidateQueries({ queryKey: ["dm-threads"] });
        })
        .catch(() => undefined);
    };
    markRead();
    socket.on("connect", rejoin);
    const onDm = (payload: { threadId: string; message: DmMessage }) => {
      if (payload.threadId !== dmThreadId) return;
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) => {
        const messages = current?.messages ?? [];
        return messages.some((msg) => msg.id === payload.message.id) ? current : { messages: [...messages, payload.message] };
      });
      if (payload.message.authorId !== user?.id) markRead();
    };
    const onDmUpdated = (payload: { threadId: string; message: DmMessage }) => {
      if (payload.threadId !== dmThreadId) return;
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) =>
        current ? { messages: current.messages.map((msg) => (msg.id === payload.message.id ? payload.message : msg)) } : current,
      );
    };
    const onDmDeleted = (payload: { threadId: string; messageId: string }) => {
      if (payload.threadId !== dmThreadId) return;
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) =>
        current ? { messages: current.messages.filter((msg) => msg.id !== payload.messageId) } : current,
      );
    };
    socket.on("dm:message", onDm);
    socket.on("dm:message:updated", onDmUpdated);
    socket.on("dm:message:deleted", onDmDeleted);
    return () => {
      socket.emit("dm:leave", dmThreadId);
      socket.off("connect", rejoin);
      socket.off("dm:message", onDm);
      socket.off("dm:message:updated", onDmUpdated);
      socket.off("dm:message:deleted", onDmDeleted);
    };
  }, [accessToken, csrfToken, dmThreadId, mode, queryClient, user?.id]);
  const dmSend = useMutation({
    mutationFn: async () => {
      const attachments = dmFiles.length ? await uploadFiles(dmFiles) : undefined;
      return postDmMessage(accessToken!, csrfToken!, dmThreadId!, { content: dmDraft.trim() || "Shared a file", attachments });
    },
    onSuccess: (data) => {
      setDmDraft("");
      setDmFiles([]);
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) => {
        const messages = current?.messages ?? [];
        return messages.some((msg) => msg.id === data.message.id) ? current : { messages: [...messages, data.message] };
      });
    },
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  // Editing / deleting your own DMs.
  const [dmEditing, setDmEditing] = useState<{ id: string; text: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // This forge's custom emoji, for :name: in messages, reactions and the picker.
  const emojiQuery = useQuery({
    queryKey: ["forge-emojis", selectedForgeId, accessToken],
    queryFn: () => listForgeEmojis(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
    staleTime: 60_000,
  });
  const emojiMap = useMemo(() => Object.fromEntries((emojiQuery.data?.emojis ?? []).map((emoji) => [emoji.name, emoji.imageUrl])), [emojiQuery.data]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  // This forge's stickers, for the sticker picker.
  const stickerQuery = useQuery({
    queryKey: ["forge-stickers", selectedForgeId, accessToken],
    queryFn: () => listForgeStickers(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
    staleTime: 60_000,
  });
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const sendSticker = async (sticker: { id: string; name: string; imageUrl: string }) => {
    if (!channelId) return;
    setStickerPickerOpen(false);
    if (timedOutUntil) {
      setStatus(`You're timed out until ${timedOutUntil.toLocaleTimeString()}.`);
      return;
    }
    const replyToId = replyTarget?.id;
    setReplyTarget(null);
    try {
      await sendMutation.mutateAsync({ channelId, content: "", optimisticId: `tmp-${crypto.randomUUID()}`, replyToId, stickerId: sticker.id, sticker });
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    }
  };
  useEffect(() => {
    if (!accessToken || !selectedForgeId) return;
    const socket = getSocket(accessToken);
    const onEmojis = (payload: { forgeId: string }) => {
      if (payload.forgeId === selectedForgeId) void queryClient.invalidateQueries({ queryKey: ["forge-emojis", selectedForgeId] });
    };
    socket.on("forge:emojis", onEmojis);
    return () => {
      socket.off("forge:emojis", onEmojis);
    };
  }, [accessToken, selectedForgeId, queryClient]);
  // Threads: the one open beside the channel, and the channel's thread list.
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  useEffect(() => {
    setOpenThreadId(null);
    setThreadsOpen(false);
  }, [channelId]);
  const threadsQuery = useQuery({
    queryKey: ["threads", channelId, accessToken],
    queryFn: () => listThreads(accessToken!, channelId!),
    enabled: Boolean(accessToken && channelId && threadsOpen),
  });
  const startThread = async (message: Message) => {
    if (!accessToken || !csrfToken) return;
    const suggested = plainText(message.content).replace(/\s+/g, " ").trim().slice(0, 60) || "New thread";
    const title = window.prompt("Name this thread", suggested);
    if (!title?.trim()) return;
    try {
      const result = await createThread(accessToken, csrfToken, { messageId: message.id, title: title.trim() });
      setOpenThreadId(result.thread.id);
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    }
  };
  const [dmConfirmDelete, setDmConfirmDelete] = useState<string | null>(null);
  const putDm = (message: DmMessage) =>
    queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) =>
      current ? { messages: current.messages.map((msg) => (msg.id === message.id ? message : msg)) } : current,
    );
  const dmEdit = useMutation({
    mutationFn: (input: { id: string; text: string }) => editDmMessage(accessToken!, csrfToken!, input.id, input.text),
    onSuccess: (data) => {
      putDm(data.message);
      setDmEditing(null);
    },
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  const dmDelete = useMutation({
    mutationFn: (id: string) => deleteDmMessage(accessToken!, csrfToken!, id),
    onSuccess: (_data, id) => {
      setDmConfirmDelete(null);
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) =>
        current ? { messages: current.messages.filter((msg) => msg.id !== id) } : current,
      );
    },
    onError: (error) => setStatus(getApiErrorMessage(error)),
  });
  const dmThread = dmThreadsQuery.data?.threads.find((thread) => thread.id === dmThreadId) ?? null;
  const dmLabel = (thread: DmThread) => (thread.isGroup ? thread.name ?? "Group" : thread.participants.find((entry) => entry.user.id !== user?.id)?.user.username ?? "Direct message");
  const dmBottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ block: "end" });
  }, [dmMessagesQuery.data?.messages.length]);

  // ---------------------------------------------------------------- render
  if (!user) return null;

  const visibleMessages = (messagesQuery.data?.messages ?? []).filter((msg) => !search.trim() || msg.content.toLowerCase().includes(search.trim().toLowerCase()) || (msg.author?.username ?? "").toLowerCase().includes(search.trim().toLowerCase()));
  const typingNames = channelId ? typing[channelId] ?? [] : [];

  const header = (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-gradient-to-r from-sky-500/[0.07] via-transparent to-violet-500/[0.07] px-4">
      {mode === "voice" ? (
        <>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Volume2 className="h-4 w-4" /></span>
          <span className="text-sm font-semibold text-white">{voiceChannel?.name ?? "Voice"}</span>
          <span className="text-xs text-slate-500">{voiceChannel?.type === "STAGE" ? "Stage" : "Voice channel"}</span>
        </>
      ) : mode === "dm" ? (
        <>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/15 text-pink-300"><AtSign className="h-4 w-4" /></span>
          <span className="text-sm font-semibold text-white">{dmThread ? dmLabel(dmThread) : "Direct messages"}</span>
        </>
      ) : (
        <>
          {channel?.type === "ANNOUNCEMENT" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300"><Megaphone className="h-4 w-4" /></span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300"><Hash className="h-4 w-4" /></span>
          )}
          <span className="text-sm font-semibold text-white">{channel?.name ?? (forgeQuery.isLoading ? "Loading..." : "No channel")}</span>
          {channel?.topic ? <span className="hidden truncate text-xs text-slate-500 md:inline">{channel.topic}</span> : null}
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        {mode === "channel" && channel ? (
          <div className="relative">
            <button type="button" onClick={() => setThreadsOpen((value) => !value)} title="Threads" aria-expanded={threadsOpen} className={cn("rounded-lg p-1.5 transition hover:bg-white/5", threadsOpen ? "text-violet-200" : "text-slate-400 hover:text-white")}>
              <MessagesSquare className="h-4 w-4" />
            </button>
            {threadsOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 rounded-xl border border-white/10 bg-[#0d1119] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Threads in #{channel.name}</p>
                {threadsQuery.isLoading ? (
                  <p className="px-2 py-2 text-xs text-slate-400">Loading...</p>
                ) : threadsQuery.data?.threads.length ? (
                  <ul className="max-h-72 overflow-y-auto">
                    {threadsQuery.data.threads.map((entry) => (
                      <li key={entry.id}>
                        <button type="button" onClick={() => { setOpenThreadId(entry.id); setThreadsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-white/5">
                          <MessagesSquare className={cn("h-3.5 w-3.5 shrink-0", entry.archived ? "text-slate-600" : "text-violet-300")} />
                          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">{entry.archived ? "archived" : `${entry.messageCount}`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-2 text-xs text-slate-400">No threads yet. Hover a message and choose the thread button to start one.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {mode === "channel" ? (
          <div className={cn("flex items-center", searchOpen ? "w-56" : "w-8")}>
            {searchOpen ? (
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input autoFocus aria-label="Search messages" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => !search && setSearchOpen(false)} placeholder="Search messages" className="h-8 w-full rounded-lg border border-white/10 bg-[#11151e] pl-7 pr-7 text-xs text-slate-100 outline-none focus:border-amber-400/60" />
                <button type="button" onClick={() => { setSearch(""); setSearchOpen(false); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" title="Close search"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setSearchOpen(true)} className={iconBtn} title="Search"><Search className="h-4 w-4" /></button>
            )}
          </div>
        ) : null}
        {mode === "channel" ? <button type="button" onClick={() => setPinsOpen((open) => !open)} className={cn(iconBtn, pinsOpen && "text-amber-200")} title="Pinned messages"><Pin className="h-4 w-4" /></button> : null}
        <button type="button" onClick={() => setMembersOpen((open) => !open)} className={cn(iconBtn, membersOpen && "text-amber-200")} title="Members"><Users className="h-4 w-4" /></button>
        {selectedForgeId ? <button type="button" onClick={() => setSettingsOpen(true)} className={iconBtn} title="Forge settings"><Settings2 className="h-4 w-4" /></button> : null}
      </div>
    </header>
  );

  return (
    // Fill the shell's content area edge to edge: undo its padding with negative margins and add it back to the height.
    // (A fixed 100dvh calc ignored the "Secure your account" banner and pushed the composer off-screen.)
    // contain:size stops the message history from setting the shell's minimum height; without it, on short
    // screens (phones, where the header and banner wrap) the panel grew past the bottom and hid the composer.
    <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0 [contain:size] md:-m-6 md:h-[calc(100%+3rem)]">
      <h1 className="sr-only">Chat</h1>
      {selectedForgeId ? (
        <ForgeSettingsPanel forgeId={selectedForgeId} open={settingsOpen} initialTab={isManageTab(requestedManage) ? requestedManage : undefined} onClose={() => setSettingsOpen(false)} onForgeGone={() => router.push("/app")} />
      ) : null}
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
      <PollComposer open={pollOpen} onClose={() => setPollOpen(false)} onSubmit={sendPoll} busy={sendMutation.isPending} />

      <div className="flex min-w-0 flex-1 flex-col bg-[#0a0d14]/80 backdrop-blur-sm">
        {header}

        {status ? (
          <div className="flex items-center justify-between border-b border-rose-400/30 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-100">
            {status}
            <button type="button" onClick={() => setStatus(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}

        {mode === "voice" ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
            {voiceSession && voiceSession.channelId === voiceChannel?.id ? (
              <div className="w-full max-w-2xl rounded-2xl border border-amber-500/20 bg-[#0d1119] p-4 text-slate-100">
                <VoiceRoomPanel members={forge?.members ?? []} />
              </div>
            ) : voiceSession ? (
              <div className="w-full max-w-2xl rounded-2xl border border-amber-500/20 bg-[#0d1119] p-6 text-center text-slate-100">
                <p className="text-sm text-slate-300">You are in <span className="font-semibold text-white">{voiceSession.channelName}</span>.</p>
                <div className="mt-3 flex justify-center gap-2">
                  {voiceChannel ? (
                    <button type="button" onClick={() => void joinVoice(voiceChannel)} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">
                      <Mic className="h-3.5 w-3.5" /> Switch to {voiceChannel.name}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => useVoiceStore.getState().leave()} className="rounded-lg border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-rose-400/50">Leave</button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300"><Radio className="h-7 w-7" /></span>
                <h2 className="nf-heading text-lg font-bold text-white">{voiceChannel?.name ?? "No voice channel"}</h2>
                <p className="mt-1 text-sm text-slate-400">{voiceChannel ? "Join to talk with your squad." : "This forge has no voice channels yet."}</p>
                {voiceChannel ? (
                  <button type="button" onClick={() => void joinVoice(voiceChannel)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">
                    <Mic className="h-4 w-4" /> Join voice
                  </button>
                ) : null}
                {voiceChannels.length > 1 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {voiceChannels.map((entry) => (
                      <Link key={entry.id} href={`/app/chat?forge=${selectedForgeId}&voice=${entry.id}`} className={cn("rounded-full border px-3 py-1 text-xs", entry.id === voiceChannel?.id ? "border-amber-400 text-amber-100" : "border-white/10 text-slate-300")}>{entry.name}</Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : mode === "dm" ? (
          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-56 shrink-0 border-r border-white/5 p-2 md:block">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Direct messages</p>
                <button type="button" onClick={() => setGroupOpen((open) => !open)} className={cn("text-slate-600 transition hover:text-amber-300", groupOpen && "text-amber-300")} title="New group"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              {groupOpen ? (
                <div className="mb-2 rounded-xl border border-amber-500/25 bg-[#0d1119] p-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">New group</p>
                  <input aria-label="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} placeholder="Group name" className="mb-2 h-8 w-full rounded-lg border border-white/10 bg-[#11151e] px-2 text-xs text-slate-100 outline-none focus:border-amber-400/60" />
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {friendsQuery.isLoading ? <p className="px-1 text-[11px] text-slate-500">Loading friends...</p> : null}
                    {friendOptions.map((friend) => {
                      const picked = groupMembers.has(friend.id);
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => setGroupMembers((current) => { const next = new Set(current); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next; })}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs", picked ? "bg-amber-500/10 text-amber-100" : "text-slate-300 hover:bg-white/5")}
                        >
                          <span className={cn("flex h-4 w-4 items-center justify-center rounded border", picked ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/20")}>{picked ? <Check className="h-3 w-3" /> : null}</span>
                          <span className="truncate">{friend.username}</span>
                        </button>
                      );
                    })}
                    {friendsQuery.data && friendOptions.length < 2 ? <p className="px-1 text-[11px] text-slate-500">You need at least two friends to start a group.</p> : null}
                  </div>
                  <button type="button" disabled={groupName.trim().length < 2 || groupMembers.size < 2 || groupMutation.isPending} onClick={() => groupMutation.mutate()} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-amber-400 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                    {groupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Create group ({groupMembers.size})
                  </button>
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {(dmThreadsQuery.data?.threads ?? []).map((thread) => (
                  <li key={thread.id}>
                    <Link href={`/app/chat?dm=${thread.id}`} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", thread.id === dmThreadId ? "bg-amber-500/10 text-amber-100" : "text-slate-300 hover:bg-white/5")}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">{initials(dmLabel(thread))}</span>
                      <span className={cn("min-w-0 flex-1 truncate", thread.unreadCount ? "font-semibold text-white" : "")}>{dmLabel(thread)}</span>
                      {thread.unreadCount && thread.id !== dmThreadId ? <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{thread.unreadCount}</span> : null}
                    </Link>
                  </li>
                ))}
                {!dmThreadsQuery.data?.threads.length && !dmThreadsQuery.isLoading ? <li className="px-2 text-xs text-slate-600">No conversations yet.</li> : null}
              </ul>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {dmThreadId ? (
                  <div className="space-y-1.5">
                    {(dmMessagesQuery.data?.messages ?? []).map((msg) => (
                      <div key={msg.id} className="group relative flex gap-3 rounded-[14px] px-3 py-2 hover:bg-slate-900/60">
                        {msg.author.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.author.avatar} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-semibold text-amber-100">{initials(msg.author.username)}</span>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-baseline gap-2 text-xs text-slate-400"><span className="text-sm font-semibold text-white">{msg.author.username}</span>{formatTime(msg.createdAt)}</p>
                          {dmEditing?.id === msg.id ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <input
                                autoFocus
                                value={dmEditing.text}
                                onChange={(event) => setDmEditing({ id: msg.id, text: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") setDmEditing(null);
                                  if (event.key === "Enter" && !event.shiftKey && dmEditing.text.trim()) {
                                    event.preventDefault();
                                    dmEdit.mutate({ id: msg.id, text: dmEditing.text.trim() });
                                  }
                                }}
                                maxLength={4000}
                                aria-label="Edit message"
                                className="h-8 min-w-[200px] flex-1 rounded-lg border border-amber-400/50 bg-[#11151e] px-2 text-sm text-slate-100 outline-none"
                              />
                              <span className="text-[10px] text-slate-500">Enter to save · Esc to cancel</span>
                            </div>
                          ) : (
                            <>
                              {msg.attachments?.length && msg.content === "Shared a file" ? null : <RichText content={msg.content} />}
                              {msg.edited ? <span className="text-[10px] text-slate-500">(edited)</span> : null}
                              {msg.attachments?.length ? <MessageAttachments urls={msg.attachments} /> : null}
                              {!msg.attachments?.length && firstLink(msg.content) ? <LinkPreviewCard url={firstLink(msg.content)!} /> : null}
                            </>
                          )}
                        </div>
                        {msg.authorId !== user?.id ? (
                          <div className="absolute right-2 top-1 hidden items-center gap-1 rounded-lg border border-white/10 bg-[#0d1119] p-0.5 group-hover:flex group-focus-within:flex">
                            <button type="button" title={saved.isSaved("DM", msg.id) ? "Remove from saved" : "Save for later"} aria-label={saved.isSaved("DM", msg.id) ? "Remove from saved" : "Save for later"} className="rounded p-1 text-slate-400 hover:text-amber-200" onClick={() => saved.setSaved("DM", msg.id, !saved.isSaved("DM", msg.id))}>
                              {saved.isSaved("DM", msg.id) ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" /> : <Bookmark className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" title="Report" className="rounded p-1 text-slate-400 hover:text-rose-300" onClick={() => setReportTarget({ kind: "DM", messageId: msg.id, authorName: msg.author.username, content: msg.content })}>
                              <Flag className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                        {msg.authorId === user?.id && dmEditing?.id !== msg.id ? (
                          <div className="absolute right-2 top-1 hidden items-center gap-1 rounded-lg border border-white/10 bg-[#0d1119] p-0.5 group-hover:flex group-focus-within:flex">
                            <button type="button" title={saved.isSaved("DM", msg.id) ? "Remove from saved" : "Save for later"} aria-label={saved.isSaved("DM", msg.id) ? "Remove from saved" : "Save for later"} className="rounded p-1 text-slate-400 hover:text-amber-200" onClick={() => saved.setSaved("DM", msg.id, !saved.isSaved("DM", msg.id))}>
                              {saved.isSaved("DM", msg.id) ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" /> : <Bookmark className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" title="Edit" className="rounded p-1 text-slate-400 hover:text-amber-200" onClick={() => { setDmEditing({ id: msg.id, text: plainText(msg.content) }); setDmConfirmDelete(null); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {dmConfirmDelete === msg.id ? (
                              <button type="button" className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20" disabled={dmDelete.isPending} onClick={() => dmDelete.mutate(msg.id)}>
                                Delete?
                              </button>
                            ) : (
                              <button type="button" title="Delete" className="rounded p-1 text-slate-400 hover:text-rose-300" onClick={() => setDmConfirmDelete(msg.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {!dmMessagesQuery.data?.messages.length && !dmMessagesQuery.isLoading ? <p className="text-sm text-slate-500">Say hi.</p> : null}
                    <div ref={dmBottomRef} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Pick a conversation, or message someone from their profile or the Friends page.</p>
                )}
              </div>
              {dmThreadId ? (
                <div className="border-t border-white/5 p-3">
                  {dmFiles.length ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {dmFiles.map((file, index) => (
                        <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#11151e] px-2 py-1 text-[11px] text-slate-300">
                          <Paperclip className="h-3 w-3" /> {file.name}
                          <button type="button" onClick={() => setDmFiles((current) => current.filter((_, i) => i !== index))} className="text-slate-500 hover:text-rose-300" aria-label={`Remove ${file.name}`}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11151e] px-3 py-2">
                    <input ref={dmFileInput} type="file" multiple className="hidden" onChange={(event) => { setDmFiles((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 8)); event.target.value = ""; }} />
                    <button type="button" onClick={() => dmFileInput.current?.click()} className="text-slate-500 hover:text-amber-200" title="Attach files" aria-label="Attach files"><Paperclip className="h-4 w-4" /></button>
                    <div className="relative">
                      <button type="button" onClick={() => setDmEmojiOpen((value) => !value)} className="text-slate-500 hover:text-amber-200" title="Emoji" aria-label="Emoji" aria-expanded={dmEmojiOpen}><Smile className="h-4 w-4" /></button>
                      {dmEmojiOpen ? (
                        <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 grid w-64 grid-cols-8 gap-0.5 rounded-xl border border-white/10 bg-[#0d1119] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                          {["😀", "😂", "😅", "😍", "😎", "🤔", "😭", "😡", "👍", "👎", "🙏", "👏", "🔥", "💯", "🎉", "❤️", "🎮", "🕹️", "🏆", "⚔️", "🛡️", "💀", "👀", "✅"].map((emoji) => (
                            <button key={emoji} type="button" className="h-7 w-7 rounded text-lg hover:bg-white/10" onClick={() => { setDmDraft((current) => `${current}${emoji}`); setDmEmojiOpen(false); }}>{emoji}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <input value={dmDraft} onChange={(event) => setDmDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (dmDraft.trim() || dmFiles.length) dmSend.mutate(); } }} placeholder={`Message ${dmThread ? dmLabel(dmThread) : ""}`} aria-label="Message" className="h-8 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
                    <button type="button" onClick={() => dmSend.mutate()} disabled={(!dmDraft.trim() && !dmFiles.length) || dmSend.isPending} className="rounded-lg bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 p-2 text-slate-950 disabled:opacity-40" title="Send" aria-label="Send">{dmSend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {messagesQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading messages...</p>
              ) : channel?.type === "FORUM" ? (
                <ForumView channel={channel} emojis={emojiMap} onOpenPost={(threadId) => setOpenThreadId(threadId)} />
              ) : channel ? (
                <>
                  {!messagesQuery.data?.nextCursor && !search ? (
                    <div className="mb-4 border-b border-white/5 pb-4">
                      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300"><Hash className="h-7 w-7" /></span>
                      <h2 className="nf-heading text-lg font-bold text-white">Welcome to #{channel.name}</h2>
                      <p className="text-sm text-slate-400">{channel.topic || `This is the start of #${channel.name}.`}</p>
                    </div>
                  ) : null}
                  <MessageList
                    messages={visibleMessages}
                    selfId={user.id}
                    canModerate={canModerate}
                    members={forge?.members ?? []}
                    roles={forge?.roles ?? []}
                    ownerId={forge?.ownerId ?? ""}
                    hasOlder={Boolean(messagesQuery.data?.nextCursor) && !search}
                    loadingOlder={loadingOlder}
                    onLoadOlder={() => void loadOlder()}
                    onReply={(message) => setReplyTarget(message)}
                    onEdit={async (messageId, content) => { await editMutation.mutateAsync({ messageId, content }); }}
                    onDelete={async (messageId) => { await deleteMutation.mutateAsync(messageId); }}
                    onReact={(messageId, emoji) => reactMutation.mutate({ messageId, emoji })}
                    onPin={(messageId, pinned) => pinMutation.mutate({ messageId, pinned })}
                    onReport={(message) => setReportTarget({ kind: "CHANNEL", messageId: message.id, authorName: message.author?.username ?? "this member", content: message.content })}
                    onStartThread={(message) => void startThread(message)}
                    emojis={emojiMap}
                    onOpenThread={(threadId) => setOpenThreadId(threadId)}
                    lastReadAt={unreadSince?.channelId === channelId ? unreadSince.at : null}
                  />
                  {pinsOpen ? (
                    <div className="absolute right-3 top-14 z-30 w-[min(420px,calc(100%-24px))] overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200"><Pin className="h-3.5 w-3.5" /> Pinned messages</p>
                        <button type="button" onClick={() => setPinsOpen(false)} className="text-slate-500 hover:text-white" title="Close"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                        {pinsQuery.isLoading ? <p className="p-2 text-xs text-slate-400">Loading...</p> : null}
                        {pinsQuery.data?.messages.length ? (
                          pinsQuery.data.messages.map((pinned) => (
                            <div key={pinned.id} className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                              <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-200">{pinned.botName ?? pinned.author?.username ?? "Unknown"}</span> · {new Date(pinned.createdAt).toLocaleDateString()}</p>
                              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-slate-100">{plainText(pinned.content)}</p>
                              {canModerate ? <button type="button" onClick={() => pinMutation.mutate({ messageId: pinned.id, pinned: false })} className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 hover:text-rose-300">Unpin</button> : null}
                            </div>
                          ))
                        ) : pinsQuery.data ? (
                          <p className="p-2 text-xs text-slate-500">No pinned messages. Moderators can pin from a message&apos;s hover menu.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageSquare className="mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-400">{forge ? "This forge has no text channels yet." : "Join or create a forge to start chatting."}</p>
                  <Link href="/app/server" className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-300">Community</Link>
                </div>
              )}
            </div>

            {channel && channel.type !== "FORUM" ? (
              <div className="shrink-0 border-t border-white/5 px-4 pb-3 pt-2">
                <div className="mb-1 h-4 text-[11px] text-amber-200">
                  {typingNames.length ? `${typingNames.slice(0, 3).join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing...` : null}
                </div>
                {replyTarget ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-1.5 text-xs text-amber-100">
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-amber-300">Replying to</span>
                    <span className="shrink-0 font-semibold">{replyTarget.botName ?? replyTarget.author?.username ?? "message"}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{plainText(replyTarget.content)}</span>
                    <button type="button" onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-white" title="Cancel reply"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : null}
                {pendingFiles.length ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {pendingFiles.map((file) => (
                      <span key={file.name} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#11151e] px-2 py-0.5 text-[11px] text-slate-200">
                        <Paperclip className="h-3 w-3" /> {file.name}
                        <button type="button" onClick={() => setPendingFiles((current) => current.filter((entry) => entry !== file))} className="text-slate-500 hover:text-white" title="Remove"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="relative">
                  {mentionSuggestions.length ? (
                    <div className="absolute inset-x-0 bottom-[calc(100%+0.4rem)] z-20 rounded-xl border border-amber-500/25 bg-[#0d1119] p-1.5 shadow-xl">
                      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Members</p>
                      {mentionSuggestions.map((member) => (
                        <button key={member.user.id} type="button" onClick={() => applyMention(member.user.username)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/5">
                          {member.user.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-amber-100">{member.user.username.slice(0, 2).toUpperCase()}</span>
                          )}
                          <span className="font-semibold text-white">@{member.user.username}</span>
                          <span className={cn("ml-auto h-2 w-2 rounded-full", member.user.status === "ONLINE" ? "bg-emerald-400" : member.user.status === "IDLE" ? "bg-yellow-300" : member.user.status === "DND" ? "bg-rose-400" : "bg-slate-600")} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {slashSuggestions.length ? (
                    <div className="absolute inset-x-0 bottom-[calc(100%+0.4rem)] z-20 rounded-xl border border-amber-500/25 bg-[#0d1119] p-1.5 shadow-xl">
                      {slashSuggestions.map((command) => (
                        <button key={command.id} type="button" onClick={() => setDraft(`/${command.name} `)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/5">
                          <span><span className="font-semibold text-amber-100">/{command.name}</span> <span className="text-slate-400">{command.description ?? ""}</span></span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{command.botName}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {timedOutUntil ? (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2.5 text-xs text-rose-100">
                      <Clock className="h-4 w-4 shrink-0 text-rose-300" />
                      <span>
                        You&apos;re timed out until {timedOutUntil.toLocaleString()}. You can read, but can&apos;t send messages, react or join voice.
                      </span>
                    </div>
                  ) : channel.type === "ANNOUNCEMENT" && !canModerate ? (
                    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#11151e] px-3 py-2.5 text-xs text-slate-500">
                      <Megaphone className="h-4 w-4 text-amber-300" /> Only moderators can post in #{channel.name}.
                    </div>
                  ) : (
                  <>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11151e] px-3 py-2 focus-within:border-violet-400/60 focus-within:shadow-[0_0_0_3px_rgba(167,139,250,0.14),0_0_24px_rgba(56,189,248,0.12)] transition">
                    <input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => setPendingFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} />
                    <button type="button" onClick={() => fileInput.current?.click()} className="text-slate-500 hover:text-amber-200" title="Attach files"><Paperclip className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setPollOpen(true)} className="text-slate-500 hover:text-violet-200" title="Create a poll" aria-label="Create a poll"><BarChart3 className="h-4 w-4" /></button>
                    <div className="relative">
                      <button type="button" onClick={() => setStickerPickerOpen((value) => !value)} className="text-slate-500 hover:text-amber-200" title="Stickers" aria-label="Stickers" aria-expanded={stickerPickerOpen}><Sticker className="h-4 w-4" /></button>
                      {stickerPickerOpen ? (
                        <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-72 rounded-xl border border-white/10 bg-[#0d1119] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">{forge?.name ?? "This forge"} stickers</p>
                          {stickerQuery.data?.stickers.length ? (
                            <div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto">
                              {stickerQuery.data.stickers.map((sticker) => (
                                <button key={sticker.id} type="button" onClick={() => void sendSticker(sticker)} title={sticker.description || sticker.name} aria-label={`Send sticker ${sticker.name}`} className="rounded-lg p-1 hover:bg-white/10">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={sticker.imageUrl} alt="" className="mx-auto h-16 w-16 object-contain" style={{ display: "block" }} />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="px-1 py-3 text-xs text-slate-400">No stickers yet. Server managers can add them in server settings, under Stickers.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative">
                      <button type="button" onClick={() => setEmojiPickerOpen((value) => !value)} className="text-slate-500 hover:text-amber-200" title="Emoji" aria-expanded={emojiPickerOpen}><Smile className="h-4 w-4" /></button>
                      {emojiPickerOpen ? (
                        <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-64 rounded-xl border border-white/10 bg-[#0d1119] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                          <div className="grid grid-cols-8 gap-0.5">
                            {["😀", "😂", "😅", "😍", "😎", "🤔", "😭", "😡", "👍", "👎", "🙏", "👏", "🔥", "💯", "🎉", "❤️", "🎮", "🕹️", "🏆", "⚔️", "🛡️", "💀", "👀", "✅"].map((emoji) => (
                              <button key={emoji} type="button" className="h-7 w-7 rounded text-lg hover:bg-white/10" onClick={() => { setDraft((current) => `${current}${emoji}`); setEmojiPickerOpen(false); }}>{emoji}</button>
                            ))}
                          </div>
                          {Object.keys(emojiMap).length ? (
                            <>
                              <p className="mb-1 mt-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">{forge?.name ?? "This forge"}</p>
                              <div className="grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
                                {Object.keys(emojiMap).map((name) => (
                                  <button key={name} type="button" title={`:${name}:`} className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10" onClick={() => { setDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}:${name}: `); setEmojiPickerOpen(false); }}>
                                    <CustomEmoji name={name} emojis={emojiMap} size={20} />
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <input
                      value={draft}
                      onChange={(event) => onDraftChange(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.key === "Tab" || event.key === "Enter") && mentionSuggestions.length) {
                          event.preventDefault();
                          applyMention(mentionSuggestions[0].user.username);
                          return;
                        }
                        if (event.key === "Tab" && slashSuggestions.length) {
                          event.preventDefault();
                          setDraft(`/${slashSuggestions[0].name} `);
                          return;
                        }
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={`Message #${channel.name}`}
                      aria-label={`Message #${channel.name}`}
                      className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                    <button type="button" onClick={() => void send()} disabled={(!draft.trim() && !pendingFiles.length) || uploading || sendMutation.isPending} className="rounded-lg bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 p-2 text-slate-950 shadow-[0_0_14px_rgba(251,138,60,0.35)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none" title="Send">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                  {channel.slowmodeSeconds ? (
                    <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-slate-500" aria-live="polite">
                      <Timer className="h-3 w-3" />
                      {skipsSlowmode
                        ? `Slowmode is on (${channel.slowmodeSeconds}s). You're exempt.`
                        : (slowUntil[channel.id] ?? 0) > clock
                          ? `Slowmode: you can send again in ${Math.ceil(((slowUntil[channel.id] ?? 0) - clock) / 1000)}s`
                          : `Slowmode is on: one message every ${channel.slowmodeSeconds}s`}
                    </p>
                  ) : null}
                  </>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {openThreadId && channelId && mode === "channel" ? (
        <div className="fixed inset-0 z-40 lg:static lg:z-auto lg:flex">
          <ThreadPanel threadId={openThreadId} channelId={channelId} canModerate={canModerate} onClose={() => setOpenThreadId(null)} emojis={emojiMap} />
        </div>
      ) : membersOpen && forge && mode !== "dm" ? (
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#0b0e17]/80 p-3 backdrop-blur-xl lg:block">
          <MemberList members={forge.members} roles={forge.roles} ownerId={forge.ownerId} selfId={user.id} />
        </aside>
      ) : null}
    </div>
  );
}
