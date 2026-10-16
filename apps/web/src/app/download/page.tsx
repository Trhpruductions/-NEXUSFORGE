import { pageMetadata } from "@/lib/seo";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { PublicDownload } from "@/components/site/public-download";

export const metadata = pageMetadata({
  title: "Download for Windows",
  description: "Download the Nexus Forge Gaming Windows app: its own window, a taskbar icon and automatic updates. Also how to add it on Xbox and phones.",
  path: "/download",
});

/** Public download page (no sign-in needed); the desktop app also falls back here. */
export default function PublicDownloadPage() {
  return (
    <ExperienceShell
      eyebrow="Download"
      title="Download Nexus Forge Gaming"
      subtitle="The Windows app puts chat, voice and your servers in their own window, with automatic updates. You can also use it in your browser."
      actions={[
        { label: "Download for Windows", href: "#get-the-app", tone: "primary" },
        { label: "Use in browser", href: "/app", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-6xl"
    >
      <PublicDownload />
    </ExperienceShell>
  );
}
