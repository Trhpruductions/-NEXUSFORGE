"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Users, Gamepad2, BookOpen, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createForge } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const templates = [
  {
    id: "TRH",
    label: "TRH Development",
    description: "Built for TRH operations with THR development workflows and delivery lanes",
    icon: Building2,
    channels: ["trh-hq", "thr-development", "project-board", "announcements", "client-voice"],
  },
  {
    id: "GAMING",
    label: "Gaming Forge",
    description: "Optimized for gaming clans, raid groups, and competitive teams",
    icon: Gamepad2,
    channels: ["general", "announcements", "raids", "voice-lounge"],
  },
  {
    id: "CREATOR",
    label: "Creator Community",
    description: "Built for content creators and fan communities",
    icon: Users,
    channels: ["general", "content-drops", "collab-hub", "community-voice"],
  },
  {
    id: "ESPORTS",
    label: "Esports Hub",
    description: "Tournament-ready with team management and match tracking",
    icon: Zap,
    channels: ["general", "teams", "scrims", "tournament-updates", "comms"],
  },
  {
    id: "STUDY",
    label: "Study Group",
    description: "Collaborative learning with project spaces and resources",
    icon: BookOpen,
    channels: ["general", "resources", "projects", "study-voice", "qa"],
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetModalState = () => {
    setStep("template");
    setSelectedTemplate(null);
    setServerName("");
    setServerDescription("");
    setSubmitError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !csrfToken) {
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!serverName.trim()) {
        throw new Error("Forge name is required.");
      }
      if (!selectedTemplate) {
        throw new Error("Select a template before creating your forge.");
      }

      return createForge(accessToken, csrfToken, {
        name: serverName.trim(),
        description: serverDescription || undefined,
        template: selectedTemplate as "TRH" | "GAMING" | "CREATOR" | "ESPORTS" | "STUDY",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home-forges", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["forges", accessToken] });
      resetModalState();
      onClose();
      router.push("/app");
      router.refresh();
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : "Failed to create forge.");
    },
  });

  if (!isOpen) return null;

  const handleCreate = () => {
    setSubmitError(null);
    if (!serverName.trim()) return;
    createMutation.mutate();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl rounded-[28px] border border-slate-700 bg-gradient-to-br from-slate-950 to-slate-900 p-6 shadow-[0_24px_48px_rgba(2,6,23,0.6)]"
        >
          {/* Close button */}
          <button
            onClick={() => {
              resetModalState();
              onClose();
            }}
            aria-label="Close modal"
            className="absolute right-4 top-4 rounded-lg p-2 hover:bg-slate-800/50"
          >
            <X size={20} className="text-slate-400" />
          </button>

          {step === "template" ? (
            <div>
              <h2 className="font-orbitron text-2xl font-semibold text-white">Choose Your Forge Template</h2>
              <p className="mt-1 text-sm text-slate-400">Start with a pre-configured setup optimized for your community</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {templates.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <motion.button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        if (template.id === "TRH" && !serverName.trim()) {
                          setServerName("TRH Development");
                        }
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`rounded-[20px] border-2 p-4 text-left transition-all ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-950/30 shadow-[0_0_16px_rgba(34,211,238,0.3)]"
                          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon size={24} className={isSelected ? "text-cyan-400" : "text-slate-400"} />
                        <div>
                          <p className="font-semibold text-white">{template.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{template.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.channels.map((ch) => (
                              <span key={ch} className="rounded px-2 py-1 text-[10px] bg-slate-800/50 text-slate-300">
                                #{ch}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  onClick={() => {
                    resetModalState();
                    onClose();
                  }}
                  variant="ghost"
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep("details")}
                  disabled={!selectedTemplate}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-700"
                >
                  Next: Configure
                </Button>
              </div>

              {submitError ? <p className="mt-3 text-sm text-rose-300">{submitError}</p> : null}
            </div>
          ) : (
            <div>
              <h2 className="font-orbitron text-2xl font-semibold text-white">Configure Your Forge</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create your {templates.find((t) => t.id === selectedTemplate)?.label}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Forge Name *</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="e.g., Apex Legion"
                    maxLength={80}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">{serverName.length}/80</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Description</label>
                  <textarea
                    value={serverDescription}
                    onChange={(e) => setServerDescription(e.target.value)}
                    placeholder="Tell members what your forge is about"
                    maxLength={300}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">{serverDescription.length}/300</p>
                </div>

                <div className="rounded-[16px] border border-slate-700/50 bg-slate-900/25 p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Template Preview</p>
                  <p className="mt-2 text-sm text-slate-200">
                    <strong>{templates.find((t) => t.id === selectedTemplate)?.label}</strong> will be created with these channels:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {templates
                      .find((t) => t.id === selectedTemplate)
                      ?.channels.map((ch) => (
                        <span key={ch} className="rounded px-2 py-1 text-xs bg-slate-800/60 text-cyan-300">
                          #{ch}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between gap-3">
                <Button onClick={() => setStep("template")} variant="ghost" className="rounded-lg">
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      resetModalState();
                      onClose();
                    }}
                    variant="ghost"
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!serverName.trim() || !selectedTemplate || createMutation.isPending}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Forge"}
                  </Button>
                </div>
              </div>

              {submitError ? <p className="mt-3 text-sm text-rose-300">{submitError}</p> : null}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
