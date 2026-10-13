import type { Metadata } from "next";
import { Suspense } from "react";
import { OAuthConsent } from "@/components/developer/oauth-consent";

export const metadata: Metadata = { title: "Authorize app", description: "Allow an app to use your Vexora Gaming account." };

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <OAuthConsent />
    </Suspense>
  );
}
