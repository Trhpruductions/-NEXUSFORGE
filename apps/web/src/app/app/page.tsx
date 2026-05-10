import { ForgeChatClient } from "@/components/chat/forge-chat-client";

export default function AppPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip px-4 py-6 sm:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_8%,rgba(14,165,233,0.12),transparent_34%),radial-gradient(circle_at_88%_84%,rgba(249,115,22,0.1),transparent_38%)]" />
      <ForgeChatClient />
    </div>
  );
}
