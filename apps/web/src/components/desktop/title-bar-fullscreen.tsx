"use client";

import { useEffect } from "react";

type DesktopBridge = { runtime?: string; isFullScreen?: () => Promise<boolean>; onFullScreenChange?: (callback: (fullScreen: boolean) => void) => () => void };

/**
 * The desktop app's title bar strip (globals.css, html::before) is sized from the Window Controls Overlay. In full
 * screen Windows hides its minimize/maximize/close buttons, but the overlay still reports a 32px bar, which left an
 * empty strip across the top. This marks full screen on <html> so the strip goes away and the page uses the whole
 * screen. Full screen is taken only from sources that know it: the page's own full screen (a shared screen's Full
 * screen button), and from 1.0.17 the desktop app (F11). Window size alone is not used: a maximized window can fill a
 * whole monitor too, and then the strip and its buttons must stay.
 */
export function TitleBarFullscreen() {
  useEffect(() => {
    const overlay = (navigator as Navigator & { windowControlsOverlay?: { visible: boolean } }).windowControlsOverlay;
    if (!overlay) return;
    const root = document.documentElement;
    const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    let appFullScreen = false;
    const update = () => root.toggleAttribute("data-nf-fullscreen", Boolean(document.fullscreenElement) || appFullScreen);
    update();
    document.addEventListener("fullscreenchange", update);
    let stopListening: (() => void) | undefined;
    if (bridge?.runtime === "electron" && bridge.onFullScreenChange) {
      stopListening = bridge.onFullScreenChange((fullScreen) => {
        appFullScreen = fullScreen;
        update();
      });
      void bridge.isFullScreen?.().then((fullScreen) => {
        appFullScreen = fullScreen;
        update();
      }).catch(() => undefined);
    }
    return () => {
      document.removeEventListener("fullscreenchange", update);
      stopListening?.();
      root.removeAttribute("data-nf-fullscreen");
    };
  }, []);
  return null;
}
