"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Users, ShieldCheck, Terminal, ArrowRight, Radio, Satellite } from "lucide-react";

function extractInviteCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const direct = trimmed.toLowerCase().replace(/^\/+|\/+$/g, "");
  if (/^[a-z0-9-]{3,32}$/i.test(direct)) return direct;
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const inviteIndex = segments.findIndex((segment) => segment.toLowerCase() === "invite");
    if (inviteIndex >= 0 && segments[inviteIndex + 1]) {
      const candidate = segments[inviteIndex + 1].toLowerCase();
      return /^[a-z0-9-]{3,32}$/i.test(candidate) ? candidate : "";
    }
  } catch {
    return "";
  }
  return "";
}

export default function JoinServerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const inviteCode = useMemo(() => extractInviteCode(draft), [draft]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteCode) return;
    router.push(`/invite/${inviteCode}`);
  };

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Join</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
               Enter a space with an invite
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Gateway status</span>
               <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> listening
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="space-y-12 rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-12">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Terminal className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 font-mono">Invite code</span>
                  </div>
                  <form onSubmit={onSubmit} className="space-y-8">
                     <input 
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Paste invite code or URL..."
                        className="w-full rounded-[24px] border border-slate-700/70 bg-slate-900 p-6 text-2xl font-semibold tracking-tight text-slate-100 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-300 md:p-8 md:text-3xl font-mono"
                     />
                     
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className={`flex items-center gap-2 ${inviteCode ? 'text-emerald-600' : 'text-slate-500'} transition-colors`}>
                              <Radio className="w-4 h-4" />
                              <span className="text-[10px] font-semibold uppercase tracking-widest">{inviteCode ? 'Signal ready' : 'Awaiting invite'}</span>
                           </div>
                           {inviteCode && (
                              <span className="text-[10px] font-mono uppercase text-slate-500">Verified: {inviteCode}</span>
                           )}
                        </div>
                        <button 
                           disabled={!inviteCode}
                           className={`flex items-center gap-3 rounded-full px-10 py-4 text-[12px] font-semibold uppercase tracking-[0.24em] transition-colors ${
                              inviteCode ? 'border border-slate-700/70 bg-slate-900 text-slate-100 hover:bg-slate-900/70' : 'border border-slate-700/70 bg-slate-900 text-slate-400'
                           }`}
                        >
                           Join space <ArrowRight className="w-4 h-4" />
                        </button>
                     </div>
                  </form>
               </div>
            </div>

            <div className="group flex items-center gap-8 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
               <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-slate-700/70 bg-slate-900/70">
                  <Satellite className="w-6 h-6 text-slate-500 transition-colors group-hover:text-amber-600" />
               </div>
               <div className="space-y-1">
                  <h4 className="text-lg font-semibold tracking-tight text-slate-100">Routing made simple</h4>
                  <p className="text-[10px] font-semibold uppercase tracking-widest leading-relaxed text-slate-500">
                     Invites resolve automatically so you can join a room without extra steps.
                  </p>
               </div>
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="h-full space-y-8 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <ShieldCheck className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Security audit</span>
                  </div>
                  <div className="space-y-4 font-mono">
                     {[
                        { label: "IP masking", status: "Enabled" },
                        { label: "SSL tunnel", status: "Verified" },
                        { label: "Link decay", status: "Low" },
                     ].map(item => (
                        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-[9px] tracking-widest">
                           <span className="uppercase text-slate-500">{item.label}</span>
                           <span className="font-semibold uppercase text-slate-100">{item.status}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                   <div className="flex items-center gap-3">
                     <Users className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Traffic pulse</span>
                  </div>
                  <div className="space-y-6 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
                     <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-semibold uppercase text-slate-500">
                           <span>Ingress_Load</span>
                           <span className="text-amber-600">2.4%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-200">
                           <div className="h-full w-[2%] bg-amber-400" />
                        </div>
                     </div>
                     <p className="text-[9px] font-semibold uppercase tracking-widest leading-loose text-slate-500">
                        Entrance nodes are lightly used, so joins should stay fast and stable.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
