"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import type { ViewerBackground } from "@/components/avatar3d/avatar-viewer";

// The 3D viewer needs the browser (WebGL), so it is loaded only on the client.
const AvatarViewer = dynamic(() => import("@/components/avatar3d/avatar-viewer").then((m) => m.AvatarViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading 3D viewer" />
    </div>
  ),
});

const backgrounds: Array<{ id: ViewerBackground; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "night", label: "Night" },
  { id: "transparent", label: "Clear" },
];

export function AvatarViewerLab() {
  const [spin, setSpin] = useState(true);
  const [background, setBackground] = useState<ViewerBackground>("studio");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">3D avatar viewer</h1>
          <p className="text-xs text-slate-400">Drag to turn the character. Scroll or pinch to zoom.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSpin((value) => !value)} aria-pressed={spin} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">
            {spin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {spin ? "Pause turn" : "Auto turn"}
          </button>
          {backgrounds.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setBackground(entry.id)} aria-pressed={background === entry.id} className={`rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${background === entry.id ? "border-amber-400 text-amber-100" : "border-white/10 text-slate-300 hover:border-white/30"}`}>
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <AvatarViewer className="h-[62vh] min-h-[360px] w-full" autoRotate={spin} background={background} />
    </div>
  );
}
