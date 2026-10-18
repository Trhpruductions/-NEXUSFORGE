"use client";

import { useEffect, useState } from "react";
import { deviceAppearance, effectiveAnimation, type LoadingStyle } from "@/lib/appearance/preferences";
import { seasonFor, type Season } from "@/lib/appearance/seasons";

// Tips about features that exist in the app today. Nothing personal and nothing about anyone's account.
const TIPS = [
  "In a voice channel, press Share screen to show your game to your squad.",
  "Push-to-talk lives in Settings → Voice & Video.",
  "Pick a theme, sounds and effects in Settings → Appearance & Sounds.",
  "Right-click a server icon for quick actions.",
  "Use @mentions to get someone's attention in a busy channel.",
];

/**
 * The app's loading screen (route loading and first load). It says only what is true ("Loading Nexus Forge Gaming"),
 * and uses this device's chosen loading style, theme and motion settings. It shows a short tip and, during a seasonal
 * event, that event's line. With reduced motion or animation off it is completely still.
 */
export function BrandedLoading() {
  const [style, setStyle] = useState<LoadingStyle>("forge");
  const [still, setStill] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    const appearance = deviceAppearance();
    setStyle(appearance.loadingStyle);
    setStill(effectiveAnimation(appearance) !== "full");
    setSeason(appearance.seasonal ? seasonFor(new Date()) : null);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
  }, []);

  return (
    <div className={`nf-loading nf-loading-${style}${still ? " nf-loading-still" : ""}`} role="status" aria-live="polite">
      <div className="nf-loading-glow nf-decor" aria-hidden="true" />
      <div className="nf-loading-card">
        {style === "minimal" ? null : (
          <div className="nf-loading-mark" aria-hidden="true">
            <span className="nf-loading-ring" />
            {/* eslint-disable-next-line @next/next/no-img-element -- shown before the app shell (and next/image) is ready */}
            <img src="/brand/nexusforge-emblem.png" alt="" width={84} height={84} draggable={false} />
          </div>
        )}
        <p className="nf-loading-title">Nexus Forge Gaming</p>
        <p className="nf-loading-status">Loading Nexus Forge Gaming</p>
        <div className="nf-loading-bar" aria-hidden="true">
          <span />
        </div>
        {season ? <p className="nf-loading-season">{season.tagline}</p> : null}
        {tip && style !== "minimal" ? <p className="nf-loading-tip">Tip: {tip}</p> : null}
      </div>
    </div>
  );
}
