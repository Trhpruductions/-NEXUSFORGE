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
    <div className="flex flex-col gap-1">
      {/* HEADER: INGRESS CONTROL */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Ingress_Gateway_v2.0</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               External_Link_Interface
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Gateway_Status</span>
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500" /> LISTENING...
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* MAIN INPUT AREA */}
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="p-12 border border-white/10 bg-black/40 space-y-12">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Terminal className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest font-mono">Input_Access_Code</span>
                  </div>
                  <form onSubmit={onSubmit} className="space-y-8">
                     <input 
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="PASTE_INVITE_HEX_OR_URL..."
                        className="w-full bg-slate-950 border border-white/10 p-8 text-3xl font-black text-white uppercase italic tracking-tighter placeholder:text-slate-800 outline-none focus:border-amber-500/50 transition-all font-mono"
                     />
                     
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className={`flex items-center gap-2 ${inviteCode ? 'text-emerald-500' : 'text-slate-700'} transition-colors`}>
                              <Radio className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{inviteCode ? 'SIGNAL_LOCKED' : 'AWAITING_SIGNAL'}</span>
                           </div>
                           {inviteCode && (
                              <span className="text-[10px] font-mono text-slate-500 uppercase">Code_Verified: {inviteCode}</span>
                           )}
                        </div>
                        <button 
                           disabled={!inviteCode}
                           className={`px-12 py-5 font-black uppercase tracking-[0.3em] text-[12px] flex items-center gap-3 transition-all ${
                              inviteCode ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white/5 text-slate-700 border border-white/5'
                           }`}
                        >
                           Initialize_Ingress <ArrowRight className="w-4 h-4" />
                        </button>
                     </div>
                  </form>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-white/2 flex items-center gap-8 group">
               <div className="w-16 h-16 border border-white/10 bg-slate-950 flex items-center justify-center shrink-0">
                  <Satellite className="w-6 h-6 text-slate-500 group-hover:text-amber-500 transition-all" />
               </div>
               <div className="space-y-1">
                  <h4 className="text-lg font-black text-white uppercase italic tracking-tighter">Advanced_Routing_Protocol</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                     NexusForge gateways automatically resolve decentralized room addresses via the secondary mesh network.
                  </p>
               </div>
            </div>
         </div>

         {/* SIDEBAR MONITOR */}
         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8 h-full">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <ShieldCheck className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Security_Audit</span>
                  </div>
                  <div className="space-y-4 font-mono">
                     {[
                        { label: "IP_Masking", status: "ENABLED" },
                        { label: "SSL_Tunnel", status: "VERIFIED" },
                        { label: "Link_Decay", status: "NEGATIVE" },
                     ].map(item => (
                        <div key={item.label} className="p-4 border border-white/5 bg-white/2 flex justify-between items-center text-[9px] tracking-widest">
                           <span className="text-slate-500 uppercase">{item.label}</span>
                           <span className="text-white font-black">{item.status}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                   <div className="flex items-center gap-3">
                     <Users className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Traffic_Pulse</span>
                  </div>
                  <div className="p-6 border border-white/5 bg-slate-950/50 space-y-6">
                     <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase text-slate-600">
                           <span>Ingress_Load</span>
                           <span className="text-amber-500">2.4%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5">
                           <div className="h-full bg-amber-500 w-[2%]" />
                        </div>
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-loose">
                        Entrance nodes are currently under-utilized. High-speed link stabilization guaranteed for all incoming signals.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
