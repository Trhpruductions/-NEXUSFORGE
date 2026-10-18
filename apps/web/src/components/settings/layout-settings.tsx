"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { LAYOUT_LIMITS, type VoiceLayoutChoice } from "@/lib/layout/layout-prefs";
import { useLayoutPrefs, useLayoutStore } from "@/store/layout-store";

const label = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const group = "space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4";
const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

type DesktopBridge = { runtime?: string; features?: readonly string[]; resetWindowLayout?: () => Promise<boolean> };

function Toggle({ checked, onChange, text, hint }: { checked: boolean; onChange: (value: boolean) => void; text: string; hint?: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-100">{text}</p>
        {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={text}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${checked ? "border-amber-400/60 bg-amber-500/40" : "border-white/15 bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </li>
  );
}

/**
 * Settings → Appearance → Layout: sidebar sizes, the voice room's default view, and a reset. These are kept on this
 * device (screen sizes differ between PCs) and apply as soon as they change.
 */
export function LayoutSettings() {
  const prefs = useLayoutPrefs();
  const update = useLayoutStore((state) => state.update);
  const reset = useLayoutStore((state) => state.reset);
  const [bridge, setBridge] = useState<DesktopBridge | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const found = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    setBridge(found?.runtime === "electron" ? found : null);
  }, []);
  const canResetWindow = Boolean(bridge?.features?.includes("window-reset") && bridge.resetWindowLayout);

  const resetAll = async () => {
    reset();
    let windowReset = false;
    if (canResetWindow) windowReset = Boolean(await bridge!.resetWindowLayout!().catch(() => false));
    setNotice(windowReset ? "Layout reset: sidebars, voice view and the window size are back to their defaults." : "Layout reset: sidebars and voice view are back to their defaults.");
  };

  return (
    <section className={group} aria-labelledby="appearance-layout">
      <div>
        <h3 id="appearance-layout" className="text-sm font-semibold text-white">Layout</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Saved on this device straight away. You can also drag the edge of the channel list or member list to resize it, and hide either one: the channel list with the button above Settings in the left rail, the member list with the Members button in a channel&apos;s header.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs text-slate-300">
          <span className={label}>Channel list width: {prefs.leftWidth}px</span>
          <input type="range" min={LAYOUT_LIMITS.left.min} max={LAYOUT_LIMITS.left.max} step={4} value={prefs.leftWidth} onChange={(event) => update({ leftWidth: Number(event.target.value) })} className="w-full accent-amber-400" aria-label="Channel list width" />
        </label>
        <label className="block text-xs text-slate-300">
          <span className={label}>Member list width: {prefs.rightWidth}px</span>
          <input type="range" min={LAYOUT_LIMITS.right.min} max={LAYOUT_LIMITS.right.max} step={4} value={prefs.rightWidth} onChange={(event) => update({ rightWidth: Number(event.target.value) })} className="w-full accent-amber-400" aria-label="Member list width" />
        </label>
      </div>
      <ul className="space-y-3">
        <Toggle checked={!prefs.leftCollapsed} onChange={(value) => update({ leftCollapsed: !value })} text="Show the channel list" hint="When it's hidden, the server icons on the left stay, and the button above Settings brings the list back." />
        <Toggle checked={!prefs.rightCollapsed} onChange={(value) => update({ rightCollapsed: !value })} text="Show the member list in servers" hint="Narrow windows hide it for the moment to keep the chat readable; the Members button still opens it." />
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs text-slate-300">
          <span className={label}>Voice room view</span>
          <select className={selectClass} value={prefs.voiceLayout} onChange={(event) => update({ voiceLayout: event.target.value as VoiceLayoutChoice })}>
            <option value="auto">Automatic: big screen when someone shares</option>
            <option value="grid">Everyone: participant tiles first</option>
            <option value="focus">Screen: the shared screen big whenever there is one</option>
          </select>
        </label>
      </div>
      <ul className="space-y-3">
        <Toggle checked={prefs.focusNewShares} onChange={(value) => update({ focusNewShares: value })} text="Show new screen shares big" hint="In the automatic view, switch to the shared screen when someone starts sharing." />
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void resetAll()} className={ghostBtn}>
          <RotateCcw className="h-3 w-3" /> Reset layout
        </button>
        <p className="text-[11px] text-slate-500" role="status">
          {notice ?? (canResetWindow ? "Puts the sidebars, the voice view and the window size and position back to their defaults." : "Puts the sidebars and the voice view back to their defaults.")}
        </p>
      </div>
    </section>
  );
}
