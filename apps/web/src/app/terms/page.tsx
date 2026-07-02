import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[30px] border border-slate-900/10 bg-white/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Terms of Service</p>
          <h1 className="text-4xl font-semibold text-slate-950">NexusForge Terms of Service</h1>
          <p className="text-sm leading-7 text-slate-600">
            By using NexusForge, you agree to our platform rules, verification requirements, and safety policies.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] border border-slate-900/10 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          <p className="font-semibold text-slate-950">1. Access and verification</p>
          <p>
            NexusForge requires users to complete 18+ verification before accessing the full platform. Unauthorized access or bypassing verification is prohibited.
          </p>
          <p className="font-semibold text-slate-950">2. User obligations</p>
          <p>
            Users must provide accurate identity and verification details, and may not submit forged or fraudulent documents. Violations may result in termination.
          </p>
          <p className="font-semibold text-slate-950">3. Privacy and safety</p>
          <p>
            Verification data is handled according to our privacy policy. NexusForge reserves the right to review and audit verification submissions for security.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/privacy" className="rounded-full border border-slate-900/10 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Privacy Policy
          </Link>
          <Link href="/age-gate" className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            Back to verification
          </Link>
        </div>
      </main>
    </div>
  );
}
