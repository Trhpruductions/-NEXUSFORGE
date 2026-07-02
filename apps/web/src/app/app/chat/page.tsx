import type { Metadata } from "next";
import { ForgeChatClient } from "@/components/chat/forge-chat-client";

export const metadata: Metadata = {
  title: "NexusForge Workspace | Chat",
  description: "Realtime forge chat, DMs, voice session controls, and moderation workflows.",
};

export default function ChatPage() {
  return <ForgeChatClient />;
}
