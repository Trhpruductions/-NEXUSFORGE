import type { Metadata } from "next";
import { MiningPage } from "@/components/mining/mining-page";
import { MINING_ENABLED } from "@/lib/held-features";

export const metadata: Metadata = { title: "Mining", description: "Rigs that earn Nexus Forge Coins." };

export default function AppMiningPage() {
  if (!MINING_ENABLED) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-white">Mining is not available right now</h1>
        <p className="mt-3 text-sm text-slate-400">This feature is on hold and will return only after review.</p>
      </main>
    );
  }
  return <MiningPage />;
}
