import type { Metadata } from "next";
import { MiningPage } from "@/components/mining/mining-page";

export const metadata: Metadata = { title: "Mining", description: "Rigs that earn Nexus Forge Coins." };

export default function AppMiningPage() {
  return <MiningPage />;
}
