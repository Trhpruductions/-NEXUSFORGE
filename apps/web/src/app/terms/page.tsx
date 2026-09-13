import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070a10] bg-[radial-gradient(circle_at_top,rgba(230,179,37,0.14),transparent_35%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[30px] border border-white/10 bg-[#0d1119] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200">Terms of Service</p>
          <h1 className="text-4xl font-semibold text-white">Vexora Gaming Terms of Service</h1>
          <p className="text-sm leading-7 text-slate-400">
            By using Vexora Gaming, you agree to our platform rules, verification requirements, and safety policies.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] border border-white/10 bg-[#0d1119] p-6 text-sm leading-7 text-slate-400">
          <p className="font-semibold text-white">1. Access and verification</p>
          <p>
            Vexora Gaming requires users to complete 18+ verification before accessing the full platform. Unauthorized access or bypassing verification is prohibited.
          </p>
          <p className="font-semibold text-white">2. User obligations</p>
          <p>
            Users must provide accurate identity and verification details, and may not submit forged or fraudulent documents. Violations may result in termination.
          </p>
          <p className="font-semibold text-white">3. Privacy and safety</p>
          <p>
            Verification data is handled according to our privacy policy. Vexora Gaming reserves the right to review and audit verification submissions for security.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/privacy" className="rounded-full border border-white/10 bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-[#0d1119]">
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
