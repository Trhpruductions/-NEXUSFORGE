"use client";

import { useEffect, useMemo, useState } from "react";
import type { Preferences } from "@/lib/api";
import { applyAppearance, cacheAppearance, cachedAppearance, effectiveAnimation, resolveAppearance, soundSettingsFrom, type ResolvedAppearance } from "@/lib/appearance/preferences";
import type { Season } from "@/lib/appearance/seasons";
import { EGGS, NEON_SEQUENCE, createBurstCounter, createSequenceMatcher, isTypingTarget, markDiscovered } from "@/lib/appearance/easter-eggs";
import { configureSounds, playCue } from "@/lib/sound/sound-engine";
import { useVoiceStore } from "@/store/voice-store";
import { useMediaStore } from "@/lib/media/media-store";

/**
 * Applies the signed-in person's Appearance & Sounds preferences to the whole app, and runs what goes with them:
 * the ambient layer (theme decoration and seasonal particles), voice and screen-share sounds tied to real state
 * changes, and the easter eggs. Rendered once, by the app shell. Changing a theme never touches the voice call.
 */
export function AppearanceRuntime({ preferences, userId }: { preferences?: Preferences; userId: string | null }) {
  const appearance = useMemo<ResolvedAppearance>(
    () => (preferences ? resolveAppearance(preferences.appearance) : cachedAppearance(userId) ?? resolveAppearance(null)),
    [preferences, userId],
  );
  const [season, setSeason] = useState<Season | null>(null);

  useEffect(() => {
    const apply = () => setSeason(applyAppearance(document.documentElement, appearance));
    apply();
    if (preferences) cacheAppearance(userId, appearance);
    // Seasonal events start and end at local midnight: look again every hour.
    const timer = window.setInterval(apply, 60 * 60 * 1000);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    motion?.addEventListener?.("change", apply);
    return () => {
      window.clearInterval(timer);
      motion?.removeEventListener?.("change", apply);
    };
  }, [appearance, preferences, userId]);

  useEffect(() => {
    configureSounds(soundSettingsFrom(preferences));
  }, [preferences]);

  useVoiceSounds();
  const sparks = useEasterEggs(appearance.easterEggs, userId);

  return (
    <>
      <AmbientLayer season={season} appearance={appearance} />
      {sparks > 0 && effectiveAnimation(appearance) !== "off" ? <SparkBurst key={sparks} /> : null}
    </>
  );
}

/** The Forge Spark easter egg: a short burst of embers from the middle of the screen, then gone. */
function SparkBurst() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="nf-spark-burst" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        const distance = 120 + (index % 4) * 40;
        return <span key={index} className="nf-spark" style={{ ["--dx" as string]: `${Math.cos(angle) * distance}px`, ["--dy" as string]: `${Math.sin(angle) * distance}px` }} />;
      })}
    </div>
  );
}

/** Plays voice and screen-share cues for real transitions only (never on re-render, never twice for one change). */
function useVoiceSounds() {
  useEffect(() => {
    let previous = useVoiceStore.getState();
    let previousIds = new Set(previous.remote.map((peer) => peer.userId));
    const stopVoice = useVoiceStore.subscribe((state) => {
      const sameCall = Boolean(state.session && previous.session && state.session.channelId === previous.session.channelId);
      if (state.connection !== previous.connection) {
        if (state.connection === "connected") playCue(previous.connection === "reconnecting" ? "reconnected" : "voiceConnected");
        else if (state.connection === "reconnecting") playCue("connectionLost");
        else if (state.connection === "disconnected" && previous.connection === "connected") playCue("voiceDisconnected");
      }
      const ids = new Set(state.remote.map((peer) => peer.userId));
      // Only once the call is up: the first list of people already in the channel is not "someone joined".
      if (sameCall && state.connection === "connected" && previous.connection === "connected") {
        if ([...ids].some((id) => !previousIds.has(id))) playCue("participantJoined");
        else if ([...previousIds].some((id) => !ids.has(id))) playCue("participantLeft");
      }
      previous = state;
      previousIds = ids;
    });
    let previousShare = useMediaStore.getState().screenShare.state;
    const stopShare = useMediaStore.subscribe((state) => {
      const next = state.screenShare.state;
      if (next === previousShare) return;
      if (next === "sharing") playCue("screenShareStarted");
      else if (next === "stopped" && previousShare === "sharing") playCue("screenShareStopped");
      else if ((next === "error" || next === "denied") && previousShare === "requesting") playCue("screenShareFailed");
      previousShare = next;
    });
    return () => {
      stopVoice();
      stopShare();
    };
  }, []);
}

/**
 * Two hidden eggs. Forge Spark: click the Nexus Forge logo five times quickly. Neon Overdrive: the classic arrow-key
 * code (up up down down left right left right B A) typed outside any text box; it tints the app for 30 seconds.
 */
function useEasterEggs(enabled: boolean, userId: string | null) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const logoClicks = createBurstCounter({ count: 5, windowMs: 2500 });
    const neon = createSequenceMatcher(NEON_SEQUENCE);
    let neonTimer: number | null = null;
    let lastNeon = 0;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.("[data-nf-logo]")) return;
      if (logoClicks.hit(Date.now())) {
        setBurst((value) => value + 1);
        playCue("secret");
        markDiscovered(userId, "forge-spark");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (!neon.feed(event.key)) return;
      if (Date.now() - lastNeon < 30_000) return;
      lastNeon = Date.now();
      document.documentElement.dataset.secret = "neon";
      playCue("secret");
      markDiscovered(userId, "neon-overdrive");
      if (neonTimer) window.clearTimeout(neonTimer);
      neonTimer = window.setTimeout(() => {
        delete document.documentElement.dataset.secret;
      }, 30_000);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      if (neonTimer) window.clearTimeout(neonTimer);
      delete document.documentElement.dataset.secret;
    };
  }, [enabled, userId]);
  return burst;
}

const PARTICLE_COUNT = 14;

/** Theme decoration and seasonal particles. Purely visual: aria-hidden, never interactive, off with effects off. */
function AmbientLayer({ season, appearance }: { season: Season | null; appearance: ResolvedAppearance }) {
  const animation = effectiveAnimation(appearance);
  const kind = season?.id === "winter" ? "snow" : season?.id === "halloween" ? "ember" : season?.id === "new-year" || season?.id === "nfg-anniversary" ? "sparkle" : null;
  const particles = useMemo(
    // Fixed positions and timings (no randomness), so the layer never changes between renders.
    () => Array.from({ length: PARTICLE_COUNT }, (_, index) => ({ left: `${(index * 37) % 100}%`, delay: `${(index * 1.7) % 12}s`, duration: `${10 + ((index * 3) % 9)}s` })),
    [],
  );
  if (!appearance.decorativeEffects) return null;
  return (
    <div className="nf-ambient" aria-hidden="true">
      {kind && animation === "full"
        ? particles.map((particle, index) => (
            <span key={index} className={`nf-particle nf-particle-${kind}`} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration }} />
          ))
        : null}
    </div>
  );
}

export { EGGS };
