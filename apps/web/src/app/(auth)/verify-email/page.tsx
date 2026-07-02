export const dynamic = "force-dynamic";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default async function VerifyEmailPage({ searchParams }: any) {
  const token = (await searchParams)?.token ?? "";

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-600">Email Verification</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-slate-950">
            Confirm your account ownership.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Use the verification link sent to your email to activate your NexusForge account and continue into the workspace.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">One-time token</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Email confirmed</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next step</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Login to Forge</p>
            </article>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-[20px] border border-slate-900/10 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Email unlock</p>
              <p className="mt-2 text-sm text-slate-600">Confirm your email and step directly into the NexusForge workspace.</p>
            </div>
            <div className="glass-cut rounded-[20px] border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-700">Secure entry</p>
              <p className="mt-2 text-sm text-cyan-800">Verification completes your identity and preserves your secure session path.</p>
            </div>
          </div>
        </>
      }
    >
      <VerifyEmailClient token={token} />
    </AuthPageShell>
  );
}
