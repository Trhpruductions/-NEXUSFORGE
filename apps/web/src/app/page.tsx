import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, LayoutDashboard, MessageSquare, ShieldCheck, Sparkles, Users2 } from "lucide-react";

const features = [
   {
      title: "Calm workspace",
      description: "A focused home base for planning, messages, and day-to-day coordination without the visual noise.",
      icon: LayoutDashboard,
   },
   {
      title: "Safer defaults",
      description: "Privacy-conscious flows and clear permission boundaries that feel practical instead of dramatic.",
      icon: ShieldCheck,
   },
   {
      title: "Less friction",
      description: "Fast navigation, short paths to common actions, and copy that reads like a product, not a trailer.",
      icon: Sparkles,
   },
];

const activityItems = [
   { label: "Daily check-in", note: "8:30 AM", status: "Ready", tone: "bg-emerald-500/15 text-emerald-700" },
   { label: "Team notes", note: "2 new updates", status: "Quiet", tone: "bg-sky-500/15 text-sky-700" },
   { label: "Next milestone", note: "On track", status: "Today", tone: "bg-amber-500/15 text-amber-700" },
];

export default function Home() {
   return (
      <div className="min-h-screen overflow-x-hidden bg-[#f5f1ea] text-slate-900 selection:bg-amber-200 selection:text-slate-900 scroll-smooth">
         <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_32%),radial-gradient(circle_at_80%_12%,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_50%_90%,rgba(251,191,36,0.09),transparent_28%)]" />
         <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#94a3b81a_1px,transparent_1px),linear-gradient(to_bottom,#94a3b81a_1px,transparent_1px)] bg-[size:38px_38px] opacity-35 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_10%,#000_60%,transparent_100%)]" />

         <header className="sticky top-0 z-50 border-b border-slate-900/8 bg-[#f5f1ea]/85 backdrop-blur-xl">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
               <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-900/10 bg-white shadow-sm">
                     <Image src="/app-images/all-images/nexusforge-logo.png" alt="NexusForge" width={24} height={24} className="h-6 w-6 object-contain" />
                  </div>
                  <div>
                     <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">NexusForge</p>
                     <p className="text-sm text-slate-700">A calmer command workspace</p>
                  </div>
               </div>

               <nav className="hidden items-center gap-8 md:flex">
                  {[
                     ["Workspace", "/app"],
                     ["Pricing", "/pricing"],
                     ["Support", "/support"],
                  ].map(([label, href]) => (
                     <Link key={label} href={href} className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                        {label}
                     </Link>
                  ))}
               </nav>

               <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-transform hover:-translate-y-0.5"
               >
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
               </Link>
            </div>
         </header>

         <main className="relative mx-auto max-w-7xl px-6 pb-20 pt-14 lg:px-8 lg:pt-20">
            <section className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
               <div className="max-w-2xl space-y-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                     <Clock3 className="h-4 w-4 text-slate-500" />
                     Built for steady teams and quieter days
                  </div>

                  <div className="space-y-5">
                     <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl">
                        A calmer way to run the work that matters.
                     </h1>
                     <p className="max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
                        NexusForge brings together updates, coordination, and tools in a softer, more focused interface.
                        It feels real, readable, and easy to live in.
                     </p>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row">
                     <Link
                        href="/app"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(251,191,36,0.24)] transition-transform hover:-translate-y-0.5"
                     >
                        Enter workspace
                        <ArrowRight className="h-4 w-4" />
                     </Link>
                     <Link
                        href="/support"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-6 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-white"
                     >
                        See how it works
                     </Link>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-500">
                     {[
                        "Less noise",
                        "Clear status",
                        "Quick navigation",
                        "Privacy-first",
                     ].map((item) => (
                        <span key={item} className="rounded-full border border-slate-900/10 bg-white/70 px-4 py-2">
                           {item}
                        </span>
                     ))}
                  </div>
               </div>

               <div className="relative">
                  <div className="absolute -left-6 top-8 h-24 w-24 rounded-full bg-amber-300/25 blur-3xl" />
                  <div className="absolute -right-3 bottom-10 h-28 w-28 rounded-full bg-sky-300/25 blur-3xl" />

                  <div className="relative overflow-hidden rounded-[32px] border border-slate-900/10 bg-white/80 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
                     <div className="rounded-[28px] border border-slate-900/5 bg-gradient-to-br from-white to-slate-50 p-5">
                        <div className="flex items-center justify-between border-b border-slate-900/5 pb-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-950">Today</p>
                              <p className="text-sm text-slate-500">A focused view of what needs attention</p>
                           </div>
                           <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Stable
                           </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                           <div className="rounded-2xl border border-slate-900/5 bg-[#f8f5ef] p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Focus</p>
                              <p className="mt-3 text-3xl font-semibold text-slate-950">3</p>
                              <p className="mt-1 text-sm text-slate-500">tasks ready for today</p>
                           </div>
                           <div className="rounded-2xl border border-slate-900/5 bg-[#f8f5ef] p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Team</p>
                              <p className="mt-3 text-3xl font-semibold text-slate-950">12</p>
                              <p className="mt-1 text-sm text-slate-500">people checked in</p>
                           </div>
                        </div>

                        <div className="mt-4 space-y-3">
                           {activityItems.map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-900/5 bg-white px-4 py-3">
                                 <div>
                                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                    <p className="text-sm text-slate-500">{item.note}</p>
                                 </div>
                                 <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.tone}`}>{item.status}</span>
                              </div>
                           ))}
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                           <div className="rounded-2xl border border-slate-900/10 bg-slate-100 px-4 py-3 text-slate-900">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Messages</p>
                              <p className="mt-2 text-sm font-medium">2 waiting, no rush</p>
                           </div>
                           <div className="rounded-2xl border border-slate-900/5 bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Updates</p>
                              <p className="mt-2 text-sm font-medium text-slate-900">Quiet summary mode</p>
                           </div>
                           <div className="rounded-2xl border border-slate-900/5 bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                              <p className="mt-2 text-sm font-medium text-slate-900">Everything is synced</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            <section className="mt-16 grid gap-4 md:grid-cols-3">
               {features.map((feature) => (
                  <div key={feature.title} className="rounded-[28px] border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                     <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 shadow-sm">
                        <feature.icon className="h-5 w-5" />
                     </div>
                     <h2 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h2>
                     <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
                  </div>
               ))}
            </section>

            <section className="mt-16 grid gap-4 rounded-[32px] border border-slate-900/10 bg-white/85 px-6 py-8 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.1)] md:grid-cols-3 md:px-8">
               <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Why it feels different</p>
                  <h2 className="mt-3 text-2xl font-semibold">Less spectacle. More clarity.</h2>
               </div>
               <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-5">
                  <MessageSquare className="h-5 w-5 text-amber-600" />
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                     Copy, spacing, and motion are kept simple so the interface feels natural instead of overdesigned.
                  </p>
               </div>
               <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-5">
                  <Users2 className="h-5 w-5 text-amber-600" />
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                     The layout supports real teams: one place for tasks, conversation, and the next small step.
                  </p>
               </div>
            </section>
         </main>
      </div>
   );
}
