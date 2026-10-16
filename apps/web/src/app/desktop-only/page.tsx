import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Download } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  title: "Desktop app access",
  description: "How to use Nexus Forge Gaming right now: the Windows desktop app, the web app and sign-in.",
  path: "/desktop-only",
});

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-5 sm:p-6";
const sectionTitle = "nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white";
const primaryLink =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-300";
const ghostLink =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-100 transition hover:border-amber-400/50 hover:text-white";

export default function DesktopOnlyPage() {
  const desktopOnly = String(process.env.NEXUSFORGE_DESKTOP_ONLY || "").toLowerCase() === "true";

  return (
    <ExperienceShell
      eyebrow="Access"
      title={desktopOnly ? "Nexus Forge Gaming is on Windows for now" : "Nexus Forge Gaming is open on the web"}
      subtitle={
        desktopOnly
          ? "Web access is paused while the Windows app is finished. Download the app, or check back here."
          : "Web access is open again. Sign in, or get the Windows app for its own window and automatic updates."
      }
      metrics={[
        { label: "Windows app", value: "Available", tone: "emerald" },
        { label: "Web app", value: desktopOnly ? "Paused" : "Open", tone: desktopOnly ? "amber" : "emerald" },
      ]}
      actions={
        desktopOnly
          ? [
              { label: "Download for Windows", href: "/download", tone: "primary" },
              { label: "Sign in", href: "/login?redirect=/desktop-only", tone: "ghost" },
            ]
          : [
              { label: "Open the web app", href: "/app", tone: "primary" },
              { label: "Download for Windows", href: "/download", tone: "ghost" },
            ]
      }
      maxWidthClassName="max-w-4xl"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="windows-heading" className={panel}>
          <h2 id="windows-heading" className={sectionTitle}>Use the Windows app</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The Windows app opens Nexus Forge Gaming in its own window, with a taskbar icon and updates that install themselves.
          </p>
          <Link href="/download" className={`${primaryLink} mt-5 w-full sm:w-auto`}>
            <Download className="h-4 w-4" aria-hidden="true" /> Download for Windows
          </Link>
        </section>

        <section aria-labelledby="account-heading" className={panel}>
          <h2 id="account-heading" className={sectionTitle}>Sign in or create an account</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            One account works in the Windows app and in the browser. Sign in to continue, or create a free account.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?redirect=/desktop-only" className={primaryLink}>
              Sign in
            </Link>
            <Link href="/register?redirect=/desktop-only" className={ghostLink}>
              Create account
            </Link>
          </div>
        </section>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Status not what you expect? <Link href="/" className="font-semibold text-amber-200 underline-offset-4 hover:text-white hover:underline">Check again</Link>.
      </p>
    </ExperienceShell>
  );
}
