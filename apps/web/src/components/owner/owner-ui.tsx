import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function OwnerCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("nexus-display-panel rounded-[24px] p-5", className)}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

export function OwnerStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-400">
        {label}
        {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
      </span>
      <span className="font-semibold tabular-nums text-slate-100">{value}</span>
    </div>
  );
}

export function OwnerEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-slate-400">{children}</p>;
}

export function OwnerNav({ active }: { active: "overview" | "financial" }) {
  const items: Array<{ key: "overview" | "financial"; label: string; href: string }> = [
    { key: "overview", label: "Overview", href: "/owner" },
    { key: "financial", label: "Financial", href: "/owner/financial" },
  ];
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Owner console sections">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-medium transition",
            active === item.key ? "border-amber-400/60 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-300 hover:border-amber-400/40",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
