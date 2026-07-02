"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Zap, Users, Gamepad2, BookOpen, Building2, Terminal, ArrowRight, ShieldCheck, Cpu } from "lucide-react";
import { createForge } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const templates = [
  {
    id: "TRH",
    label: "TRH_OPERATIONS",
    description: "Built for TRH development workflows and delivery lanes",
    icon: Building2,
    code: "NODE_OP_TRH",
  },
  {
    id: "GAMING",
    label: "GAMING_FORGE",
    description: "Optimized for gaming clans and competitive teams",
    icon: Gamepad2,
    code: "NODE_OP_GAME",
  },
  {
    id: "CREATOR",
    label: "CREATOR_COMMUNITY",
    description: "Built for content creators and fan communities",
    icon: Users,
    code: "NODE_OP_CREA",
  },
  {
    id: "ESPORTS",
    label: "ESPORTS_HUB",
    description: "Tournament-ready with team management",
    icon: Zap,
    code: "NODE_OP_ESPT",
  },
];

export function CreateServerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);

  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [serverName, setServerName] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [serverIcon, setServerIcon] = useState("");
  const [serverBanner, setServerBanner] = useState("");
  const [submitError, setSubmitError] = useState<string|null>(null);

  if (!isOpen) return null;

  const resetModalState = () => {
    setStep("template");
    setSelectedTemplate(null);
    setServerName("");
    setServerDescription("");
    setServerIcon("");
    setServerBanner("");
    setSubmitError(null);
  };

  const executeInitialization = async () => {
    if (!accessToken || !csrfToken) {
        setSubmitError("AUTH_TOKEN_MISSING: RE-AUTH REQUIRED");
        return;
    }
    if (!serverName.trim()) {
        setSubmitError("INPUT_ERROR: NODE_NAME REQUIRED");
        return;
    }
    if (!selectedTemplate) {
        setSubmitError("INPUT_ERROR: TEMPLATE_CODE MISSING");
        return;
    }

    try {
        await createForge(accessToken, csrfToken, {
            name: serverName.trim(),
            description: serverDescription || undefined,
            icon: serverIcon || undefined,
            banner: serverBanner || undefined,
            template: selectedTemplate as any,
        });
        await queryClient.invalidateQueries({ queryKey: ["home-forges", accessToken] });
        await queryClient.invalidateQueries({ queryKey: ["forges", accessToken] });
        resetModalState();
        onClose();
        router.push("/app");
        router.refresh();
    } catch (err: any) {
        setSubmitError(`INITIALIZATION_FAULT: ${err.message || 'UNKNOWN_ERROR'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl border border-white/10 bg-black flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
           <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-1 bg-amber-500" />
                 <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Node_Initialization_v1.0</span>
              </div>
              <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">
                 Forge_Sequence_Start
              </h2>
           </div>
           <button 
             onClick={onClose} 
             title="Close Modal"
             className="p-2 text-slate-500 hover:text-white transition-colors"
           >
              <X className="w-8 h-8 font-thin" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[70vh]">
          {step === "template" ? (
            <div className="p-8 space-y-8">
               <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Select_Cluster_Template</span>
               </div>
               <div className="grid grid-cols-2 gap-1">
                  {templates.map((tpl) => (
                    <button 
                      key={tpl.id}
                      onClick={() => { setSelectedTemplate(tpl.id); setStep("details"); }}
                      className="p-8 border border-white/5 bg-white/2 hover:bg-white/5 group transition-all text-left space-y-6"
                    >
                       <div className="flex justify-between items-start">
                          <div className="w-12 h-12 border border-white/10 bg-slate-950 flex items-center justify-center group-hover:border-amber-500/50 transition-all">
                             <tpl.icon className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                          </div>
                          <span className="text-[9px] text-slate-600 font-mono italic group-hover:text-amber-500">{tpl.code}</span>
                       </div>
                       <div className="space-y-1">
                          <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">{tpl.label}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                             {tpl.description}
                          </p>
                       </div>
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Node_Identification_String</label>
                     <input 
                        autoFocus
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="ENTER_FORGE_NAME..."
                        className="w-full bg-slate-950 border border-white/10 p-6 text-2xl font-black text-white uppercase italic tracking-tighter placeholder:text-slate-800 outline-none focus:border-amber-500/50 transition-all"
                     />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Description_Metadata (OPTIONAL)</label>
                     <textarea 
                        value={serverDescription}
                        onChange={(e) => setServerDescription(e.target.value)}
                        placeholder="DEFINE_SCOPE_AND_PARAMETERS..."
                        className="w-full bg-slate-950 border border-white/10 p-6 text-lg font-black text-white uppercase italic tracking-tighter placeholder:text-slate-800 outline-none focus:border-amber-500/50 transition-all h-32 resize-none"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Icon_Vector_URL</label>
                      <input 
                          value={serverIcon}
                          onChange={(e) => setServerIcon(e.target.value)}
                          placeholder="HTTPS://..."
                          className="w-full bg-slate-950 border border-white/10 p-6 text-sm font-black text-white uppercase italic tracking-tighter placeholder:text-slate-800 outline-none focus:border-amber-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Banner_Visual_URL</label>
                      <input 
                          value={serverBanner}
                          onChange={(e) => setServerBanner(e.target.value)}
                          placeholder="HTTPS://..."
                          className="w-full bg-slate-950 border border-white/10 p-6 text-sm font-black text-white uppercase italic tracking-tighter placeholder:text-slate-800 outline-none focus:border-amber-500/50 transition-all"
                      />
                    </div>
                  </div>
               </div>

               {submitError && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30">
                     <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-2">
                        <X className="w-3 h-3" /> {submitError}
                     </p>
                  </div>
               )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-8 bg-black border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-6">
              {step === "details" && (
                <button onClick={() => setStep("template")} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
                   GO_BACK
                </button>
              )}
              <div className="flex items-center gap-2 text-slate-700">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[8px] font-black uppercase tracking-widest italic">Encryption_Active</span>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <button onClick={onClose} className="px-8 py-4 border border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                 ABORT
              </button>
              {step === "details" && (
                <button 
                  onClick={executeInitialization}
                  className="px-10 py-4 bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all flex items-center gap-2"
                >
                   Finalize_Initialization <ArrowRight className="w-4 h-4" />
                </button>
              )}
           </div>
        </div>

        {/* DECORATIVE CORNER CODES */}
        <div className="absolute bottom-4 right-4 opacity-10 pointer-events-none select-none">
           <Cpu className="w-32 h-32 text-white" />
        </div>
      </div>
    </div>
  );
}
