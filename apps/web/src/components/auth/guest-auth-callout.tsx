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
    <div className="nexus-panel-glass rounded-[32px] border border-slate-700/70 p-6 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
      <div className="max-w-3xl space-y-4">
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="text-sm leading-6 text-slate-200">{description}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={loginHref}
          className="nexus-button-primary inline-flex h-14 items-center justify-center rounded-3xl px-6 text-sm font-semibold"
        >
          {loginLabel}
        </Link>
        <Link
          href={registerHref}
          className="nexus-button-secondary inline-flex h-14 items-center justify-center rounded-3xl px-6 text-sm font-semibold"
        >
          {registerLabel}
        </Link>
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
