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
    <div className="nexus-panel-glass rounded-[28px] border border-white/10 bg-[#11151e] p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="max-w-3xl space-y-4">
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="text-sm leading-6 text-slate-400">{description}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={loginHref}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-6 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(46,164,255,0.3)] transition hover:-translate-y-px"
        >
          {loginLabel}
        </Link>
        <Link
          href={registerHref}
          className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-[#0d1119] px-6 text-sm font-semibold text-white transition hover:border-amber-300/60"
        >
          {registerLabel}
        </Link>
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
