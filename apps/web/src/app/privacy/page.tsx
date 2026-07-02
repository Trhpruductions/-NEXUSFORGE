import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[30px] border border-slate-900/10 bg-white/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Privacy Policy</p>
          <h1 className="text-4xl font-semibold text-slate-950">NexusForge Privacy Policy</h1>
          <p className="text-sm leading-7 text-slate-600">
            We protect verification and account data, and we only process the information necessary to keep NexusForge safe and compliant.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] border border-slate-900/10 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          <p className="font-semibold text-slate-950">1. Data use</p>
          <p>
            Personal and verification data is collected to confirm age, prevent abuse, and deliver secure platform access. We do not share sensitive identity data without user consent or legal obligation.
          </p>
          <p className="font-semibold text-slate-950">2. Security</p>
          <p>
            NexusForge uses industry-standard protections for stored verification tokens and session data. Any verification evidence is handled with restricted access.
          </p>
          <p className="font-semibold text-slate-950">3. Rights</p>
          <p>
            Users may request information about the data we process and can contact support for verification-related privacy requests.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="rounded-full border border-slate-900/10 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Terms of Service
          </Link>
          <Link href="/age-gate" className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            Back to verification
          </Link>
        </div>
      </main>
    </div>
  );
}
