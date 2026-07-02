export const dynamic = "force-dynamic";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default async function VerifyEmailPage({ searchParams }: any) {
  const token = (await searchParams)?.token ?? "";

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-300">Email Verification</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">
            Confirm your account ownership.
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Use the verification link sent to your email to activate your NexusForge account and continue into the app.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">One-time token</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Email confirmed</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next step</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Login to Forge</p>
            </article>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-none border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Email unlock</p>
              <p className="mt-2 text-sm text-slate-300">Confirm your email and step directly into the NexusForge command center.</p>
            </div>
            <div className="glass-cut rounded-none border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Secure entry</p>
              <p className="mt-2 text-sm text-cyan-100">Verification completes your identity and preserves your secure session path.</p>
            </div>
          </div>
        </>
      }
    >
      <VerifyEmailClient token={token} />
    </AuthPageShell>
  );
}
