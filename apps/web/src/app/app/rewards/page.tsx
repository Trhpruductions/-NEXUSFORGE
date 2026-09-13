import type { Metadata } from "next";
import { RewardsPage } from "@/components/rewards/rewards-page";

export const metadata: Metadata = { title: "Rewards", description: "Balances, activity and achievements." };

export default function AppRewardsPage() {
  return <RewardsPage />;
}
