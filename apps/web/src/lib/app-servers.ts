export type AppServerLink = {
  label: string;
  href: string;
  title: string;
  color?: string;
  glow?: string;
};

export const appServerLinks: AppServerLink[] = [
  { label: "NF", href: "/app", title: "NexusForge Home" },
  { label: "M", href: "/app/mining", title: "Industrial Mining", color: "text-nexus-cyan", glow: "shadow-nexus-cyan" },
  { label: "K", href: "/app/crypto", title: "Industrial Terminal", color: "text-nexus-purple", glow: "shadow-nexus-purple" },
  { label: "C", href: "/app/server", title: "Community Hub" },
  { label: "V", href: "/app/voice", title: "Voice Arena" },
  { label: "J", href: "/app/join", title: "Join Rooms" },
];
