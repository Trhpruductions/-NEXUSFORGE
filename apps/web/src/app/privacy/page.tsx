import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#070a10] bg-[radial-gradient(circle_at_top,rgba(230,179,37,0.14),transparent_35%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-8 rounded-[30px] border border-white/10 bg-[#0d1119] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200">Privacy Policy</p>
          <h1 className="text-4xl font-semibold text-white">Vexora Gaming Privacy Policy</h1>
          <p className="text-sm leading-7 text-slate-400">
            We protect verification and account data, and we only process the information necessary to keep Vexora Gaming safe and compliant.
          </p>
        </div>

        <section className="space-y-4 rounded-[24px] border border-white/10 bg-[#0d1119] p-6 text-sm leading-7 text-slate-400">
          <p className="font-semibold text-white">1. Data use</p>
          <p>
            Personal and verification data is collected to confirm age, prevent abuse, and deliver secure platform access. We do not share sensitive identity data without user consent or legal obligation.
          </p>
          <p className="font-semibold text-white">2. Security</p>
          <p>
            Vexora Gaming uses industry-standard protections for stored verification tokens and session data. Any verification evidence is handled with restricted access.
          </p>
          <p className="font-semibold text-white">3. Rights</p>
          <p>
            Users may request information about the data we process and can contact support for verification-related privacy requests.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="rounded-full border border-white/10 bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-[#0d1119]">
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
