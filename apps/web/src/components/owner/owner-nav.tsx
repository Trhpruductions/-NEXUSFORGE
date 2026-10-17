"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const OWNER_SECTIONS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/status", label: "Live status" },
  { href: "/owner/users", label: "Users" },
  { href: "/owner/communities", label: "Communities" },
  { href: "/owner/memberships", label: "Memberships" },
  { href: "/owner/finance", label: "Finance" },
  { href: "/owner/transactions", label: "Transactions" },
  { href: "/owner/expenses", label: "Expenses & profit" },
  { href: "/owner/support", label: "Support & reports" },
  { href: "/owner/developer", label: "Developer platform" },
  { href: "/owner/store", label: "Store & purchases" },
  { href: "/owner/incidents", label: "Logs & incidents" },
  { href: "/owner/audit", label: "Security & audit" },
  { href: "/owner/release", label: "Releases & legal" },
] as const;

export function OwnerSideNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Owner console sections" className="nexus-display-panel rounded-[24px] p-3 lg:sticky lg:top-20 lg:self-start">
      <ul className="space-y-1">
        {OWNER_SECTIONS.map((section) => {
          const active = section.href === "/owner" ? pathname === "/owner" : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm transition",
                  active ? "bg-amber-400/15 text-amber-100" : "text-slate-300 hover:bg-white/5 hover:text-slate-100",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
