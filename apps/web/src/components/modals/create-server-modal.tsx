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
         <div className="absolute inset-0 bg-slate-700/35 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-slate-900/10 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 p-8">
           <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="h-1 w-8 rounded-full bg-amber-400" />
                 <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500">Node initialization</span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                 Create a new forge
              </h2>
           </div>
           <button 
             onClick={onClose} 
             title="Close Modal"
             className="p-2 text-slate-500 transition-colors hover:text-slate-900"
           >
              <X className="w-8 h-8 font-thin" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[70vh]">
          {step === "template" ? (
            <div className="space-y-8 p-8">
               <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Select a template</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  {templates.map((tpl) => (
                    <button 
                      key={tpl.id}
                      onClick={() => { setSelectedTemplate(tpl.id); setStep("details"); }}
                      className="group space-y-6 rounded-[28px] border border-slate-900/10 bg-slate-50 p-8 text-left transition-colors hover:bg-white"
                    >
                       <div className="flex justify-between items-start">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-900/10 bg-white transition-all group-hover:border-amber-200">
                             <tpl.icon className="w-5 h-5 text-slate-500 group-hover:text-amber-600" />
                          </div>
                          <span className="text-[9px] font-mono italic text-slate-500 group-hover:text-amber-600">{tpl.code}</span>
                       </div>
                       <div className="space-y-1">
                          <h4 className="text-xl font-semibold tracking-tight text-slate-950">{tpl.label.replace(/_/g, " ")}</h4>
                          <p className="text-[10px] font-semibold uppercase tracking-widest leading-relaxed text-slate-500">
                             {tpl.description}
                          </p>
                       </div>
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-12 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Forge name</label>
                     <input 
                        autoFocus
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="Enter forge name..."
                        className="w-full rounded-[24px] border border-slate-900/10 bg-white p-6 text-2xl font-semibold tracking-tight text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-300"
                     />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Description (optional)</label>
                     <textarea 
                        value={serverDescription}
                        onChange={(e) => setServerDescription(e.target.value)}
                        placeholder="Describe the workspace..."
                        className="h-32 w-full resize-none rounded-[24px] border border-slate-900/10 bg-white p-6 text-lg font-semibold tracking-tight text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-300"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Icon URL</label>
                      <input 
                          value={serverIcon}
                          onChange={(e) => setServerIcon(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-[24px] border border-slate-900/10 bg-white p-6 text-sm font-semibold tracking-tight text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-300"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Banner URL</label>
                      <input 
                          value={serverBanner}
                          onChange={(e) => setServerBanner(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-[24px] border border-slate-900/10 bg-white p-6 text-sm font-semibold tracking-tight text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-300"
                      />
                    </div>
                  </div>
               </div>

               {submitError && (
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                     <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-rose-600">
                        <X className="w-3 h-3" /> {submitError}
                     </p>
                  </div>
               )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-900/5 bg-slate-50 p-8">
           <div className="flex items-center gap-6">
              {step === "details" && (
                <button onClick={() => setStep("template")} className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-900">
                   Go back
                </button>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[8px] font-semibold uppercase tracking-widest italic">Encryption active</span>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <button onClick={onClose} className="rounded-full border border-slate-900/10 bg-white px-8 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50">
                 Abort
              </button>
              {step === "details" && (
                <button 
                  onClick={executeInitialization}
                           className="flex items-center gap-2 rounded-full bg-amber-500 px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-950 transition-colors hover:bg-amber-400"
                >
                   Create forge <ArrowRight className="w-4 h-4" />
                </button>
              )}
           </div>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 select-none opacity-10">
           <Cpu className="w-32 h-32 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
