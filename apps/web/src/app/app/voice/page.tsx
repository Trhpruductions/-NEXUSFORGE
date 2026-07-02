import type { Metadata } from "next";
import { getCustomDesignImagePath } from "@/lib/custom-design";
import { VoiceRoomView } from "@/components/app/voice-room-view";

export const metadata: Metadata = {
  title: "NexusForge Workspace | Voice",
  description: "Live audio rooms and spatial voice control for NexusForge teams.",
};

export default function VoicePage() {
  const voiceStageSrc = getCustomDesignImagePath(["app-voice-stage-desktop.jpg", "app-voice-desktop.png", "app-hero.png"], "/app-hero.png");
  const voiceChatSrc = getCustomDesignImagePath(["app-voice-chat-desktop.jpg"], "/app-hero.png");

  return <VoiceRoomView heroImageSrc={voiceStageSrc} chatPreviewSrc={voiceChatSrc} />;
}
