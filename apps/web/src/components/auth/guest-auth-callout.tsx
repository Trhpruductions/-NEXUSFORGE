import Link from "next/link";
import type { ReactNode } from "react";

type GuestAuthCalloutProps = {
  title: string;
  description: string;
  loginHref: string;
  registerHref: string;
  loginLabel?: string;
  registerLabel?: string;
  children?: ReactNode;
};

export function GuestAuthCallout({
  title,
  description,
  loginHref,
  registerHref,
  loginLabel = "Sign in",
  registerLabel = "Create account",
  children,
}: GuestAuthCalloutProps) {
  return (
    <div className="nexus-panel-glass rounded-[28px] border border-slate-900/10 bg-white/85 p-6 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="max-w-3xl space-y-4">
        <p className="text-lg font-semibold text-slate-950">{title}</p>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={loginHref}
          className="inline-flex h-14 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          {loginLabel}
        </Link>
        <Link
          href={registerHref}
          className="inline-flex h-14 items-center justify-center rounded-full border border-slate-900/10 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {registerLabel}
        </Link>
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
