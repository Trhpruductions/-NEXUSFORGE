import type { Metadata } from "next";
import { ChatPage } from "@/components/chat/chat-page";

export const metadata: Metadata = {
  title: "Chat",
  description: "Realtime channels, voice rooms and direct messages.",
};

export default function AppChatPage() {
  return <ChatPage />;
}
