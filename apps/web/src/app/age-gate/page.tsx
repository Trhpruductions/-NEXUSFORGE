import { Suspense } from "react";
import { AgeGateClient } from "./age-gate-client";

export default function AgeGatePage() {
  return (
    <div className="nexus-shell">
      <div className="nexus-shell-inner max-w-2xl">
        <Suspense fallback={<section className="nexus-panel-strong rounded-3xl p-6 sm:p-8 text-sm text-slate-300">Loading age verification...</section>}>
          <AgeGateClient />
        </Suspense>
      </div>
    </div>
  );
}
