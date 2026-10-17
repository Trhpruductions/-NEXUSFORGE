import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Top Nexus Forge Gaming players by reputation, streaks and medals. Sign in to view the rankings.",
};

export default function LeaderboardsLayout({ children }: { children: ReactNode }) {
  return children;
}
