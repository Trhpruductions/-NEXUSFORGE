import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgeChatClient } from "@/components/chat/forge-chat-client";

export const metadata: Metadata = {
  title: "Vexora Gaming Workspace | Chat",
  description: "Realtime forge chat, DMs, voice session controls, and moderation workflows.",
};

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading chat...</div>}>
      <ForgeChatClient />
    </Suspense>
  );
}
