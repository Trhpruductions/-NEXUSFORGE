import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgeChatClient } from "@/components/chat/forge-chat-client";

export const metadata: Metadata = {
  title: "Forge Ops",
  description: "Bots, invites, campaigns and onboarding tools for your forge.",
};

export default function ForgeOpsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading forge ops...</div>}>
      <ForgeChatClient />
    </Suspense>
  );
}
