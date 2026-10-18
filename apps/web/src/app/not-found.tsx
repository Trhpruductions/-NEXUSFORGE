import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-app items-center justify-center bg-[#040812] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-violet-400/25 bg-[#0d0a18] p-6 text-center shadow-[0_0_60px_rgba(139,92,246,0.12)] sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/10 text-violet-200">
          <Compass className="h-6 w-6" />
        </span>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300">Error 404</p>
        <h1 className="nf-heading mt-1 text-2xl font-bold text-white">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-slate-400">The link may be broken, or the page may have moved.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/app" className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400">Open the app</Link>
          <Link href="/" className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/25">Home page</Link>
        </div>
      </div>
    </main>
  );
}
