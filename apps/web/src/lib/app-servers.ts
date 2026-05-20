export type AppServerLink = {
  label: string;
  href: string;
  title: string;
};

export const appServerLinks: AppServerLink[] = [
  { label: "NF", href: "/app", title: "NexusForge Home" },
  { label: "C", href: "/app/server", title: "Community Hub" },
  { label: "V", href: "/app/voice", title: "Voice Arena" },
  { label: "J", href: "/app/join", title: "Join Rooms" },
];
