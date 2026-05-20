import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[32px] border border-slate-700/70 bg-slate-900/90 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Terms of Service</p>
          <h1 className="text-4xl font-semibold text-white">NexusForge Terms of Service</h1>
          <p className="text-sm leading-7 text-slate-300">
            By using NexusForge, you agree to our platform rules, verification requirements, and safety policies.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] bg-slate-950/90 p-6 text-sm leading-7 text-slate-300">
          <p className="font-semibold text-white">1. Access and verification</p>
          <p>
            NexusForge requires users to complete 18+ verification before accessing the full platform. Unauthorized access or bypassing verification is prohibited.
          </p>
          <p className="font-semibold text-white">2. User obligations</p>
          <p>
            Users must provide accurate identity and verification details, and may not submit forged or fraudulent documents. Violations may result in termination.
          </p>
          <p className="font-semibold text-white">3. Privacy and safety</p>
          <p>
            Verification data is handled according to our privacy policy. NexusForge reserves the right to review and audit verification submissions for security.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/privacy" className="rounded-2xl border border-slate-700/70 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900/95">
            Privacy Policy
          </Link>
          <Link href="/age-gate" className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            Back to verification
          </Link>
        </div>
      </main>
    </div>
  );
}
