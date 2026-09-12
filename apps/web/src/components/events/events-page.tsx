"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Plus, Trophy, Users, X, Play, Crown, Trash2 } from "lucide-react";
import {
  createEvent,
  deleteEvent,
  getEvent,
  leaveEvent,
  listEvents,
  listForges,
  reportMatch,
  rsvpEvent,
  startEvent,
  type BracketMatch,
  type VexoraEvent,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

type Scope = "upcoming" | "live" | "past";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60 [color-scheme:dark]";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { h: 0, m: 0, s: 0, past: true };
  return { h: Math.floor(diff / 3_600_000), m: Math.floor((diff % 3_600_000) / 60_000), s: Math.floor((diff % 60_000) / 1000), past: false };
}

function participantName(event: VexoraEvent, userId: string | null) {
  if (!userId) return "TBD";
  return event.participants?.find((entry) => entry.userId === userId)?.user.username ?? "Player";
}

function roundLabel(index: number, total: number) {
  if (index === total - 1) return "Finals";
  if (index === total - 2) return "Semi Finals";
  if (index === total - 3) return "Quarter Finals";
  return `Round ${index + 1}`;
}

export function EventsPage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["events", scope, accessToken],
    queryFn: () => listEvents(accessToken!, { scope }),
    enabled: Boolean(accessToken),
  });
  const upcomingAllQuery = useQuery({
    queryKey: ["events", "upcoming", accessToken],
    queryFn: () => listEvents(accessToken!, { scope: "upcoming" }),
    enabled: Boolean(accessToken),
  });
  const liveQuery = useQuery({
    queryKey: ["events", "live", accessToken],
    queryFn: () => listEvents(accessToken!, { scope: "live" }),
    enabled: Boolean(accessToken),
  });
  const activeEventQuery = useQuery({
    queryKey: ["events", "detail", activeEventId, accessToken],
    queryFn: () => getEvent(accessToken!, activeEventId!),
    enabled: Boolean(accessToken && activeEventId),
  });

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["events"] });
    socket.on("event:changed", refresh);
    return () => {
      socket.off("event:changed", refresh);
    };
  }, [accessToken, queryClient]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["events"] });

  const rsvpMutation = useMutation({
    mutationFn: (input: { eventId: string; status: "GOING" | "INTERESTED" }) => rsvpEvent(accessToken!, csrfToken!, input.eventId, input.status),
    onSuccess: invalidate,
    onError: (error) => setNotice(errorText(error)),
  });
  const leaveMutation = useMutation({
    mutationFn: (eventId: string) => leaveEvent(accessToken!, csrfToken!, eventId),
    onSuccess: invalidate,
    onError: (error) => setNotice(errorText(error)),
  });
  const startMutation = useMutation({
    mutationFn: (eventId: string) => startEvent(accessToken!, csrfToken!, eventId),
    onSuccess: () => {
      setScope("live");
      void invalidate();
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteEvent(accessToken!, csrfToken!, eventId),
    onSuccess: () => {
      setActiveEventId(null);
      void invalidate();
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const matchMutation = useMutation({
    mutationFn: (input: { eventId: string; round: number; match: number; winnerUserId: string }) =>
      reportMatch(accessToken!, csrfToken!, input.eventId, input),
    onSuccess: invalidate,
    onError: (error) => setNotice(errorText(error)),
  });

  const events = eventsQuery.data?.events ?? [];
  const calendarEvents = useMemo(() => [...(upcomingAllQuery.data?.events ?? []), ...(liveQuery.data?.events ?? [])], [upcomingAllQuery.data, liveQuery.data]);
  const liveTournament = liveQuery.data?.events.find((event) => event.type === "TOURNAMENT") ?? null;
  const nextTournament = upcomingAllQuery.data?.events.find((event) => event.type === "TOURNAMENT") ?? null;
  const spotlight = liveTournament ?? nextTournament;
  const countdown = useCountdown(spotlight && spotlight.status === "SCHEDULED" ? spotlight.startsAt : null);
  const bracketEvent = useMemo(
    () => activeEventQuery.data?.event ?? [...events, ...calendarEvents].find((event) => event.id === activeEventId) ?? liveTournament ?? null,
    [activeEventQuery.data, events, calendarEvents, activeEventId, liveTournament],
  );

  const visibleEvents = selectedDay ? events.filter((event) => sameDay(new Date(event.startsAt), selectedDay)) : events;

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  const isMine = (event: VexoraEvent) => event.participants?.some((entry) => entry.userId === user?.id);
  const canManage = (event: VexoraEvent) => event.createdById === user?.id;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="nf-heading text-xl font-bold text-white">Events &amp; Tournaments</h1>
            <p className="text-xs text-slate-400">Compete. Win. Dominate. Every event and bracket across your forges.</p>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} className={goldBtn}>
            <Plus className="h-3.5 w-3.5" /> Create event
          </button>
        </div>

        {notice ? (
          <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {notice}
            <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}

        <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
          {(["upcoming", "live", "past"] as Scope[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => {
                setScope(entry);
                setSelectedDay(null);
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                scope === entry ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              {entry}
              {entry === "live" && liveQuery.data?.events.length ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[9px] text-white">{liveQuery.data.events.length}</span> : null}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Calendar */}
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md p-1 text-slate-400 hover:text-white" title="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md p-1 text-slate-400 hover:text-white" title="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-slate-500">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthCells.map((day) => {
                const inMonth = day.getMonth() === month.getMonth();
                const hasEvent = calendarEvents.some((event) => sameDay(new Date(event.startsAt), day));
                const selected = selectedDay ? sameDay(day, selectedDay) : false;
                const today = sameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(selected ? null : day)}
                    className={`relative flex h-8 items-center justify-center rounded-md text-xs transition ${
                      selected ? "bg-amber-400 text-slate-950" : today ? "border border-amber-400/60 text-amber-200" : inMonth ? "text-slate-200 hover:bg-white/5" : "text-slate-600"
                    }`}
                  >
                    {day.getDate()}
                    {hasEvent ? <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-slate-950" : "bg-amber-400"}`} /> : null}
                  </button>
                );
              })}
            </div>
            {selectedDay ? (
              <button type="button" onClick={() => setSelectedDay(null)} className="mt-3 text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200">Show all {scope}</button>
            ) : null}
          </div>

          {/* Event list */}
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={sectionTitle}>{selectedDay ? selectedDay.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : `${scope} events`}</h2>
              <span className="text-[11px] text-slate-500">{visibleEvents.length} listed</span>
            </div>
            {eventsQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading events...</p>
            ) : visibleEvents.length ? (
              <ul className="space-y-2">
                {visibleEvents.map((event) => {
                  const mine = isMine(event);
                  const going = event.participants?.filter((entry) => entry.status !== "INTERESTED").length ?? 0;
                  return (
                    <li key={event.id} className={`rounded-xl border p-3 transition ${activeEventId === event.id ? "border-amber-400/60 bg-amber-500/5" : "border-white/5 bg-[#11151e]"}`}>
                      <div className="flex gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-[radial-gradient(circle,rgba(230,179,37,0.3),transparent_70%)] text-amber-300">
                          {event.type === "TOURNAMENT" ? <Trophy className="h-6 w-6" /> : <Calendar className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setActiveEventId(event.id)} className="truncate text-left text-sm font-semibold text-white hover:text-amber-200">{event.title}</button>
                            {event.status === "LIVE" ? <span className="rounded bg-rose-500 px-1.5 text-[9px] font-bold uppercase text-white">Live</span> : null}
                            {event.status === "COMPLETED" ? <span className="rounded bg-slate-700 px-1.5 text-[9px] font-bold uppercase text-white">Done</span> : null}
                            <span className="rounded border border-white/10 px-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-400">{event.type === "TOURNAMENT" ? "Tournament" : "Event"}</span>
                          </div>
                          <p className="truncate text-[11px] text-slate-400">{[event.game, event.forge?.name ?? "Global"].filter(Boolean).join(" · ")}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3 text-amber-300" /> {new Date(event.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-amber-300" /> {going}{event.maxParticipants ? `/${event.maxParticipants}` : ""} going</span>
                            {event.prizePool ? <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-300" /> {event.prizePool}</span> : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {event.status === "SCHEDULED" ? (
                            mine ? (
                              <button type="button" className={ghostBtn} disabled={leaveMutation.isPending} onClick={() => leaveMutation.mutate(event.id)}>Leave</button>
                            ) : (
                              <button type="button" className={goldBtn} disabled={rsvpMutation.isPending} onClick={() => rsvpMutation.mutate({ eventId: event.id, status: "GOING" })}>Join</button>
                            )
                          ) : event.status === "LIVE" ? (
                            <button type="button" className={ghostBtn} onClick={() => setActiveEventId(event.id)}>View</button>
                          ) : null}
                          {canManage(event) && event.status === "SCHEDULED" ? (
                            <div className="flex gap-1">
                              <button type="button" title="Start now" className="rounded-md border border-white/10 p-1.5 text-emerald-300 hover:border-emerald-400/50" disabled={startMutation.isPending} onClick={() => startMutation.mutate(event.id)}><Play className="h-3.5 w-3.5" /></button>
                              <button type="button" title="Delete" className="rounded-md border border-white/10 p-1.5 text-rose-300 hover:border-rose-400/50" disabled={deleteMutation.isPending} onClick={() => window.confirm(`Delete "${event.title}"?`) && deleteMutation.mutate(event.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{selectedDay ? "Nothing scheduled that day." : scope === "upcoming" ? "No upcoming events. Create one to get the squad together." : `No ${scope} events.`}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right column */}
      <aside className="space-y-4">
        <div className={`${panel} relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(230,179,37,0.25),transparent_50%)]" />
          <div className="relative">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {liveTournament ? "Live tournament" : "Next tournament"}
            </p>
            {spotlight ? (
              <>
                <h3 className="nf-heading mt-2 text-lg font-bold text-white">{spotlight.title}</h3>
                <p className="text-xs text-slate-400">{[spotlight.game, spotlight.forge?.name ?? "Global"].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-white/5 bg-[#11151e] p-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Bracket</p>
                    <p className="text-sm font-semibold text-white">{spotlight.participants?.length ?? 0} teams</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#11151e] p-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Prize</p>
                    <p className="text-sm font-semibold text-white">{spotlight.prizePool || "Glory"}</p>
                  </div>
                </div>
                {countdown && !countdown.past ? (
                  <div className="mt-4 text-center">
                    <p className="nf-heading text-3xl font-bold text-amber-300">
                      {countdown.h}h {String(countdown.m).padStart(2, "0")}m {String(countdown.s).padStart(2, "0")}s
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">until start</p>
                  </div>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setActiveEventId(spotlight.id)} className={`${goldBtn} flex-1 justify-center`}>View bracket</button>
                  {spotlight.status === "SCHEDULED" && !isMine(spotlight) ? (
                    <button type="button" onClick={() => rsvpMutation.mutate({ eventId: spotlight.id, status: "GOING" })} className={`${ghostBtn} flex-1 justify-center`}>Register</button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No tournaments scheduled. Create one and the countdown will show here.</p>
            )}
          </div>
        </div>

        <div className={panel}>
          <h3 className={`${sectionTitle} mb-3`}>Tournament Brackets</h3>
          {bracketEvent?.bracket ? (
            <BracketView
              event={bracketEvent}
              canReport={canManage(bracketEvent) && bracketEvent.status === "LIVE"}
              onReport={(round, match, winnerUserId) => matchMutation.mutate({ eventId: bracketEvent.id, round, match, winnerUserId })}
            />
          ) : bracketEvent && bracketEvent.type === "TOURNAMENT" ? (
            <div className="space-y-2 text-sm text-slate-400">
              <p>{bracketEvent.participants?.length ?? 0} registered. The bracket is generated when the organizer starts the tournament.</p>
              <ul className="space-y-1">
                {(bracketEvent.participants ?? []).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {entry.user.username}
                  </li>
                ))}
              </ul>
              {canManage(bracketEvent) && bracketEvent.status === "SCHEDULED" ? (
                <button type="button" className={goldBtn} disabled={startMutation.isPending} onClick={() => startMutation.mutate(bracketEvent.id)}>
                  <Play className="h-3.5 w-3.5" /> Start tournament
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a tournament to see its bracket.</p>
          )}
        </div>
      </aside>

      {createOpen ? (
        <CreateEventDialog
          defaultForgeId={selectedForgeId}
          onClose={() => setCreateOpen(false)}
          onCreated={(event) => {
            setCreateOpen(false);
            setScope("upcoming");
            setActiveEventId(event.id);
            void invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

function BracketView({ event, canReport, onReport }: { event: VexoraEvent; canReport: boolean; onReport: (round: number, match: number, winnerUserId: string) => void }) {
  const rounds = event.bracket?.rounds ?? [];
  const champion = rounds.length ? rounds[rounds.length - 1][0]?.winner : null;
  return (
    <div className="space-y-3">
      {champion ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <Crown className="h-4 w-4" /> Champion: <span className="font-semibold">{participantName(event, champion)}</span>
        </div>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="min-w-[150px] flex-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{roundLabel(roundIndex, rounds.length)}</p>
            <div className="space-y-2">
              {round.map((match: BracketMatch, matchIndex) => (
                <div key={matchIndex} className="rounded-lg border border-white/10 bg-[#11151e] p-1.5 text-xs">
                  {[match.a, match.b].map((player, slot) => {
                    const isWinner = Boolean(player && match.winner === player);
                    const clickable = canReport && player && !match.winner && match.a && match.b;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={!clickable}
                        onClick={() => player && onReport(roundIndex, matchIndex, player)}
                        title={clickable ? "Mark as winner" : undefined}
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                          isWinner ? "bg-amber-500/20 text-amber-100" : player ? "text-slate-200" : "text-slate-600"
                        } ${clickable ? "hover:bg-white/5" : ""}`}
                      >
                        <span className="truncate">{participantName(event, player)}</span>
                        {isWinner ? <Crown className="h-3 w-3 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {canReport && !champion ? <p className="text-[11px] text-slate-500">Click a player to record the match winner.</p> : null}
    </div>
  );
}

function CreateEventDialog({ defaultForgeId, onClose, onCreated }: { defaultForgeId: string | null; onClose: () => void; onCreated: (event: VexoraEvent) => void }) {
  const { accessToken, csrfToken } = useAuthStore();
  const forgesQuery = useQuery({ queryKey: ["forges", accessToken], queryFn: () => listForges(accessToken!), enabled: Boolean(accessToken) });
  const [type, setType] = useState<"EVENT" | "TOURNAMENT">("EVENT");
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [description, setDescription] = useState("");
  const [forgeId, setForgeId] = useState<string>(defaultForgeId ?? "");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [maxParticipants, setMaxParticipants] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createEvent(accessToken!, csrfToken!, {
        forgeId: forgeId || undefined,
        type,
        title: title.trim(),
        game: game.trim() || undefined,
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        prizePool: prizePool.trim() || undefined,
      }),
    onSuccess: (result) => onCreated(result.event),
    onError: (err) => setError(errorText(err)),
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="nf-heading text-base font-bold text-white">Create {type === "TOURNAMENT" ? "tournament" : "event"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white" title="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex gap-1 rounded-lg border border-white/5 bg-[#11151e] p-1">
          {(["EVENT", "TOURNAMENT"] as const).map((entry) => (
            <button key={entry} type="button" onClick={() => setType(entry)} className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${type === entry ? "bg-amber-400 text-slate-950" : "text-slate-400"}`}>
              {entry === "EVENT" ? "Event" : "Tournament"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <input className={inputClass} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inputClass} placeholder="Game (optional)" value={game} onChange={(e) => setGame(e.target.value)} maxLength={80} />
            <input type="datetime-local" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <textarea className={`${inputClass} h-20 py-2`} placeholder="What should people expect?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          <div className="grid gap-3 sm:grid-cols-3">
            <select className={inputClass} value={forgeId} onChange={(e) => setForgeId(e.target.value)}>
              <option value="">Global (all forges)</option>
              {(forgesQuery.data?.forges ?? []).map((forge) => <option key={forge.id} value={forge.id}>{forge.name}</option>)}
            </select>
            <input type="number" min={2} max={1024} className={inputClass} placeholder="Max players" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
            <input className={inputClass} placeholder="Prize pool" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} maxLength={120} />
          </div>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
            <button type="button" onClick={() => mutation.mutate()} disabled={title.trim().length < 3 || !startsAt || mutation.isPending} className={goldBtn}>
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
