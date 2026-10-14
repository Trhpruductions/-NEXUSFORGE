import type { MetadataRoute } from "next";

/**
 * Makes Nexus Forge an installable web app (Edge/Chrome "Install app" on PC, Android and
 * Xbox's Edge), and is what a Microsoft Store package (PWABuilder) is generated from.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Nexus Forge Gaming",
    short_name: "Nexus Forge",
    description: "Servers, voice, video and chat for gamers, creators and esports teams.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#040812",
    theme_color: "#040812",
    categories: ["social", "games", "entertainment"],
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Chat", url: "/app/chat", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
      { name: "Friends", url: "/app/friends", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
    ],
  };
}
