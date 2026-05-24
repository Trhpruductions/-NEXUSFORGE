export const dynamic = "force-dynamic";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ResetPasswordClient } from "@/components/auth/reset-password-client";

export default async function ResetPasswordPage({ searchParams }: any) {
  const token = (await searchParams)?.token ?? "";

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-300">Security Rail</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">
            Redeem your reset token and restore access.
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Enter the one-time code from your recovery flow, set a fresh password, and return to NexusForge.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Token</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">One-time reset code</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Password</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Secure and permanent</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recovery</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Back to the app</p>
            </article>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Token validation</p>
              <p className="mt-2 text-sm text-slate-300">The reset token links your recovery action to your account securely.</p>
            </div>
            <div className="glass-cut rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Secure restore</p>
              <p className="mt-2 text-sm text-cyan-100">Choose a strong new password and get back into command flow.</p>
            </div>
          </div>
        </>
      }
    >
      <ResetPasswordClient token={token} />
    </AuthPageShell>
  );
}
