"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, ShieldCheck, Ticket, Timer, Trophy, Users } from "lucide-react";
import { buyJackpotTickets, getApiErrorMessage, getJackpotCurrent, type JackpotRound } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { CoverArt } from "@/components/ui/cover-art";

const QUICK = [1, 5, 10, 25];

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!target) return { ms: 0, label: "--:--" };
  const ms = Math.max(0, new Date(target).getTime() - now);
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { ms, label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` };
}

/** Re-runs the draw in the browser: sha256(seed) must match the hash published up front, and
 *  HMAC-SHA256(seed, roundId) mod tickets must land on the announced winning ticket. */
async function verifyRound(round: JackpotRound) {
  if (!round.serverSeed || round.winningTicket === null || !round.totalTickets) return null;
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(round.serverSeed));
  const hash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", enc.encode(round.serverSeed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(round.id));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const ticket = Number(BigInt(`0x${hex}`) % BigInt(round.totalTickets));
  return hash === round.serverSeedHash && ticket === round.winningTicket;
}

function RecentRound({ round }: { round: JackpotRound }) {
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open || verified !== null) return;
    void verifyRound(round).then(setVerified).catch(() => setVerified(false));
  }, [open, round, verified]);

  return (
    <li className="rounded-xl border border-white/5 bg-[#11151e]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300"><Trophy className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white">
            #{round.number} · {round.status === "REFUNDED" ? <span className="text-slate-400">Refunded (not enough players)</span> : <>@{round.winner?.username ?? "unknown"}</>}
          </span>
          <span className="block text-[11px] text-slate-500">{round.totalTickets} tickets · {round.drawnAt ? new Date(round.drawnAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
        </span>
        {round.payout ? <span className="text-sm font-semibold text-amber-200">+{Number(round.payout).toLocaleString()}</span> : null}
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-white/5 px-3 py-2.5 text-[11px] text-slate-400">
          <p className="break-all"><span className="text-slate-500">Committed hash:</span> <code className="text-slate-300">{round.serverSeedHash}</code></p>
          {round.serverSeed ? <p className="break-all"><span className="text-slate-500">Revealed seed:</span> <code className="text-slate-300">{round.serverSeed}</code></p> : null}
          {round.winningTicket !== null ? <p><span className="text-slate-500">Winning ticket:</span> <span className="text-slate-200">#{round.winningTicket}</span> of {round.totalTickets}</p> : null}
          {round.status === "SETTLED" ? (
            <p className={`inline-flex items-center gap-1.5 font-semibold ${verified ? "text-emerald-300" : verified === false ? "text-rose-300" : "text-slate-400"}`}>
              <ShieldCheck className="h-3.5 w-3.5" /> {verified === null ? "Checking..." : verified ? "Verified in your browser: the result was fixed before the round opened." : "Verification failed."}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function JackpotPanel({ balance }: { balance: string }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [count, setCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const query = useQuery({
    queryKey: ["jackpot", accessToken],
    queryFn: () => getJackpotCurrent(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 10_000,
  });
  const data = query.data;
  const round = data?.round;
  const countdown = useCountdown(round?.closesAt);

  // When the clock runs out, pick up the result and the next round promptly.
  useEffect(() => {
    if (round && countdown.ms === 0) {
      const timer = window.setTimeout(() => void query.refetch(), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [round, countdown.ms, query]);

  const buy = useMutation({
    mutationFn: () => buyJackpotTickets(accessToken!, csrfToken!, { count, idempotencyKey }),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `You hold ${result.myTickets} ticket${result.myTickets === 1 ? "" : "s"} in round #${result.round.number}. Good luck!` });
      setConfirming(false);
      setIdempotencyKey(newKey());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jackpot"] }),
        queryClient.invalidateQueries({ queryKey: ["economy"] }),
        queryClient.invalidateQueries({ queryKey: ["coin-history"] }),
      ]);
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error) });
      setConfirming(false);
    },
  });

  const price = Number(round?.ticketPrice ?? 50);
  const cost = price * count;
  const maxLeft = data ? data.rules.maxTicketsPerPlayer - data.myTickets : 0;
  const odds = round && round.totalTickets > 0 && data ? (data.myTickets / round.totalTickets) * 100 : 0;
  const tooPoor = cost > Number(balance);
  const closed = countdown.ms === 0;

  return (
    <section className="relative overflow-clip rounded-2xl border border-amber-500/25 bg-[#0d1119]">
      <CoverArt seed={`jackpot-${round?.number ?? 0}`} variant="shards" className="absolute inset-0 h-full w-full opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d1119] via-[#0d1119]/85 to-[#0d1119]/40" />
      <div className="relative grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300"><Ticket className="h-3.5 w-3.5" /> Hourly jackpot {round ? `· Round #${round.number}` : ""}</p>
          {query.isLoading || !round || !data ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading the jackpot...</p>
          ) : (
            <>
              <p className="nf-heading mt-2 text-4xl font-bold text-white">{Number(round.projectedPayout).toLocaleString()} <span className="text-base text-amber-300">to the winner</span></p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-amber-300" /> {closed ? "Drawing..." : <>Draw in <span className="font-mono text-white">{countdown.label}</span></>}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-amber-300" /> {data.playerCount} player{data.playerCount === 1 ? "" : "s"}</span>
                <span className="inline-flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5 text-amber-300" /> {round.totalTickets} tickets</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {data.myTickets ? <>You hold <span className="font-semibold text-white">{data.myTickets}</span> ticket{data.myTickets === 1 ? "" : "s"} · <span className="text-amber-200">{odds.toFixed(odds < 1 ? 2 : 1)}%</span> chance right now.</> : "You have no tickets in this round yet."}
                {data.playerCount < data.rules.minPlayers ? ` Needs ${data.rules.minPlayers}+ players to draw; otherwise everyone is refunded.` : ""}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {QUICK.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={n > maxLeft}
                    onClick={() => { setCount(n); setConfirming(false); setNotice(null); }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30 ${count === n ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}
                  >
                    {n}
                  </button>
                ))}
                {confirming ? (
                  <>
                    <button type="button" onClick={() => buy.mutate()} disabled={buy.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-60">
                      {buy.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Pay {cost.toLocaleString()} coins
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} disabled={buy.isPending} className="rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-white">Cancel</button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setNotice(null); setConfirming(true); }}
                    disabled={closed || count > maxLeft || tooPoor}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                  >
                    <Ticket className="h-3.5 w-3.5" /> Buy {count} · {cost.toLocaleString()}
                  </button>
                )}
              </div>
              {tooPoor && !confirming ? <p className="mt-2 text-[11px] text-rose-300">Not enough coins for {count} ticket{count === 1 ? "" : "s"}.</p> : null}
              {maxLeft <= 0 ? <p className="mt-2 text-[11px] text-slate-400">You hold the maximum of {data.rules.maxTicketsPerPlayer} tickets this round.</p> : null}
              {notice ? <p className={`mt-2 text-xs ${notice.tone === "ok" ? "text-emerald-200" : "text-rose-300"}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p> : null}
              <p className="mt-3 text-[10px] text-slate-500">{price} coins a ticket · winner takes the pot minus {(round.rakeBps / 100).toFixed(0)}% · play money, can&apos;t be bought or cashed out</p>
            </>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Recent draws</h3>
          {data?.recent.length ? (
            <ul className="space-y-1.5">{data.recent.map((r) => <RecentRound key={r.id} round={r} />)}</ul>
          ) : (
            <p className="text-xs text-slate-500">No draws yet. Be in the first one.</p>
          )}
        </div>
      </div>
    </section>
  );
}
