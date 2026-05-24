import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[32px] border border-slate-700/70 bg-slate-900/90 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Privacy Policy</p>
          <h1 className="text-4xl font-semibold text-white">NexusForge Privacy Policy</h1>
          <p className="text-sm leading-7 text-slate-300">
            We protect verification and account data, and we only process the information necessary to keep NexusForge safe and compliant.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] bg-slate-950/90 p-6 text-sm leading-7 text-slate-300">
          <p className="font-semibold text-white">1. Data use</p>
          <p>
            Personal and verification data is collected to confirm age, prevent abuse, and deliver secure platform access. We do not share sensitive identity data without user consent or legal obligation.
          </p>
          <p className="font-semibold text-white">2. Security</p>
          <p>
            NexusForge uses industry-standard protections for stored verification tokens and session data. Any verification evidence is handled with restricted access.
          </p>
          <p className="font-semibold text-white">3. Rights</p>
          <p>
            Users may request information about the data we process and can contact support for verification-related privacy requests.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="rounded-2xl border border-slate-700/70 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900/95">
            Terms of Service
          </Link>
          <Link href="/age-gate" className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            Back to verification
          </Link>
        </div>
      </main>
    </div>
  );
}
