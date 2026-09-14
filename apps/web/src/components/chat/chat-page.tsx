"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Hash, Loader2, Megaphone, MessageSquare, Mic, Paperclip, Pin, Radio, Search, Send, Settings2, Users, Volume2, Wrench, X } from "lucide-react";
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
  markChannelRead,
  postDmMessage,
  postMessage,
  requestVoiceToken,
  toggleReaction,
  updateVoiceState,
  listPinnedMessages,
  pinMessage,
  type Channel,
  type DmMessage,
  type DmThread,
  type Message,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useVoiceStore } from "@/store/voice-store";
import { MessageList } from "@/components/chat/message-list";
import { MemberList } from "@/components/chat/member-list";
import { ForgeSettingsPanel } from "@/components/chat/forge-settings-panel";
import { VoiceRoomPanel } from "@/components/chat/voice-room-panel";


const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-amber-200";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading chat...</p>}>
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
  const requestedDm = searchParams?.get("dm");

  const [channelId, setChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<string | null>(null);
  const voiceSession = useVoiceStore((state) => state.session);
  const joinVoiceStore = useVoiceStore((state) => state.join);
  const [dmDraft, setDmDraft] = useState("");
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
  const textChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT"), [forge]);
  const voiceChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "VOICE" || channel.type === "STAGE"), [forge]);

  const accessQuery = useQuery({
    queryKey: ["forge-permissions", selectedForgeId, accessToken],
    queryFn: () => getForgePermissions(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });
  const canModerate = Boolean(accessQuery.data?.isOwner || accessQuery.data?.permissions.moderateChat);

  // Resolve the active text channel from the URL or fall back to the first one.
  useEffect(() => {
    if (!textChannels.length) return;
    const wanted = requestedChannel && textChannels.some((channel) => channel.id === requestedChannel) ? requestedChannel : null;
    const next = wanted ?? (channelId && textChannels.some((channel) => channel.id === channelId) ? channelId : textChannels[0].id);
    if (next !== channelId) setChannelId(next);
  }, [textChannels, requestedChannel, channelId]);

  const mode: "voice" | "dm" | "channel" = requestedVoice ? "voice" : requestedDm ? "dm" : "channel";
  const channel = textChannels.find((entry) => entry.id === channelId) ?? null;
  const voiceChannel = requestedVoice && requestedVoice !== "1" ? voiceChannels.find((entry) => entry.id === requestedVoice) ?? null : voiceChannels[0] ?? null;

  // Mark read + tell the shell which channel is open.
  useEffect(() => {
    if (mode !== "channel" || !channelId || !selectedForgeId) return;
    setActiveChannelId(channelId);
    clearChannel(selectedForgeId, channelId);
    if (accessToken && csrfToken) void markChannelRead(accessToken, csrfToken, channelId).catch(() => undefined);
    setReplyTarget(null);
    setSearch("");
  }, [mode, channelId, selectedForgeId, accessToken, csrfToken, setActiveChannelId, clearChannel]);

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
      if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
      urls.push(presign.fileUrl);
    }
    return urls;
  };

  const sendMutation = useMutation({
    mutationFn: (payload: { channelId: string; content: string; optimisticId: string; attachments?: string[]; replyToId?: string }) => postMessage(accessToken!, csrfToken!, payload),
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
    const content = draft.trim() || "Shared a file";
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
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------------------------- voice
  const joinVoice = async (target: Channel) => {
    if (!accessToken || !csrfToken) return;
    try {
      const token = await requestVoiceToken(accessToken, csrfToken, target.id);
      // The engine in the app shell runs the call, so it keeps going when you leave this page.
      joinVoiceStore({ ...token, channelId: target.id, channelName: target.name, forgeId: forge?.id ?? null });
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
    socket.on("connect", rejoin);
    const onDm = (payload: { threadId: string; message: DmMessage }) => {
      if (payload.threadId !== dmThreadId) return;
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) => {
        const messages = current?.messages ?? [];
        return messages.some((msg) => msg.id === payload.message.id) ? current : { messages: [...messages, payload.message] };
      });
    };
    socket.on("dm:message", onDm);
    return () => {
      socket.emit("dm:leave", dmThreadId);
      socket.off("connect", rejoin);
      socket.off("dm:message", onDm);
    };
  }, [accessToken, dmThreadId, mode, queryClient]);
  const dmSend = useMutation({
    mutationFn: () => postDmMessage(accessToken!, csrfToken!, dmThreadId!, { content: dmDraft.trim() }),
    onSuccess: (data) => {
      setDmDraft("");
      queryClient.setQueryData<{ messages: DmMessage[] }>(["dm-messages", dmThreadId, accessToken], (current) => {
        const messages = current?.messages ?? [];
        return messages.some((msg) => msg.id === data.message.id) ? current : { messages: [...messages, data.message] };
      });
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
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-amber-500/15 px-4">
      {mode === "voice" ? (
        <>
          <Volume2 className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-semibold text-white">{voiceChannel?.name ?? "Voice"}</span>
          <span className="text-xs text-slate-500">{voiceChannel?.type === "STAGE" ? "Stage" : "Voice channel"}</span>
        </>
      ) : mode === "dm" ? (
        <>
          <AtSign className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-semibold text-white">{dmThread ? dmLabel(dmThread) : "Direct messages"}</span>
        </>
      ) : (
        <>
          {channel?.type === "ANNOUNCEMENT" ? <Megaphone className="h-4 w-4 text-amber-300" /> : <Hash className="h-4 w-4 text-amber-300" />}
          <span className="text-sm font-semibold text-white">{channel?.name ?? (forgeQuery.isLoading ? "Loading..." : "No channel")}</span>
          {channel?.topic ? <span className="hidden truncate text-xs text-slate-500 md:inline">{channel.topic}</span> : null}
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        {mode === "channel" ? (
          <div className={cn("flex items-center", searchOpen ? "w-56" : "w-8")}>
            {searchOpen ? (
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => !search && setSearchOpen(false)} placeholder="Search messages" className="h-8 w-full rounded-lg border border-white/10 bg-[#11151e] pl-7 pr-7 text-xs text-slate-100 outline-none focus:border-amber-400/60" />
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
        <Link href={selectedForgeId ? `/app/forge-ops?forge=${selectedForgeId}` : "/app/forge-ops"} className={iconBtn} title="Forge ops: bots, invites, campaigns"><Wrench className="h-4 w-4" /></Link>
      </div>
    </header>
  );

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 md:-m-6">
      {selectedForgeId ? (
        <ForgeSettingsPanel forgeId={selectedForgeId} open={settingsOpen} onClose={() => setSettingsOpen(false)} onForgeGone={() => router.push("/app")} />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-[#0a0d14]">
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
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Direct messages</p>
              <ul className="space-y-0.5">
                {(dmThreadsQuery.data?.threads ?? []).map((thread) => (
                  <li key={thread.id}>
                    <Link href={`/app/chat?dm=${thread.id}`} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", thread.id === dmThreadId ? "bg-amber-500/10 text-amber-100" : "text-slate-300 hover:bg-white/5")}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">{initials(dmLabel(thread))}</span>
                      <span className="truncate">{dmLabel(thread)}</span>
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
                      <div key={msg.id} className="flex gap-3 rounded-[14px] px-3 py-2 hover:bg-slate-900/60">
                        {msg.author.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.author.avatar} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-semibold text-amber-100">{initials(msg.author.username)}</span>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-baseline gap-2 text-xs text-slate-400"><span className="text-sm font-semibold text-white">{msg.author.username}</span>{formatTime(msg.createdAt)}</p>
                          <p className="whitespace-pre-wrap break-words text-sm text-slate-100">{msg.content}</p>
                        </div>
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
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11151e] px-3 py-2">
                    <input value={dmDraft} onChange={(event) => setDmDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (dmDraft.trim()) dmSend.mutate(); } }} placeholder={`Message ${dmThread ? dmLabel(dmThread) : ""}`} className="h-8 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
                    <button type="button" onClick={() => dmSend.mutate()} disabled={!dmDraft.trim() || dmSend.isPending} className="rounded-lg bg-amber-400 p-2 text-slate-950 disabled:opacity-40" title="Send"><Send className="h-4 w-4" /></button>
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
                              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-slate-100">{pinned.content}</p>
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

            {channel ? (
              <div className="shrink-0 border-t border-white/5 px-4 pb-3 pt-2">
                <div className="mb-1 h-4 text-[11px] text-amber-200">
                  {typingNames.length ? `${typingNames.slice(0, 3).join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing...` : null}
                </div>
                {replyTarget ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-1.5 text-xs text-amber-100">
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-amber-300">Replying to</span>
                    <span className="shrink-0 font-semibold">{replyTarget.botName ?? replyTarget.author?.username ?? "message"}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{replyTarget.content}</span>
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
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11151e] px-3 py-2 focus-within:border-amber-400/50">
                    <input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => setPendingFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} />
                    <button type="button" onClick={() => fileInput.current?.click()} className="text-slate-500 hover:text-amber-200" title="Attach files"><Paperclip className="h-4 w-4" /></button>
                    <input
                      value={draft}
                      onChange={(event) => onDraftChange(event.target.value)}
                      onKeyDown={(event) => {
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
                      className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                    <button type="button" onClick={() => void send()} disabled={(!draft.trim() && !pendingFiles.length) || uploading || sendMutation.isPending} className="rounded-lg bg-amber-400 p-2 text-slate-950 transition hover:bg-amber-300 disabled:opacity-40" title="Send">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {membersOpen && forge && mode !== "dm" ? (
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-amber-500/15 bg-[#0b0e15] p-3 lg:block">
          <MemberList members={forge.members} roles={forge.roles} ownerId={forge.ownerId} selfId={user.id} onSelectMember={(member) => router.push(`/app/profile?user=${member.userId}`)} />
        </aside>
      ) : null}
    </div>
  );
}
