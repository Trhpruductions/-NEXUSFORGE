import type { Metadata } from "next";
import { AuthGate } from "@/components/layout/auth-gate";
import { WelcomeWizard } from "@/components/onboarding/welcome-wizard";

export const metadata: Metadata = { title: "Welcome to Nexus Forge", description: "Set up your avatar, find your forge and add friends." };

export default function WelcomePage() {
  return (
    <AuthGate>
      <WelcomeWizard />
    </AuthGate>
  );
}
