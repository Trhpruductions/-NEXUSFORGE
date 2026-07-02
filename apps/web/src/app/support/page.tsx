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
          className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 shadow-[0_24px_60px_rgba(15,23,42,0.08)] bg-cover bg-center"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#f5f1ea]/92 via-[#f5f1ea]/20 to-[#f5f1ea]/92" />
          <div className="absolute inset-0 bg-white/35" />
          <div className="relative p-6 text-slate-900">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-700">Support visuals</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Your support experience now matches the new listening-first app design.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">This page will display your custom layout visuals when configured for live rooms, invites, and community support.</p>
          </div>
        </DynamicBackground>
        <section className="nexus-panel-glass rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <GuestAuthCallout
            title="Access your NexusForge account to restore sessions and join beta forges."
            description="Sign in to manage invites, support tickets, and support resources tailored to your account."
            loginHref="/login?redirect=/support"
            registerHref="/register?redirect=/support"
          />
        </section>
        <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-700">Need help?</p>
            <h1 className="text-4xl font-semibold text-slate-950">NexusForge support</h1>
            <p className="max-w-3xl text-base leading-8 text-slate-600">
              For help with live rooms, invites, account access, or launcher issues, reach out to the NexusForge support team. We’re here to help you get back into your Forge quickly.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Email support</p>
              <p className="mt-4 text-sm text-slate-600">Send us a message and include any invite codes or error details.</p>
              <a href="mailto:support@nexusforge.app" className="mt-6 inline-flex rounded-full border border-slate-900/10 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Email support@nexusforge.app
              </a>
            </div>

            <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Troubleshooting</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• Verify your invite uses the `/invite/` path.</li>
                <li>• Refresh the launcher and try again.</li>
                <li>• If the issue persists, include a screenshot and exact error text.</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/app" className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-900/10 bg-white px-6 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              Back to Workspace
            </Link>
            <Link href="/app/join" className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
              Retry invite join
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
