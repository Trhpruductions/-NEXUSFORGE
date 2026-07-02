import Link from "next/link";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";

export default function SupportPage() {
  const supportHeroImage = getCustomDesignImageUrl(["app-support-desktop.jpg"], "/app-hero.png");

  return (
    <div className="relative grid flex-1 gap-8 overflow-x-clip px-4 py-6 sm:px-6 lg:gap-10 lg:px-8">
      <main id="main-content" aria-label="NexusForge support" className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8">
        <DynamicBackground
          url={supportHeroImage}
          className="relative min-h-[420px] overflow-hidden rounded-none border border-slate-700/70 bg-slate-950/85 shadow-[0_30px_70px_rgba(0,0,0,0.35)] bg-cover bg-center"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/90 via-[#09040b]/20 to-[#09040b]/90" />
          <div className="absolute inset-0 bg-[#09040b]/70" />
          <div className="relative p-6 text-slate-100">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Support visuals</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Your support experience now matches the new listening-first app design.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">This page will display your custom layout visuals when configured for live rooms, invites, and community support.</p>
          </div>
        </DynamicBackground>
        <section className="nexus-panel-glass rounded-none border border-amber-500/15 bg-amber-500/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
          <GuestAuthCallout
            title="Access your NexusForge account to restore sessions and join beta forges."
            description="Sign in to manage invites, support tickets, and support resources tailored to your account."
            loginHref="/login?redirect=/support"
            registerHref="/register?redirect=/support"
          />
        </section>
        <section className="rounded-none border border-slate-700/60 bg-slate-950/80 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Need help?</p>
            <h1 className="text-4xl font-semibold text-white">NexusForge support</h1>
            <p className="max-w-3xl text-base leading-8 text-slate-300">
              For help with live rooms, invites, account access, or launcher issues, reach out to the NexusForge support team. We’re here to help you get back into your Forge quickly.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border border-slate-700/70 bg-slate-900/85 p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Email support</p>
              <p className="mt-4 text-sm text-slate-300">Send us a message and include any invite codes or error details.</p>
              <a href="mailto:support@nexusforge.app" className="mt-6 inline-flex rounded-none border border-amber-500/40 bg-amber-950/15 px-5 py-3 text-sm font-semibold text-amber-100 hover:border-amber-300">
                Email support@nexusforge.app
              </a>
            </div>

            <div className="rounded-none border border-slate-700/70 bg-slate-900/85 p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Troubleshooting</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>• Verify your invite uses the `/invite/` path.</li>
                <li>• Refresh the launcher and try again.</li>
                <li>• If the issue persists, include a screenshot and exact error text.</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/app" className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-slate-100/5 px-6 text-sm font-semibold text-white outline outline-1 outline-slate-700/70 transition hover:bg-slate-100/10">
              Back to Command Center
            </Link>
            <Link href="/app/join" className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-amber-500 px-6 text-sm font-semibold text-black transition hover:bg-amber-400">
              Retry invite join
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
