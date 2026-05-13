import type { ExperienceAction } from "./experience-shell-types";

export const globalNavActions: ExperienceAction[] = [
  { label: "Home", href: "/app", tone: "ghost" },
  { label: "Search", href: "/search", tone: "ghost" },
  { label: "Activity", href: "/notifications", tone: "ghost" },
  { label: "Leaders", href: "/leaderboards", tone: "ghost" },
  { label: "Settings", href: "/settings", tone: "ghost" },
];
