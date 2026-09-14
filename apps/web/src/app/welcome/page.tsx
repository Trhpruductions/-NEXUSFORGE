import type { Metadata } from "next";
import { WelcomeWizard } from "@/components/onboarding/welcome-wizard";

export const metadata: Metadata = { title: "Welcome to Vexora", description: "Set up your avatar, find your forge and add friends." };

export default function WelcomePage() {
  return <WelcomeWizard />;
}
