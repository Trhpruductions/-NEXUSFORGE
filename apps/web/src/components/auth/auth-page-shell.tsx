"use client";

import type { ReactNode } from "react";

type AuthPageShellProps = {
  hero: ReactNode;
  children: ReactNode;
};

export function AuthPageShell({ hero, children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 sm:px-6">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="solar-grid pointer-events-none absolute inset-0 opacity-90" />
        <div className="login-starfield pointer-events-none absolute inset-0" />
        <div className="login-particles pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="login-particle login-particle-a" />
          <span className="login-particle login-particle-b" />
          <span className="login-particle login-particle-c" />
          <span className="login-particle login-particle-d" />
        </div>
      </div>
      <div className="nexus-ambient" aria-hidden="true">
        <div className="nexus-ambient-orb nexus-ambient-orb-a" />
        <div className="nexus-ambient-orb nexus-ambient-orb-b" />
      </div>
      <div className="mx-auto my-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.9fr] lg:items-center">
        <section className="nexus-display-panel hidden rounded-[32px] border border-amber-500/20 bg-slate-950/92 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.4)] lg:block">
          {hero}
        </section>
        <div className="relative w-full">{children}</div>
      </div>
    </div>
  );
}
