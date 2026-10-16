import Image from "next/image";
import Link from "next/link";
import { footerColumns } from "@/components/site/site-nav";

/** The public website's footer. Plain links only, so it can render on the server. */
export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#040812]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4 sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Nexus Forge Gaming home">
            <Image src="/brand/nexusforge-emblem-256.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
            <span>
              <span className="nf-heading block text-sm font-semibold uppercase tracking-[0.28em] text-white">Nexus Forge</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-300">Gaming</span>
            </span>
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Servers, voice, video and chat for gamers, creators and esports teams. Free to use, with more included than other apps give away. For ages 18+.
          </p>
          <p className="text-xs text-slate-500">
            Made by <Link href="/about" className="font-semibold text-slate-300 hover:text-white">TRH Development</Link>
          </p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{column.title}</p>
            <ul className="mt-2 space-y-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-block py-1 text-slate-400 transition hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 Nexus Forge Gaming · TRH Development. All rights reserved.</p>
          <p>Discord is a trademark of Discord Inc. Nexus Forge Gaming isn&apos;t affiliated with Discord.</p>
        </div>
      </div>
    </footer>
  );
}
