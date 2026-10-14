import type { Metadata } from "next";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { DownloadsPage } from "@/components/downloads/downloads-page";

export const metadata: Metadata = { title: "Download", description: "Download Nexus Forge Gaming for Windows." };

/** Public download page (no sign-in needed); the desktop app also falls back here. */
export default function PublicDownloadPage() {
  return (
    <ExperienceShell
      eyebrow="Desktop app"
      title="Download Nexus Forge Gaming"
      subtitle="The Windows app: chat, voice and your servers in their own window, with automatic updates."
      metrics={[]}
      actions={[
        { label: "Use in browser", href: "/app", tone: "ghost" },
        { label: "Create account", href: "/register", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <DownloadsPage />
    </ExperienceShell>
  );
}
